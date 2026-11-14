import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Lock, Wallet } from "lucide-react";
import { useData } from "../context/DataContext";
import { Field } from "./Forms";
import { ErrorNote } from "./Bits";
import { PAYOUT_TYPE_LABELS, PayoutStatusBadge } from "./MoneyBits";
import { applyPayoutPlan, markPayoutsReady, saveFinance, type FinanceInput } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fromInputDate, toInputDate } from "../lib/dates";
import {
  CLIENT_STATUS_LABELS, breakdown, clientStatus, financeWarnings, planPayouts,
  type PlanItem,
} from "../lib/finance";
import { ROLE_LABELS } from "../lib/labels";
import { fmtMoney, fmtPercent, parseMoney } from "../lib/money";
import type { ProjectDoc, WithId } from "../lib/types";

const num = (s: string) => parseMoney(s);

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "bad" | "good" }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? "border-t border-line pt-3 text-base font-extrabold" : "text-sm"}`}>
      <span className={strong ? "" : "text-muted"}>{label}</span>
      <span className={`whitespace-nowrap font-bold ${tone === "bad" ? "text-crimson-text" : tone === "good" ? "text-emerald-300" : ""}`}>{value}</span>
    </div>
  );
}

/**
 * DIRECTOR ONLY. Rendered by the project page only for the director, and the data it uses
 * (`finances`, settings) is subscribed to only for the director.
 */
export function FinanceBlock({ project }: { project: WithId<ProjectDoc> }) {
  const { finances, financeSettings, users, payouts } = useData();
  const saved = finances[project.id];

  const members = useMemo(() => users.filter((u) => project.memberIds.includes(u.id)), [users, project.memberIds]);

  const [price, setPrice] = useState(saved ? String(saved.price) : "");
  const [tools, setTools] = useState(saved ? String(saved.toolsCost) : "");
  const [deposit, setDeposit] = useState(saved ? String(saved.depositAmount) : "");
  const [depositDate, setDepositDate] = useState(toInputDate(saved?.depositReceivedAt));
  const [paid, setPaid] = useState(saved ? String(saved.amountPaidByClient) : "");
  const sharesFrom = (doc: typeof saved) =>
    Object.fromEntries(members.map((m) => [m.id, doc?.shares[m.id] ? String(doc.shares[m.id]) : ""]));
  const [shares, setShares] = useState<Record<string, string>>(sharesFrom(saved));
  // The document the form was last loaded from. When the saved document changes underneath
  // (late snapshot on a fresh load, a quote accepted, a paid round added) and the director has
  // no unsaved edits, the form follows it.
  const [base, setBase] = useState(saved);
  const [busy, setBusy] = useState<"save" | "payouts" | "ready" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string[] | null>(null);

  // parsed draft
  const parsed = {
    price: num(price), toolsCost: num(tools), depositAmount: num(deposit), amountPaidByClient: num(paid),
  };
  const shareValues = Object.fromEntries(members.map((m) => [m.id, num(shares[m.id] ?? "")]));
  const invalid = Object.values(parsed).includes(null) || Object.values(shareValues).includes(null);
  const n = (v: number | null) => v ?? 0;
  const draft = {
    price: n(parsed.price),
    toolsCost: n(parsed.toolsCost),
    shares: Object.fromEntries(Object.entries(shareValues).filter(([, v]) => n(v) > 0).map(([k, v]) => [k, n(v)])),
    amountPaidByClient: n(parsed.amountPaidByClient),
    extraRevisions: saved?.extraRevisions ?? [],
  };
  const b = breakdown(draft);
  const warnings = financeWarnings(draft, financeSettings.minProjectPrice);
  const status = clientStatus(b.totalDue, draft.amountPaidByClient);

  const differsFrom = (doc: typeof saved) =>
    !doc ||
    doc.price !== draft.price || doc.toolsCost !== draft.toolsCost || doc.amountPaidByClient !== draft.amountPaidByClient ||
    doc.depositAmount !== n(parsed.depositAmount) || toInputDate(doc.depositReceivedAt) !== depositDate ||
    JSON.stringify(doc.shares) !== JSON.stringify(draft.shares);
  if (saved !== base) {
    const hasEdits = base ? differsFrom(base) : [price, tools, deposit, paid, depositDate, ...Object.values(shares)].some((v) => v !== "");
    if (saved && !hasEdits) {
      setPrice(String(saved.price));
      setTools(String(saved.toolsCost));
      setDeposit(String(saved.depositAmount));
      setDepositDate(toInputDate(saved.depositReceivedAt));
      setPaid(String(saved.amountPaidByClient));
      setShares(sharesFrom(saved));
    }
    setBase(saved);
  }
  const dirty = differsFrom(saved);

  const projectPayouts = payouts.filter((p) => p.projectId === project.id);
  const awaiting = projectPayouts.filter((p) => p.status === "awaiting_client_payment");
  const savedPaidInFull = saved ? clientStatus(saved.price, saved.amountPaidByClient) === "paid" : false;
  const nameOf = (id: string) => users.find((u) => u.id === id)?.displayName ?? "عضو محذوف";

  const run = async (kind: "save" | "payouts" | "ready", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      if (invalid) throw Object.assign(new Error("invalid"), { code: "invalid-number" });
      const input: FinanceInput = {
        price: draft.price,
        toolsCost: draft.toolsCost,
        depositAmount: n(parsed.depositAmount),
        depositReceivedAt: fromInputDate(depositDate),
        amountPaidByClient: draft.amountPaidByClient,
        // no commissions for now — kept in the document only so it stays valid for firestore.rules
        commissionRate: 0,
        salesMemberId: "",
        shares: draft.shares,
      };
      await saveFinance(project.id, input, saved);
      setReport(null);
    });

  const describe = (i: PlanItem) => `${nameOf(i.memberId)} — ${PAYOUT_TYPE_LABELS[i.type]}`;
  const createPayouts = () =>
    run("payouts", async () => {
      if (!saved) return;
      const plan = planPayouts(project.id, saved, payouts);
      await applyPayoutPlan(project.id, project.title, plan);
      const lines: string[] = [];
      for (const i of plan) {
        if (i.action === "create") lines.push(`أُنشئ: ${describe(i)} ${fmtMoney(i.amount)}`);
        else if (i.action === "update") lines.push(`حُدّث: ${describe(i)} من ${fmtMoney(i.from!)} إلى ${fmtMoney(i.amount)}`);
        else if (i.action === "remove") lines.push(`حُذف (لم يعد في الحصص): ${describe(i)} ${fmtMoney(i.amount)}`);
        else if (i.action === "locked") lines.push(`لم يُعدَّل لأنه مدفوع: ${describe(i)} (${fmtMoney(i.from!)} ← ${fmtMoney(i.amount)})`);
        else if (i.action === "kept") lines.push(`يبقى كما هو (مدفوع): ${describe(i)} ${fmtMoney(i.amount)}`);
      }
      const unchanged = plan.filter((i) => i.action === "same").length;
      setReport(lines.length ? [...lines, ...(unchanged ? [`دون تغيير: ${unchanged}`] : [])] : [`لا تغييرات — ${unchanged} مستحق موجود ومطابق.`]);
    });

  const makeReady = () =>
    run("ready", async () => {
      await markPayoutsReady(project.title, projectPayouts, financeSettings.paymentDelayDays);
      setReport([`أصبحت ${awaiting.length} مستحقات جاهزة للدفع (خلال ${financeSettings.paymentDelayDays} أيام).`]);
    });

  return (
    <section aria-labelledby="fin-h" data-testid="finance-block" className="card mb-6 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="fin-h" className="flex items-center gap-2 text-lg font-extrabold">
          <Landmark className="size-5 text-crimson-text" aria-hidden /> المالية
        </h2>
        <span className="badge border-line bg-surface-2 text-muted"><Lock className="size-3" aria-hidden /> للمخرج فقط</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="سعر المشروع (د.ت)" htmlFor="f-price">
          <input id="f-price" inputMode="decimal" dir="ltr" className="input input-ltr" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="تكلفة الأدوات (د.ت)" htmlFor="f-tools">
          <input id="f-tools" inputMode="decimal" dir="ltr" className="input input-ltr" placeholder="0" value={tools} onChange={(e) => setTools(e.target.value)} />
        </Field>
        <Field label="العربون (د.ت)" htmlFor="f-deposit">
          <input id="f-deposit" inputMode="decimal" dir="ltr" className="input input-ltr" placeholder="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </Field>
        <Field label="تاريخ استلام العربون" htmlFor="f-deposit-date">
          <input id="f-deposit-date" type="date" dir="ltr" className="input input-ltr" value={depositDate} onChange={(e) => setDepositDate(e.target.value)} />
        </Field>
        <Field label="ما دفعه الزبون إلى الآن (د.ت)" htmlFor="f-paid" hint="المجموع المستلم، شاملاً العربون.">
          <input id="f-paid" inputMode="decimal" dir="ltr" className="input input-ltr" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </Field>
        <div className="self-start rounded-xl border border-line bg-surface-2 p-3.5">
          <p className="text-xs text-muted">حالة دفع الزبون</p>
          <p data-testid="client-status" className={`mt-1 font-bold ${status === "paid" ? "text-emerald-300" : status === "partial" ? "text-amber-300" : ""}`}>
            {CLIENT_STATUS_LABELS[status]}
          </p>
          {b.totalDue > 0 && status !== "paid" && <p className="mt-0.5 text-xs text-muted">المتبقي: {fmtMoney(Math.max(0, b.totalDue - draft.amountPaidByClient))}</p>}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <h3 className="mb-2 text-sm font-bold text-muted">حصص أعضاء المشروع (د.ت)</h3>
        <p data-testid="shares-hint" className="mb-3 rounded-xl bg-surface-2 p-3 text-xs leading-6 text-muted">
          لدفع مبلغ لأي شخص في هذا المشروع (بمن فيهم مسؤول المبيعات)، أضِفه أولاً كعضو في المشروع، ثم حدّد مبلغه هنا.
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-muted">أضف أعضاء إلى المشروع لتوزيع الحصص عليهم.</p>
        ) : (
          <ul className="space-y-2.5">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <label htmlFor={`share-${m.id}`} className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-semibold">{m.displayName}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[m.role]}</span>
                </label>
                <input
                  id={`share-${m.id}`}
                  inputMode="decimal"
                  dir="ltr"
                  className="input input-ltr !w-32 shrink-0"
                  placeholder="0"
                  value={shares[m.id] ?? ""}
                  onChange={(e) => setShares((s) => ({ ...s, [m.id]: e.target.value }))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* live breakdown */}
      <div data-testid="breakdown" className="mt-5 max-w-lg rounded-xl border border-line bg-surface-2 p-4">
        <Line label="سعر المشروع" value={fmtMoney(draft.price)} />
        {b.extraCount > 0 && <Line label={`تعديلات إضافية مدفوعة (${b.extraCount})`} value={fmtMoney(b.extraTotal)} />}
        <Line label={b.extraCount > 0 ? "تكلفة الأدوات (مع التعديلات الإضافية)" : "تكلفة الأدوات"} value={fmtMoney(-b.allTools)} />
        <Line label="حصص الفريق" value={fmtMoney(-b.sharesTotal)} />
        <Line
          strong
          label={`هامش المخرج${draft.price > 0 ? ` (${fmtPercent(Math.round(b.marginRatio * 1000) / 10)})` : ""}`}
          value={fmtMoney(b.margin)}
          tone={b.margin < 0 ? "bad" : "good"}
        />
      </div>

      {warnings.length > 0 && (
        <ul data-testid="finance-warnings" className="mt-3 space-y-2">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm leading-6 text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        {invalid && <p className="text-sm text-crimson-text">تحقق من الأرقام: أرقام فقط (حتى 3 خانات عشرية) والنسبة بين 0 و100.</p>}
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full sm:w-auto" disabled={busy !== null || invalid || !dirty} onClick={save}>
          {busy === "save" && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {saved ? (dirty ? "حفظ التعديلات المالية" : "محفوظ ✓") : "حفظ المالية"}
        </button>
      </div>

      {/* payouts */}
      <div className="mt-6 border-t border-line pt-5">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold"><Wallet className="size-5 text-crimson-text" aria-hidden /> المستحقات</h3>
        {projectPayouts.length > 0 && (
          <ul data-testid="project-payouts" className="mb-4 space-y-2">
            {projectPayouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
                <span className="font-semibold">{nameOf(p.memberId)} <span className="text-xs font-normal text-muted">· {PAYOUT_TYPE_LABELS[p.type]}</span></span>
                <span className="flex items-center gap-2.5"><b>{fmtMoney(p.amount)}</b><PayoutStatusBadge status={p.status} /></span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2.5">
          <button className="btn-ghost" disabled={busy !== null || !saved || dirty} onClick={createPayouts}>
            {busy === "payouts" && <Loader2 className="size-5 animate-spin" aria-hidden />}
            إنشاء المستحقات
          </button>
          {awaiting.length > 0 && (
            <button className="btn-primary" disabled={busy !== null || !savedPaidInFull || dirty} onClick={makeReady}>
              {busy === "ready" && <Loader2 className="size-5 animate-spin" aria-hidden />}
              <CheckCircle2 className="size-5" aria-hidden /> الزبون دفع كامل المبلغ — اجعل المستحقات جاهزة
            </button>
          )}
        </div>
        {saved && dirty && <p className="mt-2 text-xs text-muted">احفظ التعديلات المالية أولاً.</p>}
        {awaiting.length > 0 && !savedPaidInFull && <p className="mt-2 text-xs text-muted">تصبح المستحقات جاهزة بعد أن يدفع الزبون كامل المبلغ (تُسجَّل في «ما دفعه الزبون»).</p>}
        {report && (
          <ul data-testid="payout-report" className="mt-3 space-y-1.5 rounded-xl border border-line bg-surface-2 p-3.5 text-sm leading-6">
            {report.map((l) => <li key={l}>{l}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
