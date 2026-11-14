import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Banknote, CheckCircle2, Clock, Loader2, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { Field, Select } from "../components/Forms";
import { Modal } from "../components/Modal";
import { PAYOUT_TYPE_LABELS, PayoutStatusBadge, StatCard } from "../components/MoneyBits";
import { markPayoutPaid } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fmtDate } from "../lib/dates";
import { isThisMonth } from "../lib/finance";
import { PAYOUT_STATUS_LABELS } from "../lib/labels";
import { fmtMoney } from "../lib/money";
import { PAYOUT_STATUSES, type PayoutDoc, type PayoutStatus, type WithId } from "../lib/types";

const sum = (l: { amount: number }[]) => Math.round(l.reduce((n, p) => n + p.amount, 0) * 1000) / 1000;
const METHODS = ["نقداً", "D17", "تحويل بنكي", "شيك"];

function DueLabel({ p }: { p: PayoutDoc }) {
  if (p.status === "paid") return <span className="text-xs text-muted">دُفع {fmtDate(p.paidAt)}{p.method ? ` · ${p.method}` : ""}</span>;
  if (p.status === "ready" && p.dueAt) {
    const late = p.dueAt.toMillis() < Date.now();
    return <span className={`text-xs font-semibold ${late ? "text-crimson-text" : "text-amber-300"}`}>يُدفع قبل {fmtDate(p.dueAt)}{late ? " · متأخر" : ""}</span>;
  }
  return <span className="text-xs text-muted">بانتظار دفع الزبون</span>;
}

function PayModal({ payout, who, onClose }: { payout: WithId<PayoutDoc>; who: string; onClose: () => void }) {
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    try {
      await markPayoutPaid(payout, method);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <Modal title="تحديد كمدفوع" onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-xl bg-surface-2 p-3.5 text-sm leading-7">
          دفع <b>{fmtMoney(payout.amount)}</b> إلى <b>{who}</b> عن مشروع «{payout.projectTitle}».
        </p>
        <Field label="طريقة الدفع (اختياري)" htmlFor="pay-method">
          <input id="pay-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)} maxLength={100} placeholder="نقداً، D17…" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <button key={m} type="button" className={`rounded-full border px-3.5 py-1.5 text-sm ${method === m ? "border-crimson bg-crimson/15 text-crimson-text" : "border-line text-muted hover:text-fg"}`} onClick={() => setMethod(m)}>
              {m}
            </button>
          ))}
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full" disabled={busy} onClick={confirm}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
          تأكيد الدفع
        </button>
      </div>
    </Modal>
  );
}

