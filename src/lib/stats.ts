// Dashboard maths — everything derives from data the director already loads.
import { breakdown, isThisMonth } from "./finance";
import type { PayoutDoc, ProjectDoc, ProjectFinanceDoc, TaskDoc, UserDoc, WithId } from "./types";

const DAY = 86_400_000;

/** When a task was approved: the last "approved" entry of its history (client clock), else updatedAt. */
export function approvedAt(t: TaskDoc): number {
  for (let i = t.reviewNotes.length - 1; i >= 0; i--) if (t.reviewNotes[i].kind === "approved") return t.reviewNotes[i].at.toMillis();
  return t.updatedAt?.toMillis?.() ?? 0;
}

const revisionRounds = (t: TaskDoc) => t.reviewNotes.filter((n) => n.kind === "changes_requested").length;

export interface MemberPerformance {
  id: string;
  name: string;
  role: UserDoc["role"];
  completed: number; // approved in the window
  onTimePct: number | null; // % approved on/before dueDate (tasks that have one)
  avgRounds: number | null; // changes_requested per completed task
  overdue: number; // open tasks past their due date
}

/** Delivered work in the last `days` days — not activity, not screen time. */
export function teamPerformance(tasks: WithId<TaskDoc>[], users: WithId<UserDoc>[], days = 30, now = Date.now()): MemberPerformance[] {
  const since = now - days * DAY;
  return users
    .filter((u) => u.active && u.role !== "director")
    .map((u) => {
      const mine = tasks.filter((t) => t.assigneeId === u.id);
      const done = mine.filter((t) => t.status === "approved" && approvedAt(t) >= since);
      const withDue = done.filter((t) => t.dueDate);
      const onTime = withDue.filter((t) => approvedAt(t) <= t.dueDate!.toMillis());
      return {
        id: u.id,
        name: u.displayName,
        role: u.role,
        completed: done.length,
        onTimePct: withDue.length ? Math.round((onTime.length / withDue.length) * 100) : null,
        avgRounds: done.length ? Math.round((done.reduce((n, t) => n + revisionRounds(t), 0) / done.length) * 10) / 10 : null,
        overdue: mine.filter((t) => t.status !== "approved" && t.dueDate && t.dueDate.toMillis() < now).length,
      };
    })
    .sort((a, b) => b.completed - a.completed || a.name.localeCompare(b.name, "ar"));
}

export interface MoneyThisMonth {
  revenue: number; // client payments received this month
  outstanding: number; // still owed by clients, all projects
  paidOut: number; // payouts marked paid this month
  margin: number; // director margin of projects delivered this month
}

export function moneyThisMonth(
  projects: WithId<ProjectDoc>[],
  finances: Record<string, ProjectFinanceDoc>,
  payouts: WithId<PayoutDoc>[],
): MoneyThisMonth {
  let revenue = 0;
  let outstanding = 0;
  let margin = 0;
  for (const p of projects) {
    const f = finances[p.id];
    if (!f) continue;
    revenue += f.payments.filter((x) => isThisMonth(x.at.toMillis())).reduce((n, x) => n + x.amount, 0);
    outstanding += Math.max(0, breakdown(f).totalDue - f.amountPaidByClient);
    const deliveredMs = (p.deliveredAt ?? p.updatedAt)?.toMillis?.() ?? 0;
    if (p.stage === "delivered" && isThisMonth(deliveredMs)) margin += breakdown(f).margin;
  }
  const paidOut = payouts.filter((x) => x.status === "paid" && x.paidAt && isThisMonth(x.paidAt.toMillis())).reduce((n, x) => n + x.amount, 0);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { revenue: r(revenue), outstanding: r(outstanding), paidOut: r(paidOut), margin: r(margin) };
}
