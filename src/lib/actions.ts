// All Firestore writes for the core workflow. Every multi-document change is a
// single batch so the task and its notification can never go out of sync
// (and Firestore rules verify the pair with getAfter()).
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "./db";
import { DEFAULT_TEMPLATES } from "./prospects";
import { clientStatus, type PlanItem } from "./finance";
import { fmtMoney } from "./money";
import { fmtDate } from "./dates";
import {
  COL,
  type ActivityDoc,
  type ClientPayment,
  type FinanceSettings,
  type NotificationType,
  type PayoutDoc,
  type ProjectFinanceDoc,
  type OutreachStatus,
  type ProjectDoc,
  type ProspectDoc,
  type TemplateDoc,
  type ReviewNote,
  type Stage,
  type TaskDoc,
  type WithId,
} from "./types";

// ── notifications ──────────────────────────────────────────────────────────
function addNotification(
  batch: WriteBatch,
  n: { userId: string; type: NotificationType; projectId: string; taskId: string; text: string },
) {
  batch.set(doc(collection(db, COL.notifications)), { ...n, read: false, createdAt: serverTimestamp() });
}

export const markRead = (id: string) => updateDoc(doc(db, COL.notifications, id), { read: true });

export async function markAllRead(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, COL.notifications, id), { read: true }));
  await batch.commit();
}

// ── projects ───────────────────────────────────────────────────────────────
export interface NewProjectInput {
  title: string;
  clientName: string;
  brief: string;
  dueDate: Timestamp | null;
  driveFolderUrl: string;
  memberIds: string[];
  /** set when the project is created from a prospect */
  prospectId?: string;
}

export async function createProject(input: NewProjectInput, actorId: string): Promise<string> {
  const ref = doc(collection(db, COL.projects));
  const { prospectId, ...rest } = input;
  await writeBatch(db)
    .set(ref, {
      ...rest,
      ...(prospectId ? { prospectId } : {}), // Firestore rejects `undefined`

      stage: "lead" satisfies Stage,
      createdBy: actorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    .commit();
  return ref.id;
}

export const setProjectMembers = (projectId: string, memberIds: string[]) =>
  updateDoc(doc(db, COL.projects, projectId), { memberIds, updatedAt: serverTimestamp() });

/** Director only. Forward = exactly one step (rules); the gate is checked by the UI before calling. */
export const moveProjectStage = (projectId: string, stage: Stage) =>
  updateDoc(doc(db, COL.projects, projectId), {
    stage,
    // the dashboard counts a project's margin in the month it was delivered
    deliveredAt: stage === "delivered" ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  });

// ── tasks ──────────────────────────────────────────────────────────────────
export interface TaskFormInput {
  projectId: string;
  stage: Stage;
  title: string;
  instructions: string;
  assigneeId: string;
  dueDate: Timestamp | null;
}

export async function createTask(input: TaskFormInput) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, COL.tasks));
  batch.set(ref, {
    ...input,
    status: "todo",
    deliverableUrl: "",
    reviewNotes: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  addNotification(batch, {
    userId: input.assigneeId,
    type: "task_assigned",
    projectId: input.projectId,
    taskId: ref.id,
    text: `تم إسناد مهمة جديدة إليك: «${input.title}»`,
  });
  await batch.commit();
  return ref.id;
}

/** Director edit / reassign. Notifies the new assignee when it changes. */
export async function editTask(task: WithId<TaskDoc>, input: Omit<TaskFormInput, "projectId">) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.tasks, task.id), { ...input, updatedAt: serverTimestamp() });
  if (input.assigneeId !== task.assigneeId) {
    addNotification(batch, {
      userId: input.assigneeId,
      type: "task_assigned",
      projectId: task.projectId,
      taskId: task.id,
      text: `تم إسناد مهمة جديدة إليك: «${input.title}»`,
    });
  }
  await batch.commit();
}

export const deleteTask = (id: string) => deleteDoc(doc(db, COL.tasks, id));

/** todo → in_progress, or changes_requested → in_progress. */
export const startTask = (task: WithId<TaskDoc>) =>
  updateDoc(doc(db, COL.tasks, task.id), { status: "in_progress", updatedAt: serverTimestamp() });

export const saveDeliverable = (task: WithId<TaskDoc>, url: string) =>
  updateDoc(doc(db, COL.tasks, task.id), { deliverableUrl: url, updatedAt: serverTimestamp() });

/** in_progress → in_review (link required) + notify the director(s). */
export async function submitTask(task: WithId<TaskDoc>, url: string, assigneeName: string, directorIds: string[]) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.tasks, task.id), { status: "in_review", deliverableUrl: url, updatedAt: serverTimestamp() });
  directorIds.forEach((userId) =>
    addNotification(batch, {
      userId,
      type: "task_submitted",
      projectId: task.projectId,
      taskId: task.id,
      text: `${assigneeName} سلّم مهمة للمراجعة: «${task.title}»`,
    }),
  );
  await batch.commit();
}

