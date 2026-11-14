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
  /** subcollection of projects/{id} — one doc per quote version ("1", "2", …) */
  quoteVersions: "quoteVersions",
  /** client portals — the doc id is the secret link token */
  portals: "portals",
  /** subcollection of portals/{token} — the client's answers */
  responses: "responses",
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
  /** director overrides of the client-approval gates, with the reason */
  gateOverrides?: GateOverride[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GateOverride {
  from: Stage;
  to: Stage;
  reason: string;
  by: string; // director uid
  at: Timestamp;
}

/** A paid revision round beyond those included in the quote. */
export interface ExtraRevision {
  responseId: string; // the client's change request it comes from
  round: number; // 3 = the third round
  fee: number; // e.g. 50 TND
  toolsCost: number; // actual tool cost of that round (entered by the director)
  at: Timestamp;
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
  /** paid revision rounds (client pays fee + tool cost) — optional for older docs */
  extraRevisions?: ExtraRevision[];
  updatedAt: Timestamp;
}

/** settings/finance — DIRECTOR ONLY. */
export interface FinanceSettings {
  defaultCommissionRate: number; // percent
  minProjectPrice: number;
  paymentDelayDays: number; // payout due this many days after the client paid
  // quote & agreement defaults
  includedRevisions: number; // revision rounds included per project
  extraRevisionPrice: number; // TND per extra round (+ that round's tool cost)
  depositPercent: number; // deposit = % of the price, required before production
  confidentialityPrice: number; // extra for NOT showing the video in our portfolio
  quoteValidityDays: number;
}

// ── Quotes & client portal ─────────────────────────────────────────────────
export const REVIEW_ITEMS = ["quote", "script", "storyboard", "final"] as const;
export type ReviewItem = (typeof REVIEW_ITEMS)[number];
export type CountedItem = "final" | "storyboard";

export interface Deliverable {
  title: string;
  durationSec: number;
  formats: string[]; // "9:16" | "1:1" | "16:9"
  language: string; // e.g. "الدارجة التونسية"
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "superseded";

/** projects/{projectId}/quoteVersions/{version} — DIRECTOR ONLY. */
export interface QuoteVersionDoc {
  version: number;
  status: QuoteStatus;
  deliverables: Deliverable[];
  price: number; // without the confidentiality option
  depositAmount: number;
  deliveryDate: Timestamp | null;
  revisionsIncluded: number;
  extraRevisionPrice: number;
  confidential: boolean; // client pays to keep the video out of our portfolio
  confidentialityPrice: number;
  paymentTerms: string;
  validUntil: Timestamp;
  acceptedAt: Timestamp | null;
  acceptedBy: string; // client's typed name (or "" until accepted)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** The client-safe copy of a quote stored inside a portal. */
export type PortalQuote = Pick<
  QuoteVersionDoc,
  | "version" | "deliverables" | "price" | "depositAmount" | "deliveryDate" | "revisionsIncluded"
  | "extraRevisionPrice" | "confidential" | "confidentialityPrice" | "paymentTerms" | "validUntil"
>;

export interface PortalItem {
  version: number;
  open: boolean; // waiting for the client's answer
  title: string;
  note: string; // a note FOR THE CLIENT
  link: string; // Drive / video link
  text: string; // e.g. the script text
  publishedAt: Timestamp;
  /** the client's answer, copied in when a link is regenerated (answers stay under the old link) */
  answer?: Pick<ClientResponseDoc, "decision" | "name" | "comment" | "createdAt">;
}

/** portals/{token} — only client-safe data. Anonymous clients can only get it by its exact token. */
export interface PortalDoc {
  projectId: string;
  projectTitle: string;
  clientName: string;
  revoked: boolean;
  revokedAt: Timestamp | null;
  quote: PortalQuote | null;
  items: Partial<Record<ReviewItem, PortalItem>>;
  revisionsIncluded: number;
  revisionsUsed: number; // synced by the director when publishing
  extraRevisionPrice: number;
  countedItems: CountedItem[];
  responsesSeenAt: Timestamp | null; // director "read" marker
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** portals/{token}/responses/{item}_v{version} — create-only, written by the anonymous client. */
export interface ClientResponseDoc {
  item: ReviewItem;
  version: number;
  decision: "approved" | "changes_requested";
  name: string; // typed full name = signature
  comment: string;
  extraRoundAck: boolean; // acknowledged a paid revision round
  createdAt: Timestamp;
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
