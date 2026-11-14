import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Ban, CheckCircle2, ExternalLink, FileText, Link2, Loader2, MessageCircle, RefreshCw, RotateCcw, Send, Wallet } from "lucide-react";
import { useData } from "../context/DataContext";
import { useProjectClient } from "../hooks/useProjectClient";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field } from "../components/Forms";
import { CopyButton } from "../components/ProspectBits";
import { addExtraRevision, createPortal, markResponsesSeen, publishItem, regeneratePortal, revokePortal, setCountedItems } from "../lib/clientActions";
import { errorMessage } from "../lib/authErrors";
import { fmtDateTime } from "../lib/dates";
import { fmtMoney, parseMoney } from "../lib/money";
import { REVIEW_LABELS, answerFor, portalUrl, whatsappLink, whatsappMessage, type ProjectResponse } from "../lib/portal";
import { REVIEW_ITEMS, type CountedItem, type ReviewItem } from "../lib/types";

export function DecisionBadge({ decision }: { decision: ProjectResponse["decision"] }) {
  return decision === "approved" ? (
    <span className="badge border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-3" aria-hidden /> موافقة</span>
  ) : (
    <span className="badge border-amber-400/30 bg-amber-400/10 text-amber-300"><RotateCcw className="size-3" aria-hidden /> طلب تعديلات</span>
  );
}