/** in_review → approved | changes_requested. Appends ONE entry to the history. */
async function review(task: WithId<TaskDoc>, directorId: string, kind: ReviewNote["kind"], text: string) {
  const entry: ReviewNote = { by: directorId, text: text.trim(), at: Timestamp.now(), kind };
  const approved = kind === "approved";
  const batch = writeBatch(db);
  batch.update(doc(db, COL.tasks, task.id), {
    status: approved ? "approved" : "changes_requested",
    reviewNotes: [...task.reviewNotes, entry],
    updatedAt: serverTimestamp(),
  });
  addNotification(batch, {
    userId: task.assigneeId,
    type: approved ? "task_approved" : "changes_requested",
    projectId: task.projectId,
    taskId: task.id,
    text: approved ? `تم اعتماد مهمتك: «${task.title}»` : `طُلبت تعديلات على مهمتك: «${task.title}»`,
  });
  await batch.commit();
}

export const approveTask = (task: WithId<TaskDoc>, directorId: string, note = "") =>
  review(task, directorId, "approved", note);

export const requestChanges = (task: WithId<TaskDoc>, directorId: string, note: string) => {
  if (!note.trim()) throw new Error("note-required");
  return review(task, directorId, "changes_requested", note);
};

export type { ProjectDoc };

// ── prospects ──────────────────────────────────────────────────────────────
export type ProspectInput = Pick<
  ProspectDoc,
  | "name" | "city" | "sector" | "pageUrl" | "followers" | "lastPost" | "runningAds" | "quality"
  | "notes" | "outreachStatus" | "nextFollowUp" | "lostReason" | "assigneeId"
>;

export async function createProspect(input: ProspectInput, actorId: string): Promise<string> {
  const ref = doc(collection(db, COL.prospects));
  await writeBatch(db)
    .set(ref, { ...input, projectId: "", createdBy: actorId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    .commit();
  return ref.id;
}

export const updateProspect = (id: string, patch: Partial<ProspectInput> & { projectId?: string }) =>
  updateDoc(doc(db, COL.prospects, id), { ...patch, updatedAt: serverTimestamp() });

export const deleteProspect = (id: string) => deleteDoc(doc(db, COL.prospects, id));

export interface ActivityInput {
  type: ActivityDoc["type"];
  channel: ActivityDoc["channel"];
  text: string;
  /** optional, applied in the SAME batch */
  status?: OutreachStatus;
  nextFollowUp?: Timestamp | null;
}

/** Adds a log entry and (optionally) moves the status / follow-up date atomically. */
export async function addActivity(prospect: WithId<ProspectDoc>, input: ActivityInput, actorId: string) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, COL.prospects, prospect.id, COL.activities)), {
    type: input.type,
    channel: input.channel,
    text: input.text.trim(),
    createdBy: actorId,
    createdAt: serverTimestamp(),
  });
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.status && input.status !== prospect.outreachStatus) patch.outreachStatus = input.status;
  if (input.nextFollowUp !== undefined) patch.nextFollowUp = input.nextFollowUp;
  if (Object.keys(patch).length > 1) batch.update(doc(db, COL.prospects, prospect.id), patch);
  await batch.commit();
}

