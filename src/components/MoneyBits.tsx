import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PAYOUT_STATUS_LABELS } from "../lib/labels";
import type { PayoutStatus, PayoutType } from "../lib/types";

// No commissions for now: a (legacy) "commission" payout is simply shown as a plain payout.
export const PAYOUT_TYPE_LABELS: Record<PayoutType, string> = { fee: "أجر", commission: "مستحق" };

const STATUS_STYLE: Record<PayoutStatus, string> = {
  awaiting_client_payment: "border-line bg-surface-2 text-muted",
  ready: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export const PayoutStatusBadge = ({ status }: { status: PayoutStatus }) => (
  <span className={`badge whitespace-nowrap ${STATUS_STYLE[status]}`}>{PAYOUT_STATUS_LABELS[status]}</span>
);

const TONES = {
  default: "",
  warn: "border-amber-400/30 bg-amber-400/5",
  danger: "border-crimson/40 bg-crimson/5",
  good: "border-emerald-400/30 bg-emerald-400/5",
} as const;

/** A number card; optionally a link to the filtered page behind it. */
export function StatCard({
  label,
  value,
  hint,
  to,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  tone?: keyof typeof TONES;
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold leading-9 tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-muted">{hint}</p>}
    </>
  );
  const cls = `card block p-4 ${TONES[tone]}`;
  return to ? (
    <Link to={to} className={`${cls} transition-colors hover:border-muted/60`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
