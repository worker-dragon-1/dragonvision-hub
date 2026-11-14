import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlarmClock, CalendarCheck, ClipboardCheck, MessagesSquare, Wallet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { StatCard } from "../components/MoneyBits";
import { ROLE_LABELS, STAGE_LABELS } from "../lib/labels";
import { fmtMoney, fmtPercent, fmtNumber } from "../lib/money";
import { followUpBucket } from "../lib/prospects";
import { moneyThisMonth, teamPerformance } from "../lib/stats";
import { STAGES } from "../lib/types";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section aria-label={title} className="mb-8">
    <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
    {children}
  </section>
);

const ltr = (s: string) => <bdi dir="ltr">{s}</bdi>;

export function DashboardPage() {
  const { profile } = useAuth();
  const { tasks, projects, prospects, payouts, finances, users, portals, responses, loaded } = useData();

  const now = Date.now();
  const inReview = tasks.filter((t) => t.status === "in_review").length;
  const overdue = tasks.filter((t) => t.status !== "approved" && t.dueDate && t.dueDate.toMillis() < now).length;
  const followUps = prospects.filter((p) => followUpBucket(p) <= 1).length;
  const ready = payouts.filter((p) => p.status === "ready");
  const seenAt = Object.fromEntries(portals.map((p) => [p.id, p.responsesSeenAt?.toMillis() ?? 0]));
  const newResponses = responses.filter((r) => (r.createdAt?.toMillis() ?? Date.now()) > (seenAt[r.token] ?? 0)).length;
  const readyTotal = Math.round(ready.reduce((n, p) => n + p.amount, 0) * 1000) / 1000;

  const perStage = useMemo(() => STAGES.map((s) => ({ stage: s, count: projects.filter((p) => p.stage === s).length })), [projects]);
  const maxCount = Math.max(1, ...perStage.map((x) => x.count));
  const money = useMemo(() => moneyThisMonth(projects, finances, payouts), [projects, finances, payouts]);
  const team = useMemo(() => teamPerformance(tasks, users), [tasks, users]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="لوحة المخرج" subtitle={loaded ? `أهلاً ${profile?.displayName ?? ""}` : undefined} />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Link to="/review" data-testid="card-review" className={`card block p-4 transition-colors hover:border-muted/60 ${inReview ? "border-amber-400/30 bg-amber-400/5" : ""}`}>
          <ClipboardCheck className="mb-2 size-5 text-amber-300" aria-hidden />
          <p className="text-sm text-muted">مهام بانتظار المراجعة</p>
          <p className="mt-1 text-3xl font-extrabold">{inReview}</p>
        </Link>
        <Link to="/tasks?filter=overdue" data-testid="card-overdue" className={`card block p-4 transition-colors hover:border-muted/60 ${overdue ? "border-crimson/40 bg-crimson/5" : ""}`}>
          <AlarmClock className="mb-2 size-5 text-crimson-text" aria-hidden />
          <p className="text-sm text-muted">مهام متأخرة</p>
          <p className="mt-1 text-3xl font-extrabold">{overdue}</p>
        </Link>
        <Link to="/prospects?due=1" data-testid="card-followups" className="card block p-4 transition-colors hover:border-muted/60">
          <CalendarCheck className="mb-2 size-5 text-sky-300" aria-hidden />
          <p className="text-sm text-muted">متابعات اليوم</p>
          <p className="mt-1 text-3xl font-extrabold">{followUps}</p>
        </Link>
        <Link to="/responses" data-testid="card-responses" className={`card block p-4 transition-colors hover:border-muted/60 ${newResponses ? "border-crimson/40 bg-crimson/5" : ""}`}>
          <MessagesSquare className="mb-2 size-5 text-crimson-text" aria-hidden />
          <p className="text-sm text-muted">ردود الزبائن</p>
          <p className="mt-1 text-3xl font-extrabold">{newResponses}</p>
          <p className="mt-0.5 text-xs text-muted">ردود جديدة</p>
        </Link>
        <Link to="/payouts?status=ready" data-testid="card-payouts" className={`card block p-4 transition-colors hover:border-muted/60 ${ready.length ? "border-emerald-400/30 bg-emerald-400/5" : ""}`}>
          <Wallet className="mb-2 size-5 text-emerald-300" aria-hidden />
          <p className="text-sm text-muted">مستحقات جاهزة للدفع</p>
          <p className="mt-1 text-3xl font-extrabold">{ready.length}</p>
          <p data-testid="card-payouts-total" className="mt-0.5 text-sm font-semibold text-muted">{fmtMoney(readyTotal)}</p>
        </Link>
      </div>

      <Section title="المشاريع حسب المرحلة">
        <ul className="card space-y-3 p-4 sm:p-5">
          {perStage.map(({ stage, count }) => (
            <li key={stage}>
              <Link to="/projects" className="flex items-center gap-3 hover:opacity-90" data-testid={`bar-${stage}`}>
                <span className="w-28 shrink-0 text-sm sm:w-36">{STAGE_LABELS[stage]}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-crimson" style={{ width: `${(count / maxCount) * 100}%`, minWidth: count ? "0.75rem" : 0 }} />
                </span>
                <b className="w-6 shrink-0 text-end text-sm">{count}</b>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="المال هذا الشهر">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="الإيرادات المستلمة" value={<span data-testid="money-revenue">{fmtMoney(money.revenue)}</span>} to="/projects" tone="good" />
          <StatCard label="مستحق على الزبائن" value={<span data-testid="money-outstanding">{fmtMoney(money.outstanding)}</span>} to="/projects" tone={money.outstanding > 0 ? "warn" : "default"} />
          <StatCard label="مستحقات مدفوعة" value={<span data-testid="money-paidout">{fmtMoney(money.paidOut)}</span>} to="/payouts?status=paid" />
          <StatCard label="هامش مشاريع مسلَّمة" value={<span data-testid="money-margin">{fmtMoney(money.margin)}</span>} hint="مشاريع سُلّمت هذا الشهر" to="/projects" />
        </div>
      </Section>

      <Section title="أداء الفريق — آخر 30 يوماً">
        <p className="mb-3 text-xs leading-6 text-muted">يقيس العمل المُنجَز والمعتمَد، لا النشاط ولا وقت الاتصال.</p>
        {team.length === 0 ? (
          <p className="card px-4 py-8 text-center text-sm text-muted">لا يوجد أعضاء بعد.</p>
        ) : (
          <>
            <ul className="space-y-2.5 md:hidden">
              {team.map((m) => (
                <li key={m.id} className="card p-4">
                  <p className="font-bold">{m.name} <span className="text-xs font-normal text-muted">· {ROLE_LABELS[m.role]}</span></p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    <div><dt className="text-xs text-muted">مهام منجزة</dt><dd className="font-bold">{m.completed}</dd></div>
                    <div><dt className="text-xs text-muted">في الموعد</dt><dd className="font-bold">{m.onTimePct === null ? "—" : fmtPercent(m.onTimePct)}</dd></div>
                    <div><dt className="text-xs text-muted">متوسط جولات التعديل</dt><dd className="font-bold">{m.avgRounds === null ? "—" : ltr(fmtNumber(m.avgRounds))}</dd></div>
                    <div><dt className="text-xs text-muted">متأخرة الآن</dt><dd className={`font-bold ${m.overdue ? "text-crimson-text" : ""}`}>{m.overdue}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="card hidden overflow-hidden md:block">
              <table data-testid="team-table" className="w-full text-sm">
                <thead className="border-b border-line bg-surface-2/50 text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 text-start font-semibold">العضو</th>
                    <th className="px-3 py-3 text-start font-semibold">مهام منجزة</th>
                    <th className="px-3 py-3 text-start font-semibold">في الموعد</th>
                    <th className="px-3 py-3 text-start font-semibold">جولات التعديل (متوسط)</th>
                    <th className="px-3 py-3 text-start font-semibold">متأخرة الآن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {team.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-bold">{m.name} <span className="text-xs font-normal text-muted">· {ROLE_LABELS[m.role]}</span></td>
                      <td className="px-3 py-3">{m.completed}</td>
                      <td className="px-3 py-3">{m.onTimePct === null ? "—" : fmtPercent(m.onTimePct)}</td>
                      <td className="px-3 py-3">{m.avgRounds === null ? "—" : ltr(fmtNumber(m.avgRounds))}</td>
                      <td className={`px-3 py-3 ${m.overdue ? "font-bold text-crimson-text" : ""}`}>{m.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
