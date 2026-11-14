import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarCheck, FileUp, MessageSquareText, Plus, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { FollowUpLabel, OutreachBadge, PriorityBadge, overdueText } from "../components/ProspectBits";
import { ProspectFormModal } from "../components/ProspectForm";
import { Select } from "../components/Forms";
import { OUTREACH_LABELS } from "../lib/labels";
import { compareProspects, followUpBucket, normalizeName } from "../lib/prospects";
import { OUTREACH_STATUSES, type ProspectDoc, type WithId } from "../lib/types";

function TodaySection({ list }: { list: WithId<ProspectDoc>[] }) {
  const { isDirector } = useAuth();
  const { userName } = useData();
  const due = useMemo(
    () =>
      list
        .filter((p) => followUpBucket(p) <= 1)
        .sort((a, b) => followUpBucket(a) - followUpBucket(b) || a.nextFollowUp!.toMillis() - b.nextFollowUp!.toMillis()),
    [list],
  );
  return (
    <section aria-labelledby="today-h" className="card mb-6 p-4 md:p-5">
      <h2 id="today-h" className="mb-3 flex items-center gap-2 text-lg font-bold">
        <CalendarCheck className="size-5 text-crimson-text" aria-hidden />
        متابعات اليوم
        {due.length > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-crimson px-1.5 text-xs font-bold leading-6 text-white">{due.length}</span>}
      </h2>
      {due.length === 0 ? (
        <p className="text-sm text-muted">لا توجد متابعات متأخرة أو مستحقة اليوم 👌</p>
      ) : (
        <ul className="divide-y divide-line">
          {due.map((p) => {
            const late = followUpBucket(p) === 0;
            return (
              <li key={p.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                  <Link to={`/prospects/${p.id}`} className="font-bold after:absolute after:inset-0 hover:underline">
                    {p.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {[p.city, p.sector].filter(Boolean).join(" · ") || "—"}
                    {isDirector && ` · ${p.assigneeId ? userName(p.assigneeId) : "غير مسند"}`}
                  </p>
                </div>
                <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${late ? "bg-crimson/15 text-crimson-text" : "bg-amber-400/15 text-amber-300"}`}>
                  {late ? overdueText(p.nextFollowUp!) : "اليوم"}
                </span>
                <OutreachBadge status={p.outreachStatus} />
                <PriorityBadge prospect={p} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProspectsPage() {
  const { isDirector } = useAuth();
  const { prospects, users, userName, loaded } = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [onlyDue, setOnlyDue] = useState(params.get("due") === "1");
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [sector, setSector] = useState("");
  const [assignee, setAssignee] = useState("");

  const cities = useMemo(() => [...new Set(prospects.map((p) => p.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [prospects]);
  const sectors = useMemo(() => [...new Set(prospects.map((p) => p.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [prospects]);
  const salesMembers = users.filter((u) => u.role === "sales");

  const rows = useMemo(() => {
    const needle = normalizeName(q);
    return prospects
      .filter(
        (p) =>
          (!onlyDue || followUpBucket(p) <= 1) &&
          (!needle || normalizeName(p.name).includes(needle)) &&
          (!status || p.outreachStatus === status) &&
          (!city || p.city === city) &&
          (!sector || p.sector === sector) &&
          (!assignee || (assignee === "none" ? !p.assigneeId : p.assigneeId === assignee)),
      )
      .sort(compareProspects);
  }, [prospects, q, status, city, sector, assignee, onlyDue]);

  const filtered = !!(q || status || city || sector || assignee || onlyDue);

  return (
    <>
      <PageHeader
        title="الزبائن المحتملون"
        subtitle={loaded ? `${prospects.length} زبون${filtered ? ` · ${rows.length} بعد التصفية` : ""}` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/templates" className="btn-ghost min-h-10 px-3.5 text-sm">
              <MessageSquareText className="size-4" aria-hidden /> القوالب
            </Link>
            <Link to="/prospects/import" className="btn-ghost min-h-10 px-3.5 text-sm">
              <FileUp className="size-4" aria-hidden /> استيراد
            </Link>
            <button className="btn-primary min-h-10 px-4 text-sm" onClick={() => setCreating(true)}>
              <Plus className="size-5" aria-hidden /> زبون جديد
            </button>
          </div>
        }
      />

      <TodaySection list={prospects} />

      <div className={`mb-4 grid grid-cols-2 gap-2.5 ${isDirector ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <div className="relative col-span-2 md:col-span-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="input ps-9" placeholder="بحث بالاسم" aria-label="بحث بالاسم" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="حالة التواصل" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>{OUTREACH_LABELS[s]}</option>
          ))}
        </Select>
        <Select aria-label="المدينة" value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">كل المدن</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select aria-label="المجال" className={isDirector ? "" : "col-span-2 md:col-span-1"} value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">كل المجالات</option>
          {sectors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        {isDirector && (
          <Select aria-label="المسؤول" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">كل المسؤولين</option>
            <option value="none">غير مسند</option>
            {salesMembers.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </Select>
        )}
      </div>

      {onlyDue && (
        <p className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
          <span>يعرض المتابعات المتأخرة والمستحقة اليوم فقط.</span>
          <button className="font-bold underline" onClick={() => setOnlyDue(false)}>عرض الكل</button>
        </p>
      )}
      {loaded && rows.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold">{filtered ? "لا نتائج مطابقة" : "لا يوجد زبائن محتملون بعد"}</p>
          <p className="mt-2 text-sm text-muted">
            {filtered ? "غيّر الفلاتر أو البحث." : "أضف زبوناً، أو الصق قائمة عبر «استيراد»."}
          </p>
        </div>
      ) : (
        <>
          {/* phones: cards */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="card relative p-4 transition-colors hover:border-muted/50">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/prospects/${p.id}`} className="min-w-0 flex-1 text-[0.95rem] font-bold leading-6 after:absolute after:inset-0">
                    {p.name}
                  </Link>
                  <PriorityBadge prospect={p} />
                </div>
                <p className="mt-0.5 text-sm text-muted">{[p.city, p.sector].filter(Boolean).join(" · ") || "—"}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <OutreachBadge status={p.outreachStatus} />
                  <FollowUpLabel prospect={p} />
                </div>
                {isDirector && <p className="mt-2 text-xs text-muted">المسؤول: {p.assigneeId ? userName(p.assigneeId) : "غير مسند"}</p>}
              </li>
            ))}
          </ul>

          {/* desktop: compact table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2/50 text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 text-start font-semibold">الاسم</th>
                  <th className="px-3 py-3 text-start font-semibold">المدينة</th>
                  <th className="px-3 py-3 text-start font-semibold">المجال</th>
                  <th className="px-3 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-3 py-3 text-start font-semibold">الأولوية</th>
                  <th className="px-3 py-3 text-start font-semibold">المتابعة</th>
                  {isDirector && <th className="px-3 py-3 text-start font-semibold">المسؤول</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => navigate(`/prospects/${p.id}`)} className="cursor-pointer transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-3 font-bold">
                      <Link to={`/prospects/${p.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted">{p.city || "—"}</td>
                    <td className="px-3 py-3 text-muted">{p.sector || "—"}</td>
                    <td className="px-3 py-3"><OutreachBadge status={p.outreachStatus} /></td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><PriorityBadge prospect={p} /></td>
                    <td className="px-3 py-3"><FollowUpLabel prospect={p} /></td>
                    {isDirector && <td className="px-3 py-3 text-muted">{p.assigneeId ? userName(p.assigneeId) : "غير مسند"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {creating && (
        <ProspectFormModal
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            navigate(`/prospects/${id}`);
          }}
        />
      )}
    </>
  );
}