export function ResponseCard({ r, highlight, title }: { r: ProjectResponse; highlight?: boolean; title?: React.ReactNode }) {
  return (
    <li data-testid="response" className={`rounded-xl border p-4 ${highlight ? "border-crimson/40 bg-crimson/5" : "border-line bg-surface-2"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{title ?? `${REVIEW_LABELS[r.item]} — النسخة ${r.version}`}</p>
        <DecisionBadge decision={r.decision} />
      </div>
      <p className="mt-1 text-xs text-muted">{r.name} · {fmtDateTime(r.createdAt)}{r.extraRoundAck ? " · وافق على جولة مدفوعة" : ""}{highlight ? " · جديد" : ""}</p>
      {r.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{r.comment}</p>}
    </li>
  );
}

function PublishForm({ item, nextVersion, onPublish }: { item: Exclude<ReviewItem, "quote">; nextVersion: number; onPublish: (v: { title: string; note: string; link: string; text: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button className="btn-ghost min-h-10 px-3.5 text-sm" onClick={() => setOpen(true)}>
        <Send className="size-4" aria-hidden /> نشر النسخة {nextVersion}
      </button>
    );
  }
  const submit = async () => {
    if (!title.trim()) return setError("اكتب عنواناً.");
    if (!link.trim() && !text.trim()) return setError(item === "script" ? "أضف نص السيناريو أو رابطاً." : "أضف رابط المشاهدة.");
    if (link.trim() && !/^https?:\/\/\S+$/.test(link.trim())) return setError("الرابط يجب أن يبدأ بـ https://");
    setBusy(true); setError(null);
    try { await onPublish({ title, note, link, text }); setOpen(false); setTitle(""); setNote(""); setLink(""); setText(""); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
      <Field label="العنوان" htmlFor={`pub-title-${item}`}>
        <input id={`pub-title-${item}`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={`${REVIEW_LABELS[item]} — النسخة ${nextVersion}`} />
      </Field>
      <Field label="ملاحظة للزبون (اختياري)" htmlFor={`pub-note-${item}`}>
        <input id={`pub-note-${item}`} className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      </Field>
      <Field label="الرابط (Google Drive / فيديو)" htmlFor={`pub-link-${item}`}>
        <input id={`pub-link-${item}`} type="url" dir="ltr" className="input input-ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/…" />
      </Field>
      {item === "script" && (
        <Field label="نص السيناريو (اختياري إن وُجد رابط)" htmlFor="pub-text-script">
          <textarea id="pub-text-script" className="input h-auto min-h-32 py-3 leading-7" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} />
        </Field>
      )}
      <p className="text-xs leading-6 text-muted">يرى الزبون العنوان والملاحظة والرابط/النص فقط. النسخة السابقة تُغلق تلقائياً.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={submit}>{busy && <Loader2 className="size-5 animate-spin" aria-hidden />} نشر للزبون</button>
        <button className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}

function PaidRound({ round, fee, onAdd }: { round: number; fee: number; onAdd: (tools: number) => Promise<void> }) {
  const [tools, setTools] = useState("");
  const [busy, setBusy] = useState(false);
  const t = parseMoney(tools);
  return (
    <div data-testid="paid-round" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
      <p className="font-bold text-amber-200">الجولة {round} مدفوعة — تجاوز الزبون الجولات المشمولة</p>
      <p className="mt-1 text-sm text-amber-100/80">أضِف سطر «تعديل إضافي» إلى مالية المشروع: {fmtMoney(fee)} + تكلفة الأدوات الفعلية لهذه الجولة.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Field label="تكلفة الأدوات (د.ت)" htmlFor={`tools-${round}`}>
            <input id={`tools-${round}`} inputMode="decimal" dir="ltr" className="input input-ltr" value={tools} onChange={(e) => setTools(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <button className="btn-primary" disabled={busy || t === null} onClick={async () => { setBusy(true); try { await onAdd(t ?? 0); } finally { setBusy(false); } }}>
          <Wallet className="size-5" aria-hidden /> إضافة إلى المالية ({fmtMoney(fee + (t ?? 0))})
        </button>
      </div>
    </div>
  );
}

/** Director: the client portal of one project. */
export function ClientPage() {
  const { projectId } = useParams();
  const { projects, finances, financeSettings, loaded } = useData();
  const project = projects.find((p) => p.id === projectId);
  const client = useProjectClient(projectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"revoke" | "regenerate" | null>(null);
  // what was "new" when the page opened (we mark everything seen right away)
  const newIds = useRef<Set<string> | null>(null);
  if (newIds.current === null && loaded) newIds.current = new Set(client.unseen.map((r) => `${r.token}/${r.id}`));

  useEffect(() => {
    if (loaded && client.unseen.length) markResponsesSeen(client.portals.map((p) => p.id)).catch(() => undefined);
  }, [loaded, client.unseen.length, client.portals]);

  if (!project) return loaded ? <p className="card p-8 text-center">المشروع غير موجود.</p> : <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted" aria-label="جارٍ التحميل" /></div>;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); setConfirm(null); }
  };
  const active = client.active;
  const finance = finances[project.id];
  const added = new Set((finance?.extraRevisions ?? []).map((x) => x.responseId));
  const { stats } = client;
  const over = stats.used > stats.included;
  const msg = active ? whatsappMessage(active, active.id) : "";

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/projects/${project.id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> {project.title}
      </Link>
      <PageHeader title="بوابة الزبون" subtitle={`${project.clientName} — يرى الزبون فقط ما تنشره هنا`} />
      <ErrorNote>{error}</ErrorNote>

      {/* ── link ── */}
      <section className="card mb-5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Link2 className="size-5 text-crimson-text" aria-hidden /> رابط الزبون</h2>
        {!active ? (
          <>
            <p className="mb-3 text-sm leading-7 text-muted">
              {client.portals.length ? "تم إلغاء الرابط السابق. " : ""}رابط سري لا يحتاج تسجيل دخول: يرى الزبون من خلاله عنوان المشروع وعرض السعر وما تنشره للمراجعة فقط.
            </p>
            <button className="btn-primary" disabled={busy} onClick={() => run(() => createPortal(project, financeSettings, financeSettings.includedRevisions, financeSettings.extraRevisionPrice))}>
              <Link2 className="size-5" aria-hidden /> إنشاء رابط البوابة
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <p data-testid="portal-url" dir="ltr" className="break-all rounded-xl bg-surface-2 px-3.5 py-2.5 text-start font-mono text-xs text-muted">{portalUrl(active.id)}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={portalUrl(active.id)} label="نسخ الرابط" />
              <CopyButton text={msg} label="نسخ رسالة واتساب" />
              <a className="btn-ghost min-h-10 px-3.5 text-sm" href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" aria-hidden /> فتح واتساب</a>
              <a className="btn-ghost min-h-10 px-3.5 text-sm" href={portalUrl(active.id)} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" aria-hidden /> معاينة</a>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <button className="btn-ghost min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => setConfirm("regenerate")}><RefreshCw className="size-4" aria-hidden /> رابط جديد</button>
              <button className="btn-danger min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => setConfirm("revoke")}><Ban className="size-4" aria-hidden /> إلغاء الرابط</button>
            </div>
          </div>
        )}
      </section>

      {/* ── revision rounds ── */}
      <section className="card mb-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">جولات التعديل</h2>
          <b data-testid="revision-counter" className={`text-lg ${over ? "text-amber-300" : ""}`}>جولات التعديل: <bdi dir="ltr">{stats.used} / {stats.included}</bdi></b>
        </div>
        <p className="mt-1 text-sm text-muted">كل طلب تعديل من الزبون على الفيديو النهائي يُحتسب جولة{active?.countedItems.includes("storyboard") ? "، وكذلك الستوريبورد" : ""}.</p>
        {active && (
          <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-5 accent-[#C8102E]" checked={active.countedItems.includes("storyboard")} disabled={busy}
              onChange={(e) => run(() => setCountedItems(active.id, (e.target.checked ? ["final", "storyboard"] : ["final"]) as CountedItem[]))} />
            احتساب طلبات تعديل الستوريبورد أيضاً
          </label>
        )}
        <div className="mt-4 space-y-3">
          {stats.rounds.filter((r) => r.paid).map((r) =>
            added.has(r.id) ? (
              <p key={r.id} className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-300">
                الجولة {r.round} المدفوعة مضافة إلى المالية ({fmtMoney((finance?.extraRevisions ?? []).filter((x) => x.responseId === r.id).reduce((n, x) => n + x.fee + x.toolsCost, 0))}).
              </p>
            ) : (
              <PaidRound key={r.id} round={r.round} fee={client.extraRevisionPrice}
                onAdd={(tools) => run(() => addExtraRevision(project.id, finance, { responseId: r.id, round: r.round, fee: client.extraRevisionPrice, toolsCost: tools }))} />
            ),
          )}
        </div>
      </section>

      {/* ── review items ── */}
      <section className="card mb-5 p-5">
        <h2 className="mb-4 text-lg font-bold">ما يراجعه الزبون</h2>
        <ol className="space-y-4">
          {REVIEW_ITEMS.map((item, i) => {
            const it = active?.items[item];
            const ans = it ? answerFor(client.responses, item, it.version) : undefined;
            return (
              <li key={item} data-testid={`item-${item}`} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold"><span className="text-muted">{i + 1}.</span> {REVIEW_LABELS[item]}{it ? ` — النسخة ${it.version}` : ""}</p>
                  {!it ? <span className="badge border-line bg-surface-2 text-muted">لم يُنشر</span> : ans ? <DecisionBadge decision={ans.decision} /> : <span className="badge border-sky-400/30 bg-sky-400/10 text-sky-300">بانتظار الزبون</span>}
                </div>
                {it && <p className="mt-1 text-sm text-muted">{it.title}</p>}
                {ans && <p className="mt-2 text-sm"><b>{ans.name}</b> · {fmtDateTime(ans.createdAt)}{ans.comment ? <>: <span className="whitespace-pre-wrap">{ans.comment}</span></> : null}</p>}
                <div className="mt-3">
                  {item === "quote" ? (
                    <Link to={`/projects/${project.id}/quote`} className="btn-ghost min-h-10 px-3.5 text-sm"><FileText className="size-4" aria-hidden /> إدارة عرض السعر</Link>
                  ) : active ? (
                    <PublishForm item={item} nextVersion={(it?.version ?? 0) + 1}
                      onPublish={(v) => publishItem(active, item, v, stats.used).then(() => undefined)} />
                  ) : (
                    <p className="text-xs text-muted">أنشئ الرابط أولاً.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── responses ── */}
      <section className="card p-5" aria-labelledby="resp-h">
        <h2 id="resp-h" className="mb-3 text-lg font-bold">ردود الزبون <span className="text-sm font-medium text-muted">({client.responses.length})</span></h2>
        {client.responses.length === 0 ? (
          <p className="text-sm text-muted">لا توجد ردود بعد.</p>
        ) : (
          <ul className="space-y-2.5">
            {client.responses.map((r) => <ResponseCard key={`${r.token}/${r.id}`} r={r} highlight={newIds.current?.has(`${r.token}/${r.id}`)} />)}
          </ul>
        )}
      </section>

      {confirm && active && (
        <ConfirmDialog
          title={confirm === "revoke" ? "إلغاء رابط الزبون؟" : "إنشاء رابط جديد؟"}
          message={confirm === "revoke" ? "سيتوقف الرابط الحالي فوراً وسيرى من يفتحه «هذا الرابط لم يعد صالحاً»." : "سيتوقف الرابط الحالي فوراً، ويُنشأ رابط جديد بنفس المحتوى. أرسل الرابط الجديد للزبون."}
          confirmLabel={confirm === "revoke" ? "نعم، ألغِ الرابط" : "نعم، رابط جديد"}
          busy={busy}
          onConfirm={() => run(() => (confirm === "revoke" ? revokePortal(active.id) : regeneratePortal(active, client.responses)))}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
