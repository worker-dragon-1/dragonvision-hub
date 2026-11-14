import { CalendarClock, ExternalLink } from "lucide-react";
import { useData } from "../context/DataContext";
import { fmtDate, isOverdue } from "../lib/dates";
import { TASK_STATUS_LABELS } from "../lib/labels";
import type { TaskStatus } from "../lib/types";
import type { Timestamp } from "firebase/firestore";

const TINTS = [
  "bg-sky-400/15 text-sky-300",
  "bg-emerald-400/15 text-emerald-300",
  "bg-amber-400/15 text-amber-300",
  "bg-fuchsia-400/15 text-fuchsia-300",
  "bg-crimson/15 text-crimson-text",
];
const tint = (id: string) => TINTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];

export function Initial({ id, name, size = "size-7" }: { id: string; name: string; size?: string }) {
  return (
    <span
      title={name}
      className={`grid ${size} shrink-0 place-items-center rounded-full text-xs font-bold ring-2 ring-surface ${tint(id)}`}
    >
      {name.trim().charAt(0).toUpperCase() || "؟"}
    </span>
  );
}

/** Overlapping initials. */
export function AvatarStack({ ids, max = 4 }: { ids: string[]; max?: number }) {
  const { userName } = useData();
  if (ids.length === 0) return <span className="text-xs text-muted">بدون أعضاء</span>;
  const shown = ids.slice(0, max);
  return (
    <span className="flex items-center" aria-label={shown.map(userName).join("، ")}>
      {shown.map((id, i) => (
        <span key={id} className={i ? "-ms-2" : ""}>
          <Initial id={id} name={userName(id)} />
        </span>
      ))}
      {ids.length > max && (
        <span className="-ms-2 grid size-7 place-items-center rounded-full bg-surface-2 text-[0.65rem] font-bold text-muted ring-2 ring-surface">
          +{ids.length - max}
        </span>
      )}
    </span>
  );
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: "border-line bg-surface-2 text-muted",
  in_progress: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  in_review: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  changes_requested: "border-crimson/40 bg-crimson/15 text-crimson-text",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge whitespace-nowrap ${STATUS_STYLE[status]}`}>{TASK_STATUS_LABELS[status]}</span>;
}

/** Due date — red and flagged when overdue. */
export function DueDate({ due, done = false, className = "" }: { due: Timestamp | null; done?: boolean; className?: string }) {
  if (!due) return null;
  const late = isOverdue(due, done);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${late ? "text-crimson-text" : "text-muted"} ${className}`}
      title={late ? "متأخر" : undefined}
    >
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      {fmtDate(due)}
      {late && <span className="rounded bg-crimson/15 px-1.5 py-px text-[0.65rem]">متأخر</span>}
    </span>
  );
}

export function DriveLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-crimson-text hover:underline"
    >
      <ExternalLink className="size-4 shrink-0" aria-hidden />
      {children}
    </a>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-sm leading-6 text-crimson-text">
      {children}
    </p>
  );
}
