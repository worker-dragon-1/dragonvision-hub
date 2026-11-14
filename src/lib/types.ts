// ─────────────────────────────────────────────────────────────────────────
// Firestore data model — the SHARED contract. The future desktop app must use
// these exact collection names, field names and enum values.
// Documented in README.md → "Data model".
// ─────────────────────────────────────────────────────────────────────────
import type { Timestamp } from "firebase/firestore";

export const ROLES = ["director", "sales", "editor", "audio", "gen_assistant"] as const;
export type Role = (typeof ROLES)[number];

/** Roles the director may hand out. `director` belongs only to DIRECTOR_EMAIL. */
export const MEMBER_ROLES = ["sales", "editor", "audio", "gen_assistant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** The 7 production stages, in pipeline order. */
export const STAGES = ["lead", "script", "generation", "audio", "editing", "review", "delivered"] as const;
export type Stage = (typeof STAGES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "changes_requested", "approved"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const OUTREACH_STATUSES = ["not_contacted", "contacted", "follow_up", "meeting", "won", "lost"] as const;
export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const PAYOUT_TYPES = ["fee", "commission"] as const;
export type PayoutType = (typeof PAYOUT_TYPES)[number];

export const PAYOUT_STATUSES = ["awaiting_client_payment", "ready", "paid"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export type RunningAds = "yes" | "no" | "unclear";

/** How recently the prospect's page posted. "" = unknown (e.g. "-" in an import). */
export const LAST_POSTS = ["this_week", "this_month", "1_3_months", "older", "no_page"] as const;
export type LastPost = (typeof LAST_POSTS)[number] | "";

export const ACTIVITY_TYPES = ["message", "call", "visit", "meeting", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CHANNELS = ["facebook", "instagram", "whatsapp", "phone", "in_person"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Collection names. */
export const COL = {
  users: "users",
  invites: "invites",
  projects: "projects",
  /** subcollection of projects/{id}; the single doc is `finance` */
  private: "private",
  tasks: "tasks",
  prospects: "prospects",
  payouts: "payouts",
  notifications: "notifications",
  /** subcollection of prospects/{id} */
  activities: "activities",
  templates: "templates",
  settings: "settings",
} as const;

/** users/{uid} — uid is the Firebase Auth uid. */
export interface UserDoc {
  displayName: string;
  email: string; // lower-case
  role: Role;
  active: boolean;
  createdAt: Timestamp;
}

/** invites/{inviteId} — inviteId IS the invitee's lower-case email. */
export interface InviteDoc {
  email: string; // lower-case, == doc id
  role: MemberRole;
  invitedBy: string; // director uid
  status: "pending" | "accepted";
  createdAt: Timestamp;
}

/** projects/{projectId} */
export interface ProjectDoc {
  title: string;
  clientName: string;
  prospectId?: string;
  brief: string;
  stage: Stage;
  dueDate: Timestamp | null;
  driveFolderUrl: string;
  memberIds: string[];
  /** set when the project is moved to "delivered" (used by the dashboard) */
  deliveredAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** One client payment. Appended automatically whenever amountPaidByClient changes (negative = correction). */
export interface ClientPayment {
  amount: number;
  at: Timestamp;
}

/** projects/{projectId}/private/finance — DIRECTOR ONLY. Amounts are plain numbers in dinars. */
export interface ProjectFinanceDoc {
  price: number;
  toolsCost: number;
  currency: "TND";
  commissionRate: number; // PERCENT, 0–100 (12 = 12 %)
  salesMemberId: string; // who earns the commission, "" = none
  shares: Record<string, number>; // uid → amount; only current project members
  depositAmount: number;
  depositReceivedAt: Timestamp | null;
  amountPaidByClient: number; // total received so far (includes the deposit)
  clientPaid: boolean; // derived: amountPaidByClient >= price
  payments: ClientPayment[];
  updatedAt: Timestamp;
}

/** settings/finance — DIRECTOR ONLY. */
export interface FinanceSettings {
  defaultCommissionRate: number; // percent
  minProjectPrice: number;
  paymentDelayDays: number; // payout due this many days after the client paid
}

/** One entry of a task's review history. */
export interface ReviewNote {
  by: string; // director uid
  text: string; // required for changes_requested, optional for approved
  at: Timestamp; // client time (serverTimestamp() is not allowed inside arrays)
  kind: "approved" | "changes_requested";
}

/** tasks/{taskId} */
export interface TaskDoc {
  projectId: string;
  stage: Stage;
  title: string;
  instructions: string; // "" when none
  assigneeId: string; // must be in the project's memberIds, never the director
  dueDate: Timestamp | null;
  status: TaskStatus;
  deliverableUrl: string; // Google Drive link (never a file upload); "" until attached
  reviewNotes: ReviewNote[]; // append-only history, director only
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const NOTIFICATION_TYPES = [
  "task_assigned",
  "task_submitted",
  "task_approved",
  "changes_requested",
  "payout_ready",
  "payout_paid",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** notifications/{id} — readable/updatable only by `userId`. */
export interface NotificationDoc {
  userId: string;
  type: NotificationType;
  projectId: string;
  taskId: string; // "" for payout notifications
  payoutId?: string; // payout notifications only
  text: string; // Arabic, ready to display
  read: boolean;
  createdAt: Timestamp;
}

/** prospects/{prospectId} */
export interface ProspectDoc {
  name: string;
  city: string;
  sector: string;
  pageUrl: string; // Facebook page, "" when unknown
  followers: number;
  lastPost: LastPost;
  runningAds: RunningAds;
  quality: 1 | 2 | 3 | null; // quality of their CURRENT creatives: 1 = weak (best prospect), null = not rated
  notes: string;
  outreachStatus: OutreachStatus;
  nextFollowUp: Timestamp | null;
  assigneeId: string; // a sales member's uid, "" = unassigned (director only)
  lostReason: string; // required when outreachStatus == "lost"
  projectId: string; // set when converted to a project, "" otherwise
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** prospects/{id}/activities/{activityId} — append-only outreach log. */
export interface ActivityDoc {
  type: ActivityType;
  channel: Channel;
  text: string;
  createdBy: string;
  createdAt: Timestamp;
}

/** templates/{templateId} — outreach message with {name} / {city} placeholders. */
export interface TemplateDoc {
  title: string;
  body: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** payouts/{payoutId} — id is `${projectId}_${memberId}_${type}`. Only the director writes; a member reads only their own. */
export interface PayoutDoc {
  projectId: string;
  projectTitle: string; // denormalised so a member never needs to read the project
  memberId: string;
  amount: number; // TND
  type: PayoutType;
  status: PayoutStatus;
  method: string; // payment note when paid, e.g. "نقداً" / "D17"
  createdAt: Timestamp;
  paidAt: Timestamp | null;
  dueAt: Timestamp | null; // set when it becomes "ready": client paid + paymentDelayDays
  updatedAt: Timestamp;
}

export type WithId<T> = T & { id: string };