/** Director: every payout, with filters, the total ready to pay, and a quick "mark paid". */
export function PayoutsPage() {
  const { payouts, userName, users, loaded } = useData();
  const [params] = useSearchParams();
  const initial = params.get("status");
  const [status, setStatus] = useState<string>(PAYOUT_STATUSES.includes(initial as PayoutStatus) ? (initial as string) : "");
  const [member, setMember] = useState("");
  const [paying, setPaying] = useState<WithId<PayoutDoc> | null>(null);

  const memberIds = useMemo(() => [...new Set(payouts.map((p) => p.memberId))], [payouts]);
  const rows = useMemo(() => {
    const order: Record<PayoutStatus, number> = { ready: 0, awaiting_client_payment: 1, paid: 2 };
    return payouts
      .filter((p) => (!status || p.status === status) && (!member || p.memberId === member))
      .sort((a, b) => order[a.status] - order[b.status] || (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
  }, [payouts, status, member]);

  const ready = sum(payouts.filter((p) => p.status === "ready"));
  const awaiting = sum(payouts.filter((p) => p.status === "awaiting_client_payment"));
  const paidMonth = sum(payouts.filter((p) => p.status === "paid" && p.paidAt && isThisMonth(p.paidAt.toMillis())));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="المستحقات" subtitle={loaded ? `${payouts.length} مستحق` : undefined} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="جاهز للدفع" value={<span data-testid="total-ready">{fmtMoney(ready)}</span>} tone={ready > 0 ? "warn" : "default"} />
        <StatCard label="بانتظار دفع الزبون" value={<span data-testid="total-awaiting">{fmtMoney(awaiting)}</span>} />
        <StatCard label="مدفوع هذا الشهر" value={<span data-testid="total-paid-month">{fmtMoney(paidMonth)}</span>} tone="good" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:max-w-md">
        <Select aria-label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {PAYOUT_STATUSES.map((s) => <option key={s} value={s}>{PAYOUT_STATUS_LABELS[s]}</option>)}
        </Select>
        <Select aria-label="العضو" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">كل الأعضاء</option>
          {memberIds.map((id) => <option key={id} value={id}>{users.find((u) => u.id === id)?.displayName ?? "عضو محذوف"}</option>)}
        </Select>
      </div>

      {loaded && rows.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold">لا توجد مستحقات</p>
          <p className="mt-2 text-sm text-muted">أنشئها من صفحة المشروع بعد تعبئة المالية.</p>
        </div>
      ) : (
        <>
          {/* phones: cards */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((p) => (
              <li key={p.id} data-testid="payout-row" className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{userName(p.memberId)}</p>
                    <Link to={`/projects/${p.projectId}`} className="mt-0.5 block truncate text-sm text-muted hover:underline">{p.projectTitle} · {PAYOUT_TYPE_LABELS[p.type]}</Link>
                  </div>
                  <b className="whitespace-nowrap text-lg">{fmtMoney(p.amount)}</b>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <PayoutStatusBadge status={p.status} />
                  <DueLabel p={p} />
                </div>
                {p.status === "ready" && (
                  <button className="btn-primary mt-3 min-h-10 w-full text-sm" onClick={() => setPaying(p)}>
                    <Banknote className="size-4" aria-hidden /> تحديد كمدفوع
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* desktop: table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2/50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">العضو</th>
                  <th className="px-3 py-3 text-start font-semibold">المشروع</th>
                  <th className="px-3 py-3 text-start font-semibold">المبلغ</th>
                  <th className="px-3 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-3 py-3 text-start font-semibold">الاستحقاق</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} data-testid="payout-row">
                    <td className="px-4 py-3 font-bold">{userName(p.memberId)}</td>
                    <td className="px-3 py-3 text-muted">
                      <Link to={`/projects/${p.projectId}`} className="hover:underline">{p.projectTitle}</Link>
                      <span className="text-xs"> · {PAYOUT_TYPE_LABELS[p.type]}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold">{fmtMoney(p.amount)}</td>
                    <td className="px-3 py-3"><PayoutStatusBadge status={p.status} /></td>
                    <td className="px-3 py-3"><DueLabel p={p} /></td>
                    <td className="px-3 py-3 text-end">
                      {p.status === "ready" && (
                        <button className="btn-primary min-h-9 px-3 text-sm" onClick={() => setPaying(p)}>تحديد كمدفوع</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {paying && <PayModal payout={paying} who={userName(paying.memberId)} onClose={() => setPaying(null)} />}
    </div>
  );
}

/** Every member: ONLY their own payouts — never prices, other members' amounts or margins. */
export function MyPayoutsPage() {
  const { profile } = useAuth();
  const { payouts, loaded } = useData();
  const mine = payouts.filter((p) => p.memberId === profile!.id);
  const awaiting = mine.filter((p) => p.status === "awaiting_client_payment");
  const ready = mine.filter((p) => p.status === "ready");
  const paid = mine.filter((p) => p.status === "paid").sort((a, b) => (b.paidAt?.toMillis() ?? 0) - (a.paidAt?.toMillis() ?? 0));
  const paidMonth = sum(paid.filter((p) => p.paidAt && isThisMonth(p.paidAt.toMillis())));

  const group = (title: string, icon: React.ReactNode, list: WithId<PayoutDoc>[], testid: string) =>
    list.length > 0 && (
      <section aria-label={title} data-testid={testid} className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">{icon}{title}<span className="text-sm font-medium text-muted">({list.length})</span></h2>
        <ul className="space-y-2.5">
          {list.map((p) => (
            <li key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{p.projectTitle}</p>
                  <p className="mt-0.5 text-sm text-muted">{PAYOUT_TYPE_LABELS[p.type]}</p>
                </div>
                <b className="whitespace-nowrap text-lg">{fmtMoney(p.amount)}</b>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <PayoutStatusBadge status={p.status} />
                <DueLabel p={p} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="مستحقاتي" />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="بانتظار دفع الزبون" value={<span data-testid="my-awaiting">{fmtMoney(sum(awaiting))}</span>} />
        <StatCard label="جاهز للدفع" value={<span data-testid="my-ready">{fmtMoney(sum(ready))}</span>} tone={ready.length ? "warn" : "default"} />
        <StatCard label="مدفوع هذا الشهر" value={<span data-testid="my-paid-month">{fmtMoney(paidMonth)}</span>} tone="good" />
      </div>
      {loaded && mine.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold">لا توجد مستحقات بعد</p>
          <p className="mt-2 text-sm text-muted">تظهر هنا مستحقاتك عندما ينشئها المخرج.</p>
        </div>
      ) : (
        <>
          {group("جاهزة للدفع", <Clock className="size-5 text-amber-300" aria-hidden />, ready, "group-ready")}
          {group("بانتظار دفع الزبون", <Wallet className="size-5 text-muted" aria-hidden />, awaiting, "group-awaiting")}
          {group("مدفوعة", <CheckCircle2 className="size-5 text-emerald-300" aria-hidden />, paid, "group-paid")}
        </>
      )}
    </div>
  );
}
