// Client portal & quote helpers — pure functions, no Firestore.
import { DEFAULT_FINANCE_SETTINGS } from "./finance";
import { fmtMoney } from "./money";
import type {
  ClientResponseDoc,
  CountedItem,
  FinanceSettings,
  PortalDoc,
  PortalQuote,
  ProjectDoc,
  ProjectFinanceDoc,
  QuoteVersionDoc,
  ReviewItem,
  Stage,
  WithId,
} from "./types";

export const REVIEW_LABELS: Record<ReviewItem, string> = {
  quote: "عرض السعر",
  script: "السيناريو",
  storyboard: "الستوريبورد",
  final: "الفيديو النهائي",
};

export const FORMATS = ["9:16", "1:1", "16:9"] as const;

// ── the secret link ─────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // 62
export const TOKEN_LENGTH = 40; // ≈ 238 bits of randomness

/** Unguessable portal token from crypto.getRandomValues (rejection sampling: no modulo bias). */
export function newToken(length = TOKEN_LENGTH): string {
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 248 && out.length < length) out += ALPHABET[b % 62]; // 248 = 4 × 62
    }
  }
  return out;
}

export const portalUrl = (token: string) => `${location.origin}/p/${token}`;

export function whatsappMessage(p: Pick<PortalDoc, "clientName" | "projectTitle">, token: string): string {
  return [
    `مرحباً ${p.clientName || ""}`.trim() + " 👋",
    `هذا رابط متابعة مشروعكم «${p.projectTitle}» مع DragonVision:`,
    portalUrl(token),
    "من خلاله تراجعون عرض السعر والنسخ، وتوافقون عليها أو تطلبون تعديلات. الرابط خاص بكم، يرجى عدم مشاركته.",
  ].join("\n");
}

export const whatsappLink = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`;

export const responseId = (item: ReviewItem, version: number) => `${item}_v${version}`;

// ── quotes ──────────────────────────────────────────────────────────────────
export const quoteTotal = (q: Pick<QuoteVersionDoc, "price" | "confidential" | "confidentialityPrice">) =>
  Math.round((q.price + (q.confidential ? q.confidentialityPrice : 0)) * 1000) / 1000;

/** Exactly the client-safe fields of a quote (never internal costs or notes). */
export function quoteForClient(q: QuoteVersionDoc): PortalQuote {
  return {
    version: q.version,
    deliverables: q.deliverables.map((d) => ({ title: d.title, durationSec: d.durationSec, formats: [...d.formats], language: d.language })),
    price: q.price,
    depositAmount: q.depositAmount,
    deliveryDate: q.deliveryDate,
    revisionsIncluded: q.revisionsIncluded,
    extraRevisionPrice: q.extraRevisionPrice,
    confidential: q.confidential,
    confidentialityPrice: q.confidentialityPrice,
    paymentTerms: q.paymentTerms,
    validUntil: q.validUntil,
  };
}

export const settingsWithDefaults = (s: Partial<FinanceSettings>): FinanceSettings => ({ ...DEFAULT_FINANCE_SETTINGS, ...s });

export const fmtDuration = (sec: number) => (sec >= 60 ? `${Math.floor(sec / 60)} د ${sec % 60 ? `${sec % 60} ث` : ""}`.trim() : `${sec} ث`);

// ── responses & revision rounds ─────────────────────────────────────────────
export type ProjectResponse = WithId<ClientResponseDoc> & { token: string };

/** The client's answer to a given version (any of the project's portals). */
export const answerFor = (responses: ProjectResponse[], item: ReviewItem, version: number) =>
  responses.find((r) => r.item === item && r.version === version);

export interface RevisionStats {
  included: number;
  used: number;
  /** change requests on counted items, oldest first, with their round number */
  rounds: (ProjectResponse & { round: number; paid: boolean })[];
}

/** Every client change request on a counted item (final video, optionally storyboard) is one round. */
export function revisionStats(responses: ProjectResponse[], counted: CountedItem[], included: number): RevisionStats {
  const rounds = responses
    .filter((r) => r.decision === "changes_requested" && (counted as string[]).includes(r.item))
    .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0))
    .map((r, i) => ({ ...r, round: i + 1, paid: i + 1 > included }));
  return { included, used: rounds.length, rounds };
}

// ── client-approval gates on the stage pipeline ─────────────────────────────
export interface ClientGate {
  blocked: boolean;
  reasons: string[];
  overridden: boolean;
}

/**
 * script → generation: the client approved the CURRENT script version, and the deposit was received.
 * review → delivered: the client approved the CURRENT final video version.
 * A director override (with a recorded reason) lifts the gate.
 */
export function clientGate(
  project: WithId<ProjectDoc>,
  to: Stage | null,
  portal: WithId<PortalDoc> | undefined,
  responses: ProjectResponse[],
  finance: ProjectFinanceDoc | undefined,
): ClientGate {
  const none: ClientGate = { blocked: false, reasons: [], overridden: false };
  if (!to) return none;
  const reasons: string[] = [];
  const approved = (item: ReviewItem) => {
    const it = portal?.items[item];
    return !!it && (answerFor(responses, item, it.version) ?? it.answer)?.decision === "approved";
  };
  if (project.stage === "script" && to === "generation") {
    if (!approved("script")) reasons.push("لم يوافق الزبون على النسخة الحالية من السيناريو عبر بوابة الزبون.");
    const depositOk = !!finance && finance.depositAmount > 0 && (finance.depositReceivedAt !== null || finance.amountPaidByClient >= finance.depositAmount);
    if (!depositOk) reasons.push("لم يُسجَّل استلام العربون (مطلوب قبل بدء الإنتاج).");
  } else if (project.stage === "review" && to === "delivered") {
    if (!approved("final")) reasons.push("لم يوافق الزبون على النسخة الحالية من الفيديو النهائي.");
  } else {
    return none;
  }
  if (reasons.length === 0) return none;
  const overridden = (project.gateOverrides ?? []).some((o) => o.from === project.stage && o.to === to);
  return { blocked: !overridden, reasons, overridden };
}

export const paidRoundText = (fee: number) => `${fmtMoney(fee)} + تكلفة الأدوات الفعلية لهذه الجولة`;
