// Firestore writes for quotes, the client portal, paid revision rounds and gate overrides.
// Director only — the security rules enforce it. The anonymous client only ever writes
// one response doc (see submitResponse).
import {
  Timestamp,
  arrayUnion,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./db";
import { clientStatus } from "./finance";
import { newToken, quoteForClient, quoteTotal, responseId, type ProjectResponse } from "./portal";
import {
  COL,
  type ClientResponseDoc,
  type CountedItem,
  type Deliverable,
  type ExtraRevision,
  type FinanceSettings,
  type PortalDoc,
  type PortalItem,
  type ProjectDoc,
  type ProjectFinanceDoc,
  type QuoteVersionDoc,
  type ReviewItem,
  type Stage,
  type WithId,
} from "./types";

const quoteRef = (projectId: string, version: number) => doc(db, COL.projects, projectId, COL.quoteVersions, String(version));
const financeRef = (projectId: string) => doc(db, COL.projects, projectId, COL.private, "finance");
const portalRef = (token: string) => doc(db, COL.portals, token);

/** A full, rules-valid finance document built from the existing one (or defaults) plus a patch. */
function financeDoc(prev: ProjectFinanceDoc | undefined, patch: Partial<ProjectFinanceDoc>) {
  const base = {
    price: prev?.price ?? 0,
    toolsCost: prev?.toolsCost ?? 0,
    currency: "TND" as const,
    commissionRate: 0,
    salesMemberId: "",
    shares: prev?.shares ?? {},
    depositAmount: prev?.depositAmount ?? 0,
    depositReceivedAt: prev?.depositReceivedAt ?? null,
    amountPaidByClient: prev?.amountPaidByClient ?? 0,
    payments: prev?.payments ?? [],
    extraRevisions: prev?.extraRevisions ?? [],
    ...patch,
  };
  const due = base.price + base.extraRevisions.reduce((n, x) => n + x.fee + x.toolsCost, 0);
  return { ...base, clientPaid: clientStatus(due, base.amountPaidByClient) === "paid", updatedAt: serverTimestamp() };
}

// ── quotes ──────────────────────────────────────────────────────────────────
export interface QuoteInput {
  deliverables: Deliverable[];
  price: number;
  depositAmount: number;
  deliveryDate: Timestamp | null;
  revisionsIncluded: number;
  extraRevisionPrice: number;
  confidential: boolean;
  confidentialityPrice: number;
  paymentTerms: string;
  validUntil: Timestamp;
}

/** New draft version (v1 from settings, or a copy of the latest version). */
export async function createQuoteVersion(projectId: string, version: number, input: QuoteInput) {
  await setDoc(quoteRef(projectId, version), {
    ...input,
    version,
    status: "draft",
    acceptedAt: null,
    acceptedBy: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export const saveQuoteDraft = (projectId: string, version: number, input: QuoteInput) =>
  updateDoc(quoteRef(projectId, version), { ...input, updatedAt: serverTimestamp() });

export const deleteQuoteDraft = (projectId: string, version: number) =>
  writeBatch(db).delete(quoteRef(projectId, version)).commit();

/**
 * The director confirms an accepted quote: the version is locked as "accepted" (older accepted
 * versions are superseded) and the project finance price + deposit are filled from it.
 */
export async function acceptQuote(
  projectId: string,
  q: WithId<QuoteVersionDoc>,
  acceptedBy: string,
  all: WithId<QuoteVersionDoc>[],
  finance: ProjectFinanceDoc | undefined,
) {
  const batch = writeBatch(db);
  batch.update(quoteRef(projectId, q.version), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
    acceptedBy: acceptedBy.trim().slice(0, 100),
    updatedAt: serverTimestamp(),
  });
  all
    .filter((v) => v.version !== q.version && (v.status === "accepted" || v.status === "sent"))
    .forEach((v) => batch.update(quoteRef(projectId, v.version), { status: "superseded", updatedAt: serverTimestamp() }));
  batch.set(financeRef(projectId), financeDoc(finance, { price: quoteTotal(q), depositAmount: q.depositAmount }));
  await batch.commit();
}

// ── portal ──────────────────────────────────────────────────────────────────
export async function createPortal(project: WithId<ProjectDoc>, settings: FinanceSettings, revisionsIncluded: number, extraRevisionPrice: number) {
  const token = newToken();
  await setDoc(portalRef(token), {
    projectId: project.id,
    projectTitle: project.title,
    clientName: project.clientName,
    revoked: false,
    revokedAt: null,
    quote: null,
    items: {},
    revisionsIncluded,
    revisionsUsed: 0,
    extraRevisionPrice: extraRevisionPrice || settings.extraRevisionPrice,
    countedItems: ["final"],
    responsesSeenAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Record<keyof PortalDoc, unknown>);
  return token;
}

export const revokePortal = (token: string) =>
  updateDoc(portalRef(token), { revoked: true, revokedAt: serverTimestamp(), updatedAt: serverTimestamp() });

/** New link: the old one is revoked, the state is copied; versions already answered are closed. */
export async function regeneratePortal(old: WithId<PortalDoc>, responses: ProjectResponse[]) {
  const token = newToken();
  const items: Partial<Record<ReviewItem, PortalItem>> = {};
  for (const [k, it] of Object.entries(old.items) as [ReviewItem, PortalItem][]) {
    const r = responses.find((x) => x.item === k && x.version === it.version);
    // answered versions stay closed and keep showing the client's decision on the new link
    items[k] = r
      ? { ...it, open: false, answer: { decision: r.decision, name: r.name, comment: r.comment, createdAt: r.createdAt } }
      : { ...it, open: it.open && !it.answer };
  }
  const batch = writeBatch(db);
  batch.set(portalRef(token), {
    projectId: old.projectId,
    projectTitle: old.projectTitle,
    clientName: old.clientName,
    revoked: false,
    revokedAt: null,
    quote: old.quote,
    items,
    revisionsIncluded: old.revisionsIncluded,
    revisionsUsed: old.revisionsUsed,
    extraRevisionPrice: old.extraRevisionPrice,
    countedItems: old.countedItems,
    responsesSeenAt: old.responsesSeenAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (!old.revoked) batch.update(portalRef(old.id), { revoked: true, revokedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await batch.commit();
  return token;
}

/** Publish a quote version: a client-safe COPY goes into the portal and the version is locked ("sent"). */
export async function publishQuote(projectId: string, portal: WithId<PortalDoc>, q: WithId<QuoteVersionDoc>, note: string, revisionsUsed: number) {
  const batch = writeBatch(db);
  batch.update(portalRef(portal.id), {
    quote: quoteForClient(q),
    "items.quote": { version: q.version, open: true, title: `عرض السعر — النسخة ${q.version}`, note: note.trim(), link: "", text: "", publishedAt: Timestamp.now() },
    revisionsIncluded: q.revisionsIncluded,
    extraRevisionPrice: q.extraRevisionPrice,
    revisionsUsed,
    updatedAt: serverTimestamp(),
  });
  if (q.status === "draft") batch.update(quoteRef(projectId, q.version), { status: "sent", updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Publish a new version of script / storyboard / final — the previous version is closed. */
export async function publishItem(
  portal: WithId<PortalDoc>,
  item: Exclude<ReviewItem, "quote">,
  input: { title: string; note: string; link: string; text: string },
  revisionsUsed: number,
) {
  const version = (portal.items[item]?.version ?? 0) + 1;
  await updateDoc(portalRef(portal.id), {
    [`items.${item}`]: { version, open: true, title: input.title.trim(), note: input.note.trim(), link: input.link.trim(), text: input.text, publishedAt: Timestamp.now() },
    revisionsUsed, // keeps the client's "rounds used" counter in sync
    updatedAt: serverTimestamp(),
  });
  return version;
}

export const setCountedItems = (token: string, counted: CountedItem[]) =>
  updateDoc(portalRef(token), { countedItems: counted, updatedAt: serverTimestamp() });

export async function markResponsesSeen(tokens: string[]) {
  if (!tokens.length) return;
  const batch = writeBatch(db);
  tokens.forEach((t) => batch.update(portalRef(t), { responsesSeenAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await batch.commit();
}

// ── the anonymous client ─────────────────────────────────────────────────────
export const submitResponse = (token: string, r: Omit<ClientResponseDoc, "createdAt">) =>
  setDoc(doc(db, COL.portals, token, COL.responses, responseId(r.item, r.version)), { ...r, createdAt: serverTimestamp() });

// ── paid revision rounds ─────────────────────────────────────────────────────
export async function addExtraRevision(projectId: string, finance: ProjectFinanceDoc | undefined, entry: Omit<ExtraRevision, "at">) {
  const extraRevisions = [...(finance?.extraRevisions ?? []).filter((x) => x.responseId !== entry.responseId), { ...entry, at: Timestamp.now() }];
  await setDoc(financeRef(projectId), financeDoc(finance, { extraRevisions }));
}

// ── stage gate override ──────────────────────────────────────────────────────
export const moveWithOverride = (projectId: string, from: Stage, to: Stage, reason: string, by: string) =>
  updateDoc(doc(db, COL.projects, projectId), {
    stage: to,
    gateOverrides: arrayUnion({ from, to, reason: reason.trim().slice(0, 500), by, at: Timestamp.now() }),
    deliveredAt: to === "delivered" ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  });
