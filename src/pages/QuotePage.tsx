import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { ArrowRight, CheckCircle2, CopyPlus, Loader2, Lock, Plus, Printer, Send, Trash2 } from "lucide-react";
import { useData } from "../context/DataContext";
import { useProjectClient, useQuoteVersions } from "../hooks/useProjectClient";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { Field } from "../components/Forms";
import { acceptQuote, createQuoteVersion, deleteQuoteDraft, publishQuote, saveQuoteDraft, type QuoteInput } from "../lib/clientActions";
import { errorMessage } from "../lib/authErrors";
import { fmtDate, fromInputDate, toInputDate } from "../lib/dates";
import { fmtMoney, parseMoney } from "../lib/money";
import { FORMATS, answerFor, quoteTotal } from "../lib/portal";
import type { Deliverable, FinanceSettings, QuoteStatus, QuoteVersionDoc, WithId } from "../lib/types";

const STATUS: Record<QuoteStatus, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "border-line bg-surface-2 text-muted" },
  sent: { label: "مُرسلة للزبون", cls: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  accepted: { label: "مقبولة", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  superseded: { label: "مُستبدلة", cls: "border-line bg-surface-2 text-muted line-through" },
};

const DAY = 86_400_000;
const blankDeliverable = (): Deliverable => ({ title: "", durationSec: 30, formats: ["9:16"], language: "الدارجة التونسية" });

function defaults(s: FinanceSettings): QuoteInput {
  return {
    deliverables: [{ ...blankDeliverable(), title: "فيديو إعلاني" }],
    price: 0,
    depositAmount: 0,
    deliveryDate: null,
    revisionsIncluded: s.includedRevisions,
    extraRevisionPrice: s.extraRevisionPrice,
    confidential: false,
    confidentialityPrice: s.confidentialityPrice,
    paymentTerms: `عربون ${s.depositPercent}% عند قبول العرض (يغطي تكاليف أدوات الإنتاج ويُدفع قبل بدء العمل)، والباقي عند التسليم النهائي.`,
    validUntil: Timestamp.fromMillis(Date.now() + s.quoteValidityDays * DAY),
  };
}

const toInput = (q: QuoteVersionDoc): QuoteInput => ({
  deliverables: q.deliverables, price: q.price, depositAmount: q.depositAmount, deliveryDate: q.deliveryDate,
  revisionsIncluded: q.revisionsIncluded, extraRevisionPrice: q.extraRevisionPrice, confidential: q.confidential,
  confidentialityPrice: q.confidentialityPrice, paymentTerms: q.paymentTerms, validUntil: q.validUntil,
});

/** Editable form for a DRAFT version. */
function DraftEditor({ projectId, q, settings }: { projectId: string; q: WithId<QuoteVersionDoc>; settings: FinanceSettings }) {
  const [d, setD] = useState<QuoteInput>(toInput(q));
  const [price, setPrice] = useState(String(q.price || ""));
  const [deposit, setDeposit] = useState(String(q.depositAmount || ""));
  const [extra, setExtra] = useState(String(q.extraRevisionPrice));
  const [conf, setConf] = useState(String(q.confidentialityPrice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const p = parseMoney(price), dep = parseMoney(deposit), x = parseMoney(extra), c = parseMoney(conf);
  const total = quoteTotal({ price: p ?? 0, confidential: d.confidential, confidentialityPrice: c ?? 0 });
  const suggestedDeposit = Math.round((total * settings.depositPercent) / 100);
  const set = (patch: Partial<QuoteInput>) => { setD((v) => ({ ...v, ...patch })); setSaved(false); };
  const setDel = (i: number, patch: Partial<Deliverable>) => set({ deliverables: d.deliverables.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const save = async () => {
    if ([p, dep, x, c].includes(null)) return setError("تحقق من المبالغ: أرقام فقط.");
    if (d.deliverables.some((x) => !x.title.trim())) return setError("اكتب عنوان كل مُخرَج.");
    setBusy(true); setError(null);
    try {
      await saveQuoteDraft(projectId, q.version, { ...d, price: p!, depositAmount: dep!, extraRevisionPrice: x!, confidentialityPrice: c!, deliverables: d.deliverables.map((x) => ({ ...x, title: x.title.trim(), language: x.language.trim() })) });
      setSaved(true);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-bold">المُخرَجات</h2>
        <ul className="space-y-3">
          {d.deliverables.map((x, i) => (
            <li key={i} data-testid="deliverable" className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <Field label="العنوان" htmlFor={`dl-title-${i}`}>
                  <input id={`dl-title-${i}`} className="input" value={x.title} onChange={(e) => setDel(i, { title: e.target.value })} maxLength={120} />
                </Field>
                <Field label="المدة (ثانية)" htmlFor={`dl-dur-${i}`}>
                  <input id={`dl-dur-${i}`} inputMode="numeric" dir="ltr" className="input input-ltr" value={String(x.durationSec)} onChange={(e) => setDel(i, { durationSec: Math.min(3600, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                </Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="label">المقاسات</span>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((f) => {
                      const on = x.formats.includes(f);
                      return (
                        <button key={f} type="button" aria-pressed={on} onClick={() => setDel(i, { formats: on ? x.formats.filter((y) => y !== f) : [...x.formats, f] })}
                          className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${on ? "border-crimson bg-crimson/15 text-crimson-text" : "border-line text-muted"}`}>
                          <bdi dir="ltr">{f}</bdi>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="اللغة / اللهجة" htmlFor={`dl-lang-${i}`}>
                  <input id={`dl-lang-${i}`} className="input" value={x.language} onChange={(e) => setDel(i, { language: e.target.value })} maxLength={60} />
                </Field>
              </div>
              {d.deliverables.length > 1 && (
                <button className="mt-3 inline-flex items-center gap-1.5 text-sm text-crimson-text hover:underline" onClick={() => set({ deliverables: d.deliverables.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" aria-hidden /> حذف هذا المُخرَج
                </button>
              )}
            </li>
          ))}
        </ul>
        <button className="btn-ghost mt-3 min-h-10 px-3.5 text-sm" onClick={() => set({ deliverables: [...d.deliverables, blankDeliverable()] })}>
          <Plus className="size-4" aria-hidden /> إضافة مُخرَج
        </button>
      </section>

      <section className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <Field label="السعر (د.ت)" htmlFor="q-price">
          <input id="q-price" inputMode="decimal" dir="ltr" className="input input-ltr" value={price} onChange={(e) => { setPrice(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="العربون (د.ت)" htmlFor="q-deposit" hint={<>المقترح: {settings.depositPercent}% = {fmtMoney(suggestedDeposit)} <button type="button" className="font-semibold text-crimson-text hover:underline" onClick={() => { setDeposit(String(suggestedDeposit)); setSaved(false); }}>استعمال</button></>}>
          <input id="q-deposit" inputMode="decimal" dir="ltr" className="input input-ltr" value={deposit} onChange={(e) => { setDeposit(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="تاريخ التسليم" htmlFor="q-delivery">
          <input id="q-delivery" type="date" dir="ltr" className="input input-ltr" value={toInputDate(d.deliveryDate)} onChange={(e) => set({ deliveryDate: fromInputDate(e.target.value) })} />
        </Field>
        <Field label="صالح حتى" htmlFor="q-valid">
          <input id="q-valid" type="date" dir="ltr" className="input input-ltr" value={toInputDate(d.validUntil)} onChange={(e) => set({ validUntil: fromInputDate(e.target.value) ?? d.validUntil })} />
        </Field>
        <Field label="جولات التعديل المشمولة" htmlFor="q-rev">
          <input id="q-rev" inputMode="numeric" dir="ltr" className="input input-ltr" value={String(d.revisionsIncluded)} onChange={(e) => set({ revisionsIncluded: Math.min(50, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
        </Field>
        <Field label="سعر كل جولة إضافية (د.ت)" htmlFor="q-extra" hint="+ تكلفة الأدوات الفعلية لتلك الجولة">
          <input id="q-extra" inputMode="decimal" dir="ltr" className="input input-ltr" value={extra} onChange={(e) => { setExtra(e.target.value); setSaved(false); }} />
        </Field>
      </section>

      <section className="rounded-xl border border-line bg-surface-2 p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input id="q-conf" type="checkbox" className="mt-1 size-5 accent-[#C8102E]" checked={d.confidential} onChange={(e) => set({ confidential: e.target.checked })} />
          <span>
            <span className="block font-semibold">سرية: عدم عرض الفيديو في أعمال DragonVision</span>
            <span className="text-sm text-muted">افتراضياً يحق لنا عرض الفيديو النهائي في معرض أعمالنا. يمكن للزبون دفع مبلغ إضافي لإبقائه سرياً.</span>
          </span>
        </label>
        <div className="mt-3 max-w-xs">
          <Field label="سعر السرية (د.ت)" htmlFor="q-conf-price">
            <input id="q-conf-price" inputMode="decimal" dir="ltr" className="input input-ltr" value={conf} onChange={(e) => { setConf(e.target.value); setSaved(false); }} />
          </Field>
        </div>
      </section>

      <Field label="شروط الدفع" htmlFor="q-terms">
        <textarea id="q-terms" className="input h-auto min-h-24 py-3 leading-7" value={d.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} maxLength={3000} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
        <span className="text-sm text-muted">المجموع{d.confidential ? " (مع السرية)" : ""}</span>
        <b data-testid="quote-total" className="text-xl">{fmtMoney(total)}</b>
      </div>

      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />} حفظ المسودة
        </button>
        {saved && <span role="status" className="text-sm text-emerald-300">تم الحفظ ✓</span>}
      </div>
    </div>
  );
}

/** Read-only summary for sent / accepted / superseded versions. */
function QuoteSummary({ q }: { q: QuoteVersionDoc }) {
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm"><span className="text-muted">{k}</span><span className="text-end font-semibold">{v}</span></div>
  );
  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface-2 px-4">
      {row("المُخرَجات", q.deliverables.map((d) => d.title).join("، "))}
      {row("السعر", fmtMoney(q.price))}
      {q.confidential && row("السرية", fmtMoney(q.confidentialityPrice))}
      {row("المجموع", fmtMoney(quoteTotal(q)))}
      {row("العربون", fmtMoney(q.depositAmount))}
      {row("التسليم", q.deliveryDate ? fmtDate(q.deliveryDate) : "—")}
      {row("جولات التعديل المشمولة", q.revisionsIncluded)}
      {row("صالح حتى", fmtDate(q.validUntil))}
    </div>
  );
}

export function QuotePage() {
  const { projectId } = useParams();
  const { projects, finances, financeSettings, loaded } = useData();
  const project = projects.find((p) => p.id === projectId);
  const versions = useQuoteVersions(projectId);
  const client = useProjectClient(projectId);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const latest = versions?.[versions.length - 1];
  useEffect(() => { if (latest && selected === null) setSelected(latest.version); }, [latest, selected]);
  const q = useMemo(() => versions?.find((v) => v.version === selected), [versions, selected]);

  if (!project || versions === null) {
    return loaded && !project ? <p className="card p-8 text-center">المشروع غير موجود.</p> : <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted" aria-label="جارٍ التحميل" /></div>;
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const newVersion = (from?: QuoteVersionDoc) =>
    run(async () => {
      const v = (latest?.version ?? 0) + 1;
      const base = from ? { ...toInput(from), validUntil: Timestamp.fromMillis(Date.now() + financeSettings.quoteValidityDays * DAY) } : defaults(financeSettings);
      await createQuoteVersion(project.id, v, base);
      setSelected(v);
    });

  const answer = q ? answerFor(client.responses, "quote", q.version) : undefined;
  const portalHasThis = client.active?.items.quote?.version === q?.version;

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/projects/${project.id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> {project.title}
      </Link>
      <PageHeader title="عرض السعر" subtitle={`${project.title} — ${project.clientName}`} />

      {versions.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-lg font-bold">لا يوجد عرض سعر بعد</p>
          <p className="mt-2 text-sm text-muted">يبدأ العرض بالقيم الافتراضية من الإعدادات ويمكنك تعديلها.</p>
          <button className="btn-primary mt-6" disabled={busy} onClick={() => newVersion()}>
            <Plus className="size-5" aria-hidden /> إنشاء عرض سعر
          </button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="نسخ العرض" className="mb-4 flex flex-wrap gap-2">
            {versions.map((v) => (
              <button key={v.version} role="tab" aria-selected={v.version === selected} onClick={() => setSelected(v.version)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${v.version === selected ? "border-crimson bg-crimson/10" : "border-line"}`}>
                النسخة {v.version}
                <span className={`badge ${STATUS[v.status].cls}`}>{STATUS[v.status].label}</span>
              </button>
            ))}
          </div>

          {q && (
            <section className="card space-y-5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-extrabold">
                  النسخة {q.version}
                  {q.status !== "draft" && <span className="badge border-line bg-surface-2 text-muted"><Lock className="size-3" aria-hidden /> مقفلة</span>}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/projects/${project.id}/quote/print/${q.version}`} target="_blank" className="btn-ghost min-h-10 px-3.5 text-sm">
                    <Printer className="size-4" aria-hidden /> طباعة / PDF
                  </Link>
                  {q.status !== "draft" && q.version === latest?.version && (
                    <button className="btn-ghost min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => newVersion(q)}>
                      <CopyPlus className="size-4" aria-hidden /> نسخة جديدة للتعديل
                    </button>
                  )}
                  {q.status === "draft" && versions.length > 1 && (
                    <button className="btn-danger min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => run(async () => { await deleteQuoteDraft(project.id, q.version); setSelected(null); })}>
                      <Trash2 className="size-4" aria-hidden /> حذف المسودة
                    </button>
                  )}
                </div>
              </div>

              {q.status === "draft" ? <DraftEditor key={q.version} projectId={project.id} q={q} settings={financeSettings} /> : <QuoteSummary q={q} />}

              {/* client decision on this version */}
              {answer?.decision === "approved" && q.status === "sent" && (
                <div data-testid="quote-approved" className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                  <p className="font-bold text-emerald-300">وافق الزبون على هذه النسخة: «{answer.name}» · {fmtDate(answer.createdAt)}</p>
                  <p className="mt-1 text-sm text-muted">عند التأكيد تُقفل النسخة كمقبولة ويُملأ سعر المشروع ({fmtMoney(quoteTotal(q))}) والعربون في المالية.</p>
                  <button className="btn-primary mt-3" disabled={busy} onClick={() => run(() => acceptQuote(project.id, q, answer.name, versions, finances[project.id]))}>
                    <CheckCircle2 className="size-5" aria-hidden /> تأكيد القبول وتعبئة المالية
                  </button>
                </div>
              )}
              {answer?.decision === "changes_requested" && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-7">
                  <p className="font-bold text-amber-300">طلب الزبون تعديلات على هذه النسخة ({answer.name}):</p>
                  <p className="whitespace-pre-wrap">{answer.comment}</p>
                </div>
              )}
              {q.status === "accepted" && (
                <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-300">
                  مقبولة — {q.acceptedBy} · {fmtDate(q.acceptedAt)}. سعر المشروع في المالية: {fmtMoney(finances[project.id]?.price ?? quoteTotal(q))}
                </p>
              )}

              {/* publish to the client portal */}
              {(q.status === "draft" || q.status === "sent") && !answer && (
                <div className="space-y-3 border-t border-line pt-5">
                  <h3 className="text-sm font-bold text-muted">إرسال للزبون عبر البوابة</h3>
                  {!client.active ? (
                    <p className="text-sm text-muted">لا يوجد رابط بوابة لهذا المشروع. <Link className="font-semibold text-crimson-text hover:underline" to={`/projects/${project.id}/client`}>أنشئ الرابط أولاً</Link>.</p>
                  ) : portalHasThis ? (
                    <p className="text-sm text-sky-300">هذه النسخة منشورة في البوابة وبانتظار رد الزبون.</p>
                  ) : (
                    <>
                      <Field label="ملاحظة للزبون (اختياري)" htmlFor="q-note">
                        <input id="q-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
                      </Field>
                      <button className="btn-primary" disabled={busy || (q.status === "draft" && q.price <= 0)}
                        onClick={() => run(async () => { await publishQuote(project.id, client.active!, q, note, client.stats.used); setNote(""); })}>
                        <Send className="size-5" aria-hidden /> نشر النسخة {q.version} للزبون
                      </button>
                      {q.status === "draft" && <p className="text-xs text-muted">بعد النشر تُقفل هذه النسخة؛ أي تعديل لاحق يحتاج نسخة جديدة. احفظ المسودة قبل النشر.</p>}
                    </>
                  )}
                </div>
              )}
              <ErrorNote>{error}</ErrorNote>
            </section>
          )}
        </>
      )}
    </div>
  );
}
