// Pure workflow logic: stage order, the stage gate and the task status flow.
import { STAGES, type ProjectDoc, type Stage, type TaskDoc, type TaskStatus, type WithId } from "./types";
import { STAGE_LABELS, TASK_STATUS_LABELS } from "./labels";

export const stageIndex = (s: Stage) => STAGES.indexOf(s);
export const nextStage = (s: Stage): Stage | null => STAGES[stageIndex(s) + 1] ?? null;
export const prevStage = (s: Stage): Stage | null => STAGES[stageIndex(s) - 1] ?? null;

export interface StageGate {
  next: Stage | null;
  /** Tasks of the CURRENT stage that are not approved yet. */
  blockers: WithId<TaskDoc>[];
  canAdvance: boolean;
  /** Arabic explanation, or null when nothing blocks. */
  message: string | null;
}

/** A project may move forward only when every task of its current stage is approved. */
export function stageGate(project: WithId<ProjectDoc>, tasks: WithId<TaskDoc>[]): StageGate {
  const next = nextStage(project.stage);
  const blockers = tasks.filter(
    (t) => t.projectId === project.id && t.stage === project.stage && t.status !== "approved",
  );
  if (!next) return { next, blockers, canAdvance: false, message: null };
  if (blockers.length === 0) return { next, blockers, canAdvance: true, message: null };

  const list = blockers.map((t) => `«${t.title}» (${TASK_STATUS_LABELS[t.status]})`).join("، ");
  const n = blockers.length;
  const count = n === 1 ? "مهمة واحدة لم تُعتمد بعد" : n === 2 ? "مهمتان لم تُعتمدا بعد" : `${n} مهام لم تُعتمد بعد`;
  return {
    next,
    blockers,
    canAdvance: false,
    message: `لا يمكن الانتقال إلى «${STAGE_LABELS[next]}»: في مرحلة «${STAGE_LABELS[project.stage]}» ${count}: ${list}.`,
  };
}

/** What the assignee may do next, by current status (mirrors firestore.rules). */
export type AssigneeAction = "start" | "resume" | "submit";
export function assigneeAction(status: TaskStatus): AssigneeAction | null {
  switch (status) {
    case "todo":
      return "start"; // todo → in_progress
    case "changes_requested":
      return "resume"; // changes_requested → in_progress
    case "in_progress":
      return "submit"; // in_progress → in_review (needs a link)
    default:
      return null; // in_review: waiting · approved: done
  }
}

/** Link must be http(s) — same rule as firestore.rules. */
export const isHttpUrl = (u: string): boolean => {
  if (!/^https?:\/\/\S+$/.test(u) || u.length > 2000) return false;
  try {
    const p = new URL(u).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
};

/** Display order in "مهامي". */
export const TASK_GROUP_ORDER: TaskStatus[] = ["changes_requested", "in_progress", "todo", "in_review", "approved"];
export const TASK_GROUP_LABELS: Record<TaskStatus, string> = {
  changes_requested: "تحتاج تعديلات",
  in_progress: "قيد التنفيذ",
  todo: "للإنجاز",
  in_review: "بانتظار المراجعة",
  approved: "معتمدة",
};

/** Sort by due date (soonest first, no date last). */
export const byDue = (a: WithId<TaskDoc>, b: WithId<TaskDoc>) =>
  (a.dueDate?.toMillis() ?? Infinity) - (b.dueDate?.toMillis() ?? Infinity);
