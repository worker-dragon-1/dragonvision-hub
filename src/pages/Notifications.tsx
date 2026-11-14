import { Banknote, CheckCheck, ClipboardCheck, ClipboardList, RotateCcw, Send, BellOff, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useData } from "../context/DataContext";
import { useOpenTask } from "../components/TaskViews";
import { markAllRead, markRead } from "../lib/actions";
import { fmtRelative } from "../lib/dates";
import type { NotificationType } from "../lib/types";

const ICONS: Record<NotificationType, { icon: LucideIcon; cls: string }> = {
  task_assigned: { icon: ClipboardList, cls: "bg-sky-400/15 text-sky-300" },
  task_submitted: { icon: Send, cls: "bg-amber-400/15 text-amber-300" },
  task_approved: { icon: ClipboardCheck, cls: "bg-emerald-400/15 text-emerald-300" },
  changes_requested: { icon: RotateCcw, cls: "bg-crimson/15 text-crimson-text" },
  payout_ready: { icon: Banknote, cls: "bg-amber-400/15 text-amber-300" },
  payout_paid: { icon: Banknote, cls: "bg-emerald-400/15 text-emerald-300" },
};

export function NotificationsPage() {
  const { notifications, tasks, loaded } = useData();
  const open = useOpenTask();
  const navigate = useNavigate();
  const sorted = [...notifications].sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
  const unread = sorted.filter((n) => !n.read);

  const onClick = (id: string, type: NotificationType, taskId: string, read: boolean) => {
    if (!read) markRead(id).catch(() => undefined);
    if (type === "payout_ready" || type === "payout_paid") navigate("/my-payouts");
    else if (tasks.some((t) => t.id === taskId)) open(taskId);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="الإشعارات"
        subtitle={loaded ? (unread.length ? `${unread.length} غير مقروء` : "كلها مقروءة") : undefined}
        actions={
          unread.length > 0 && (
            <button className="btn-ghost min-h-10 px-3 text-sm" onClick={() => markAllRead(unread.map((n) => n.id)).catch(() => undefined)}>
              <CheckCheck className="size-4" aria-hidden /> تعليم الكل كمقروء
            </button>
          )
        }
      />
      {loaded && sorted.length === 0 ? (
        <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
            <BellOff className="size-7" aria-hidden />
          </span>
          <p className="text-lg font-bold">لا توجد إشعارات</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => {
            const { icon: Icon, cls } = ICONS[n.type];
            return (
              <li key={n.id}>
                <button
                  onClick={() => onClick(n.id, n.type, n.taskId, n.read)}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-start transition-colors hover:border-muted/50 ${
                    n.read ? "border-line bg-surface" : "border-crimson/40 bg-crimson/5"
                  }`}
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${cls}`}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.95rem] leading-7 ${n.read ? "text-muted" : "font-semibold text-fg"}`}>{n.text}</span>
                    <span className="mt-0.5 block text-xs text-muted">{fmtRelative(n.createdAt)}</span>
                  </span>
                  {!n.read && <span aria-label="غير مقروء" className="mt-2 size-2.5 shrink-0 rounded-full bg-crimson-text" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
