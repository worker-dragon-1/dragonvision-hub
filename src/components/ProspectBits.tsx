import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ClipboardCopy, Info } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { fmtDate } from "../lib/dates";
import { OUTREACH_LABELS } from "../lib/labels";
import { PRIORITY_LABELS, followUpBucket, priorityOf, startOfToday } from "../lib/prospects";
import type { OutreachStatus, ProspectDoc } from "../lib/types";

const LEVEL_STYLE = {
  high: "border-crimson/50 bg-crimson/15 text-crimson-text",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  low: "border-line bg-surface-2 text-muted",
} as const;

/**
 * Small priority badge. The tooltip explains the score line by line — hover (mouse),
 * focus (keyboard) or tap (touch) opens it. Rendered in a portal so tables never clip it.
 */
export function PriorityBadge({ prospect }: { prospect: Pick<ProspectDoc, "runningAds" | "quality" | "lastPost" | "followers"> }) {
  const pr = priorityOf(prospect);
  const btn = useRef<HTMLButtonElement>(null);
  const lastPointer = useRef<string>("mouse");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = 272;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    const below = r.bottom + 8;
    setPos({ top: below + 230 > window.innerHeight ? Math.max(8, r.top - 8 - 230) : below, left });
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    const onDown = (e: PointerEvent) => !btn.current?.contains(e.target as Node) && hide();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", hide, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={!!pos}
        aria-label={`${pr.label}، ${pr.score} من 9. اضغط لمعرفة السبب`}
        className={`badge relative z-10 cursor-help gap-1 whitespace-nowrap ${LEVEL_STYLE[pr.level]}`}
        onPointerDown={(e) => (lastPointer.current = e.pointerType)}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
        onFocus={show}
        onBlur={hide}
        onClick={() => lastPointer.current !== "mouse" && (pos ? hide() : show())}
      >
        {pr.label.replace("أولوية ", "")}
        <span className="rounded bg-black/25 px-1 text-[0.7rem] leading-4">{pr.score}</span>
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: pos.top, left: pos.left, width: 272 }}
            className="fixed z-[60] rounded-xl border border-line bg-surface-2 p-3.5 text-sm shadow-2xl"
          >
            <p className="mb-2 flex items-center justify-between gap-2 font-bold">
              <span>{PRIORITY_LABELS[pr.level]}</span>
              <span className="text-muted">{pr.score} من 9</span>
            </p>
            <ul className="space-y-1.5">
              {pr.lines.map((l) => (
                <li key={l.label} className="flex items-start justify-between gap-3 leading-6">
                  <span className={l.points ? "text-fg" : "text-muted"}>{l.label}</span>
                  <bdi dir="ltr" className={`shrink-0 font-bold ${l.points ? "text-emerald-300" : "text-muted"}`}>+{l.points}</bdi>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 flex gap-1.5 border-t border-line pt-2.5 text-xs leading-5 text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>أفضل الزبائن يعلنون عن منتجاتهم لكن محتواهم ضعيف. عالية: <bdi dir="ltr">7+</bdi> · متوسطة: <bdi dir="ltr">4–6</bdi> · منخفضة: <bdi dir="ltr">0–3</bdi></span>
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}

const STATUS_STYLE: Record<OutreachStatus, string> = {
  not_contacted: "border-line bg-surface-2 text-muted",
  contacted: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  follow_up: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  meeting: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300",
  won: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  lost: "border-crimson/40 bg-crimson/15 text-crimson-text",
};

export const OutreachBadge = ({ status }: { status: OutreachStatus }) => (
  <span className={`badge whitespace-nowrap ${STATUS_STYLE[status]}`}>{OUTREACH_LABELS[status]}</span>
);

/** Next follow-up date: red when overdue, amber when due today. */
export function FollowUpLabel({ prospect }: { prospect: Pick<ProspectDoc, "nextFollowUp" | "outreachStatus"> }) {
  if (!prospect.nextFollowUp) return <span className="text-xs text-muted">—</span>;
  const b = followUpBucket(prospect);
  const cls = b === 0 ? "text-crimson-text" : b === 1 ? "text-amber-300" : "text-muted";
  return (
    <span className={`text-xs font-semibold ${cls}`}>
      {fmtDate(prospect.nextFollowUp)}
      {b === 0 && <span className="ms-1.5 rounded bg-crimson/15 px-1.5 py-px text-[0.65rem]">متأخرة</span>}
      {b === 1 && <span className="ms-1.5 rounded bg-amber-400/15 px-1.5 py-px text-[0.65rem]">اليوم</span>}
    </span>
  );
};

/** "متأخرة بيومين" */
export function overdueText(ts: Timestamp): string {
  const days = Math.max(1, Math.ceil((startOfToday() - ts.toMillis()) / 86_400_000));
  return days === 1 ? "متأخرة بيوم" : days === 2 ? "متأخرة بيومين" : `متأخرة ${days} أيام`;
}

// ── copy with fallback ──────────────────────────────────────────────────────
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies `text`; if the browser refuses, shows it in a pre-selected box to copy by hand. */
export function CopyButton({ text, label = "نسخ", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state === "manual") {
      area.current?.focus();
      area.current?.select();
    }
    if (state === "copied") {
      const t = setTimeout(() => setState("idle"), 2000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <div className={className}>
      <button
        type="button"
        className="btn-ghost min-h-10 px-3.5 text-sm"
        onClick={async () => setState((await copyToClipboard(text)) ? "copied" : "manual")}
      >
        {state === "copied" ? <Check className="size-4 text-ok" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
        {state === "copied" ? "تم النسخ" : label}
      </button>
      {state === "manual" && (
        <div className="mt-2.5">
          <p className="mb-1.5 text-xs text-amber-300">تعذّر النسخ تلقائياً. النص محدّد — اضغط نسخ من قائمة الهاتف أو Ctrl+C.</p>
          <textarea ref={area} readOnly value={text} className="input h-auto min-h-32 py-3 leading-7" onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}
