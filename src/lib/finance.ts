// Pure finance logic: breakdown, warnings, client payment status, payout plan.
import { fmtMoney, fmtPercent } from "./money";
import type { FinanceSettings, PayoutDoc, PayoutType, ProjectFinanceDoc, WithId } from "./types";

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = {
  defaultCommissionRate: 12,
  minProjectPrice: 500,
  paymentDelayDays: 3,
};

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The numbers the breakdown needs (a saved doc or a draft being edited). */
export interface FinanceNumbers {
  price: number;
  toolsCost: number;
  commissionRate: number; // percent
  salesMemberId: string;
  shares: Record<string, number>;
  amountPaidByClient: number;
}

export interface Breakdown {
  commission: number;
  sharesTotal: number;
  margin: number;
  /** margin as a fraction of the price (0 when price is 0) */
  marginRatio: number;
}

/** margin = price − toolsCost − Σ shares − commission.  commission = price × rate%. */
export function breakdown(f: FinanceNumbers): Breakdown {
  const sharesTotal = round3(Object.values(f.shares).reduce((a, b) => a + b, 0));
  const commission = f.salesMemberId ? round3((f.price * f.commissionRate) / 100) : 0;
  const margin = round3(f.price - f.toolsCost - sharesTotal - commission);
  return { commission, sharesTotal, margin, marginRatio: f.price > 0 ? margin / f.price : 0 };
}

export type ClientStatus = "unpaid" | "partial" | "paid";
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  unpaid: "لم يدفع بعد",
  partial: "دفع جزءاً",
  paid: "دفع كامل المبلغ",
};

export function clientStatus(price: number, paid: number): ClientStatus {
  if (paid <= 0) return "unpaid";
  return price > 0 && paid >= price ? "paid" : "partial";
}

/** Warnings only — they never block saving. */
export function financeWarnings(f: FinanceNumbers, minPrice: number): string[] {
  const out: string[] = [];
  const b = breakdown(f);
  if (f.price > 0 && f.price < minPrice) out.push(`السعر أقل من الحد الأدنى للمشاريع (${fmtMoney(minPrice)}).`);
  if (f.price > 0) {
    if (b.margin < 0) out.push(`الهامش سالب (${fmtMoney(b.margin)}): المصاريف والحصص والعمولة تتجاوز السعر.`);
    else if (b.marginRatio < 0.2) out.push(`الهامش ${fmtPercent(Math.round(b.marginRatio * 1000) / 10)} من السعر — أقل من 20%.`);
  }
  if (f.salesMemberId === "" && f.commissionRate > 0 && f.price > 0) out.push("لم يُحدَّد مسؤول المبيعات، لذلك لا تُحسب عمولة.");
  return out;
}

// ── payouts ─────────────────────────────────────────────────────────────────
export const payoutId = (projectId: string, memberId: string, type: PayoutType) => `${projectId}_${memberId}_${type}`;

export type PlanAction = "create" | "update" | "same" | "locked" | "remove" | "kept";

export interface PlanItem {
  id: string;
  memberId: string;
  type: PayoutType;
  /** the amount the finance block says (for remove / kept: the existing amount) */
  amount: number;
  /** previous amount, when it already existed */
  from?: number;
  action: PlanAction;
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * One payout per share + one commission payout. Deterministic ids make re-running safe:
 * existing unpaid payouts get their amount updated, paid ones are never touched.
 */
export function planPayouts(projectId: string, f: ProjectFinanceDoc, existing: WithId<PayoutDoc>[]): PlanItem[] {
  const b = breakdown(f);
  const wanted: { memberId: string; type: PayoutType; amount: number }[] = [
    ...Object.entries(f.shares)
      .filter(([, amount]) => amount > 0)
      .map(([memberId, amount]) => ({ memberId, type: "fee" as const, amount })),
    ...(f.salesMemberId && b.commission > 0 ? [{ memberId: f.salesMemberId, type: "commission" as const, amount: b.commission }] : []),
  ];
  const mine = existing.filter((p) => p.projectId === projectId);
  const items: PlanItem[] = wanted.map((w) => {
    const id = payoutId(projectId, w.memberId, w.type);
    const ex = mine.find((p) => p.id === id);
    if (!ex) return { ...w, id, action: "create" };
    if (same(ex.amount, w.amount)) return { ...w, id, from: ex.amount, action: "same" };
    return { ...w, id, from: ex.amount, action: ex.status === "paid" ? "locked" : "update" };
  });
  for (const ex of mine) {
    if (items.some((i) => i.id === ex.id)) continue;
    items.push({ id: ex.id, memberId: ex.memberId, type: ex.type, amount: ex.amount, from: ex.amount, action: ex.status === "paid" ? "kept" : "remove" });
  }
  return items;
}

export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
export const isThisMonth = (ms: number) => ms >= monthStart();
