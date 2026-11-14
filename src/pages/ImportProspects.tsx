import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, CopyX, FileUp, Loader2, Wand2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { Field, Select } from "../components/Forms";
import { importProspects } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { LAST_POST_LABELS, RUNNING_ADS_LABELS } from "../lib/labels";
import { IMPORT_EXAMPLE, IMPORT_HEADER, parseImport, planImport } from "../lib/prospects";

export function ImportProspectsPage() {
  const { isDirector, profile } = useAuth();
  const { prospects, users } = useData();
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  const salesMembers = useMemo(() => users.filter((u) => u.active && u.role === "sales"), [users]);
  const rows = useMemo(() => parseImport(text), [text]);
  // exact-name duplicates are checked against the prospects THIS user can see
  const plan = useMemo(() => planImport(rows, prospects.map((p) => p.name)), [rows, prospects]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await importProspects(plan.ready.map((r) => r.data), profile!.id, isDirector ? assignee : profile!.id);
      setDone({ imported: plan.ready.length, skipped: plan.duplicates.length, failed: plan.errors.length });
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/prospects" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> كل الزبائن
      </Link>
      <PageHeader title="استيراد زبائن" subtitle="الصق قائمة بالتنسيق أدناه — السطر الأول هو الترويسة ويُتخطّى." />

      {done && (
        <div role="status" className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          <p className="flex items-center gap-2 font-bold text-emerald-300"><CheckCircle2 className="size-5" aria-hidden /> تم استيراد {done.imported} زبون</p>
          {(done.skipped > 0 || done.failed > 0) && (
            <p className="mt-1 text-sm text-muted">
              {done.skipped > 0 && `تم تخطي ${done.skipped} مكرر. `}
              {done.failed > 0 && `تعذّرت قراءة ${done.failed} سطر.`}
            </p>
          )}
          <Link to="/prospects" className="btn-ghost mt-3 inline-flex min-h-10 px-3.5 text-sm">عرض القائمة</Link>
        </div>
      )}

      <section className="card mb-5 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="imp-text" className="text-sm font-bold">النص</label>
          <button type="button" className="btn-ghost min-h-9 px-3 text-sm" onClick={() => { setText(IMPORT_EXAMPLE); setDone(null); }}>
            <Wand2 className="size-4" aria-hidden /> إدراج مثال
          </button>
        </div>
        <textarea
          id="imp-text"
          className="input h-auto min-h-44 py-3 leading-7"
          value={text}
          onChange={(e) => { setText(e.target.value); setDone(null); }}
          placeholder={IMPORT_HEADER}
          spellCheck={false}
        />
        <ul className="mt-3 space-y-1 text-xs leading-6 text-muted">
          <li>آخر منشور: هذا الأسبوع / هذا الشهر / <bdi dir="ltr">1–3</bdi> أشهر / أكثر من 3 أشهر / الصفحة غير موجودة</li>
          <li>يعلن الآن: نعم / لا / غير واضح</li>
          <li>الجودة: <bdi dir="ltr">1–3</bdi> · الرمز «<bdi dir="ltr">-</bdi>» يعني فارغ</li>
          {!isDirector && <li>يُقارَن الاسم مع الزبائن المسندين إليك فقط.</li>}
        </ul>
        {isDirector && (
          <div className="mt-4 max-w-xs">
            <Field label="إسناد المستوردين إلى" htmlFor="imp-assignee">
              <Select id="imp-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">غير مسند</option>
                {salesMembers.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </Select>
            </Field>
          </div>
        )}
      </section>

      {text.trim() && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">لا توجد أسطر بعد الترويسة.</p>
      )}

      {rows.length > 0 && (
        <section aria-label="معاينة الاستيراد" className="space-y-5">
          <div className="flex flex-wrap gap-2.5 text-sm font-semibold">
            <span data-testid="count-ready" className="badge border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-3.5" aria-hidden /> {plan.ready.length} جاهز</span>
            <span data-testid="count-dup" className="badge border-amber-400/30 bg-amber-400/10 text-amber-300"><CopyX className="size-3.5" aria-hidden /> {plan.duplicates.length} مكرر</span>
            <span data-testid="count-err" className="badge border-crimson/40 bg-crimson/15 text-crimson-text"><AlertTriangle className="size-3.5" aria-hidden /> {plan.errors.length} فشل</span>
          </div>

          {plan.ready.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-lg font-bold">سيُستورد</h2>
              {/* phones: cards */}
              <ul className="space-y-2 md:hidden">
                {plan.ready.map((r) => (
                  <li key={r.line} className="card p-3.5">
                    <p className="font-bold">{r.data.name}</p>
                    <p className="mt-1 text-xs leading-6 text-muted">
                      {r.data.followers.toLocaleString("en-US")} متابع · آخر منشور: {LAST_POST_LABELS[r.data.lastPost]} · يعلن: {RUNNING_ADS_LABELS[r.data.runningAds]} · جودة: {r.data.quality ?? "—"}
                    </p>
                    {r.data.notes && <p className="mt-1 text-sm">{r.data.notes}</p>}
                  </li>
                ))}
              </ul>
              {/* desktop: table */}
              <div className="card hidden overflow-hidden md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-surface-2/50 text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 text-start font-semibold">الاسم</th>
                      <th className="px-3 py-3 text-start font-semibold">المتابعون</th>
                      <th className="px-3 py-3 text-start font-semibold">آخر منشور</th>
                      <th className="px-3 py-3 text-start font-semibold">يعلن</th>
                      <th className="px-3 py-3 text-start font-semibold">الجودة</th>
                      <th className="px-3 py-3 text-start font-semibold">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {plan.ready.map((r) => (
                      <tr key={r.line}>
                        <td className="px-4 py-2.5 font-bold">{r.data.name}</td>
                        <td className="px-3 py-2.5 text-muted">{r.data.followers.toLocaleString("en-US")}</td>
                        <td className="px-3 py-2.5 text-muted">{LAST_POST_LABELS[r.data.lastPost]}</td>
                        <td className="px-3 py-2.5 text-muted">{RUNNING_ADS_LABELS[r.data.runningAds]}</td>
                        <td className="px-3 py-2.5 text-muted">{r.data.quality ?? "—"}</td>
                        <td className="max-w-56 truncate px-3 py-2.5 text-muted">{r.data.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {plan.duplicates.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-lg font-bold">سيُتخطّى (مكرر)</h2>
              <ul className="space-y-2">
                {plan.duplicates.map(({ row, reason }) => (
                  <li key={row.line} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm">
                    <span className="font-bold">{row.data!.name}</span>
                    <span className="text-amber-300">سطر {row.line} · {reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {plan.errors.length > 0 && (
            <div>
              <h2 className="mb-2.5 text-lg font-bold">تعذّرت قراءته</h2>
              <ul className="space-y-2">
                {plan.errors.map((r) => (
                  <li key={r.line} className="rounded-xl border border-crimson/30 bg-crimson/5 px-4 py-3 text-sm">
                    <p className="font-bold text-crimson-text">سطر {r.line}: {r.error}</p>
                    <p className="mt-1.5 break-words text-xs leading-6 text-muted"><bdi>{r.raw}</bdi></p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary w-full sm:w-auto" disabled={busy || plan.ready.length === 0} onClick={confirm}>
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
            استيراد {plan.ready.length} زبون
          </button>
        </section>
      )}
    </div>
  );
}