/** Bulk import — `assigneeId` is the sales member's uid (themselves) or "" for the director. */
export async function importProspects(
  rows: Pick<ProspectDoc, "name" | "followers" | "lastPost" | "runningAds" | "quality" | "notes">[],
  actorId: string,
  assigneeId: string,
) {
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db);
    rows.slice(i, i + 400).forEach((r) =>
      batch.set(doc(collection(db, COL.prospects)), {
        ...r,
        city: "",
        sector: "",
        pageUrl: "",
        outreachStatus: "not_contacted",
        nextFollowUp: null,
        assigneeId,
        lostReason: "",
        projectId: "",
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await batch.commit();
  }
}

// ── templates (director writes) ────────────────────────────────────────────
export const saveTemplate = async (
  t: { id?: string; title: string; body: string },
  actorId: string,
) => {
  if (t.id) {
    await updateDoc(doc(db, COL.templates, t.id), { title: t.title.trim(), body: t.body.trim(), updatedAt: serverTimestamp() });
  } else {
    await writeBatch(db)
      .set(doc(collection(db, COL.templates)), {
        title: t.title.trim(),
        body: t.body.trim(),
        createdBy: actorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies Record<keyof TemplateDoc, unknown>)
      .commit();
  }
};

export const deleteTemplate = (id: string) => deleteDoc(doc(db, COL.templates, id));

/** Director only, once: writes the two default templates and a marker so they are never re-created. */
export async function seedDefaultTemplates(directorId: string) {
  const marker = doc(db, COL.settings, "seed");
  if ((await getDoc(marker)).exists()) return;
  const batch = writeBatch(db);
  DEFAULT_TEMPLATES.forEach((t) =>
    batch.set(doc(db, COL.templates, t.id), {
      title: t.title,
      body: t.body,
      createdBy: directorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  batch.set(marker, { templatesSeeded: true, at: serverTimestamp() });
  await batch.commit();
}

// ── finance (director only) ────────────────────────────────────────────────
export const saveFinanceSettings = (s: FinanceSettings) =>
  setDoc(doc(db, COL.settings, "finance"), { ...s, updatedAt: serverTimestamp() });

export interface FinanceInput {
  price: number;
  toolsCost: number;
  depositAmount: number;
  depositReceivedAt: Timestamp | null;
  amountPaidByClient: number;
  commissionRate: number;
  salesMemberId: string;
  shares: Record<string, number>;
}

/**
 * Saves projects/{id}/private/finance. Whenever amountPaidByClient changes, the difference is
 * appended to `payments` (with the time) so the dashboard can tell what was received this month.
 */
export async function saveFinance(projectId: string, input: FinanceInput, previous: ProjectFinanceDoc | undefined) {
  const prevPaid = previous?.amountPaidByClient ?? 0;
  const delta = Math.round((input.amountPaidByClient - prevPaid) * 1000) / 1000;
  const payments: ClientPayment[] = [...(previous?.payments ?? []), ...(delta !== 0 ? [{ amount: delta, at: Timestamp.now() }] : [])];
  await setDoc(doc(db, COL.projects, projectId, COL.private, "finance"), {
    ...input,
    currency: "TND",
    clientPaid: clientStatus(input.price, input.amountPaidByClient) === "paid",
    payments,
    updatedAt: serverTimestamp(),
  });
}

// ── payouts ────────────────────────────────────────────────────────────────
const whose = () => "مستحقك";

function payoutNotification(
  batch: WriteBatch,
  p: { userId: string; type: "payout_ready" | "payout_paid"; projectId: string; payoutId: string; text: string },
) {
  batch.set(doc(collection(db, COL.notifications)), { ...p, taskId: "", read: false, createdAt: serverTimestamp() });
}

/** Applies the plan from planPayouts(): create / update amount / remove — never touches a paid payout. */
export async function applyPayoutPlan(projectId: string, projectTitle: string, plan: PlanItem[]) {
  const batch = writeBatch(db);
  let writes = 0;
  for (const item of plan) {
    const ref = doc(db, COL.payouts, item.id);
    if (item.action === "create") {
      batch.set(ref, {
        projectId,
        projectTitle,
        memberId: item.memberId,
        amount: item.amount,
        type: item.type,
        status: "awaiting_client_payment",
        method: "",
        createdAt: serverTimestamp(),
        paidAt: null,
        dueAt: null,
        updatedAt: serverTimestamp(),
      });
      writes++;
    } else if (item.action === "update") {
      batch.update(ref, { amount: item.amount, projectTitle, updatedAt: serverTimestamp() });
      writes++;
    } else if (item.action === "remove") {
      batch.delete(ref);
      writes++;
    }
  }
  if (writes) await batch.commit();
}

/** The client paid in full: every awaiting payout of the project becomes "ready" (rules re-check the payment). */
export async function markPayoutsReady(
  projectTitle: string,
  payouts: WithId<PayoutDoc>[],
  delayDays: number,
) {
  const due = Timestamp.fromMillis(Date.now() + delayDays * 86_400_000);
  const batch = writeBatch(db);
  payouts
    .filter((p) => p.status === "awaiting_client_payment")
    .forEach((p) => {
      batch.update(doc(db, COL.payouts, p.id), { status: "ready", dueAt: due, updatedAt: serverTimestamp() });
      payoutNotification(batch, {
        userId: p.memberId,
        type: "payout_ready",
        projectId: p.projectId,
        payoutId: p.id,
        // only THIS member's own amount
        text: `${whose()} عن مشروع «${projectTitle}» جاهز للدفع: ${fmtMoney(p.amount)}. يُدفع قبل ${fmtDate(due)}.`,
      });
    });
  await batch.commit();
}

export async function markPayoutPaid(p: WithId<PayoutDoc>, method: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, COL.payouts, p.id), { status: "paid", paidAt: serverTimestamp(), method: method.trim(), updatedAt: serverTimestamp() });
  payoutNotification(batch, {
    userId: p.memberId,
    type: "payout_paid",
    projectId: p.projectId,
    payoutId: p.id,
    text: `تم دفع ${whose()} عن مشروع «${p.projectTitle}»: ${fmtMoney(p.amount)}${method.trim() ? ` (${method.trim()})` : ""}.`,
  });
  await batch.commit();
}
