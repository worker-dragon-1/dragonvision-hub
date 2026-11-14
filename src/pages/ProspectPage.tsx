import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import {
  ArrowRight, Building2, CalendarClock, CalendarPlus, ExternalLink, Globe, FolderPlus, Loader2, MapPin,
  MessageCircle, MessageSquareText, Pencil, Phone, Search, Send, StickyNote, Trash2, Users, Handshake, Link2, type LucideIcon,
} from "lucide-react";
import { db } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { ErrorNote } from "../components/Bits";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field, NewProjectModal, Select } from "../components/Forms";
import { ProspectFormModal } from "../components/ProspectForm";
import { CopyButton, FollowUpLabel, OutreachBadge, PriorityBadge } from "../components/ProspectBits";
import { addActivity, deleteProspect, updateProspect } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fmtDateTime, fromInputDate } from "../lib/dates";
import { ACTIVITY_LABELS, CHANNEL_LABELS, LAST_POST_LABELS, OUTREACH_LABELS, RUNNING_ADS_LABELS } from "../lib/labels";
import { adLibraryUrl, fillTemplate, nextStatuses } from "../lib/prospects";
import { ACTIVITY_TYPES, CHANNELS, COL, type ActivityDoc, type ActivityType, type Channel, type OutreachStatus, type WithId } from "../lib/types";
import { isHttpUrl } from "../lib/workflow";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  message: MessageCircle,
  call: Phone,
  visit: MapPin,
  meeting: Handshake,
  note: StickyNote,
};

const DEFAULT_CHANNEL: Record<ActivityType, Channel> = {
  message: "facebook",
  call: "phone",
  visit: "in_person",
  meeting: "in_person",
  note: "phone",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{children}</dd>
    </div>
  );
}

export function ProspectPage() {
  const { prospectId } = useParams();
  const navigate = useNavigate();
  const { isDirector, profile } = useAuth();
  const { prospects, projects, templates, users, userName, loaded } = useData();
  const prospect = prospects.find((p) => p.id === prospectId);
  const project = projects.find((p) => p.id === prospect?.projectId);
  const salesMembers = useMemo(() => users.filter((u) => u.active && u.role === "sales"), [users]);

  const [activities, setActivities] = useState<WithId<ActivityDoc>[]>([]);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState<"offer" | "manual" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lostAsk, setLostAsk] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // activity form
  const [aType, setAType] = useState<ActivityType>("message");
  const [aChannel, setAChannel] = useState<Channel>("facebook");
  const [aText, setAText] = useState("");
  const [aStatus, setAStatus] = useState<OutreachStatus | "">("");
  const [aStatusTouched, setAStatusTouched] = useState(false);
  const [aFollow, setAFollow] = useState("");
  const [aBusy, setABusy] = useState(false);
  const [aError, setAError] = useState<string | null>(null);

  useEffect(() => {
    if (!prospectId) return;
    return onSnapshot(
      collection(db, COL.prospects, prospectId, COL.activities),
      (snap) => setActivities(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ActivityDoc) }))),
      (err) => setError(errorMessage(err)),
    );
  }, [prospectId]);

  const timeline = useMemo(
    () => [...activities].sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now())),
    [activities],
  );

  if (!prospect) {
    return loaded ? (
      <div className="card px-6 py-14 text-center">
        <p className="text-lg font-bold">الزبون غير موجود</p>
        <p className="mt-2 text-sm text-muted">قد يكون محذوفاً أو غير مسند إليك.</p>
        <Link to="/prospects" className="btn-ghost mt-6 inline-flex">العودة إلى القائمة</Link>
      </div>
    ) : (
      <div className="grid place-items-center py-20" role="status"><Loader2 className="size-6 animate-spin text-muted" aria-label="جارٍ التحميل" /></div>
    );
  }

  const closed = prospect.outreachStatus === "won" || prospect.outreachStatus === "lost";
  const moves = nextStatuses(prospect.outreachStatus).filter((s) => s !== prospect.outreachStatus);
  const activityStatuses = moves.filter((s) => s !== "lost");
  const suggested: OutreachStatus | "" = prospect.outreachStatus === "not_contacted" && aType !== "note" ? "contacted" : "";
  const effectiveStatus = aStatusTouched ? aStatus : suggested;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const moveTo = (s: OutreachStatus) =>
    run(async () => {
      await updateProspect(prospect.id, { outreachStatus: s });
      if (s === "won" && !prospect.projectId) setConverting("offer");
    });

  const markLost = () =>
    run(async () => {
      await updateProspect(prospect.id, { outreachStatus: "lost", lostReason: lostReason.trim() });
      setLostAsk(false);
    });

  const submitActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!aText.trim()) return setAError("اكتب ما حدث في هذا التواصل.");
    setABusy(true);
    setAError(null);
    try {
      await addActivity(
        prospect,
        {
          type: aType,
          channel: aChannel,
          text: aText,
          status: effectiveStatus || undefined,
          nextFollowUp: aFollow ? fromInputDate(aFollow) : undefined,
        },
        profile!.id,
      );
      setAText("");
      setAFollow("");
      setAStatus("");
      setAStatusTouched(false);
    } catch (err) {
      setAError(errorMessage(err));
    } finally {
      setABusy(false);
    }
  };

  const brief = [
    `زبون محتمل: ${prospect.name}`,
    prospect.city && `المدينة: ${prospect.city}`,
    prospect.sector && `المجال: ${prospect.sector}`,
    prospect.pageUrl && `الصفحة: ${prospect.pageUrl}`,
    prospect.notes && `\nملاحظات المبيعات:\n${prospect.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/prospects" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> كل الزبائن
      </Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-9 tracking-tight md:text-3xl">{prospect.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            {prospect.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{prospect.city}</span>}
            {prospect.sector && <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" aria-hidden />{prospect.sector}</span>}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <OutreachBadge status={prospect.outreachStatus} />
            <PriorityBadge prospect={prospect} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost min-h-10 px-3.5 text-sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> تعديل
          </button>
          {isDirector && (
            <button className="btn-danger min-h-10 px-3.5 text-sm" onClick={() => setConfirmDelete(true)} aria-label="حذف الزبون">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </header>

      <ErrorNote>{error}</ErrorNote>

      {/* quick actions */}
      <section aria-label="إجراءات سريعة" className="mb-5 flex flex-wrap gap-2.5">
        {prospect.pageUrl && isHttpUrl(prospect.pageUrl) ? (
          <a href={prospect.pageUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
            <Globe className="size-5" aria-hidden /> فتح صفحة فيسبوك <ExternalLink className="size-3.5 text-muted" aria-hidden />
          </a>
        ) : (
          <span className="btn-ghost cursor-not-allowed opacity-50" aria-disabled="true"><Globe className="size-5" aria-hidden /> لا يوجد رابط صفحة</span>
        )}
        <a href={adLibraryUrl(prospect.name)} target="_blank" rel="noopener noreferrer" className="btn-ghost">
          <Search className="size-5" aria-hidden /> البحث في Meta Ad Library <ExternalLink className="size-3.5 text-muted" aria-hidden />
        </a>
      </section>

      {/* won → convert */}
      {prospect.outreachStatus === "won" && (
        <section className="mb-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
          {prospect.projectId ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Link2 className="size-4 text-emerald-300" aria-hidden />
              <span className="text-emerald-300">المشروع المرتبط:</span>
              <Link to={`/projects/${prospect.projectId}`} className="font-bold hover:underline">{project?.title ?? "فتح المشروع"}</Link>
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-emerald-300">تم الاتفاق مع هذا الزبون 🎉 حوّله إلى مشروع.</p>
              <button className="btn-primary min-h-10 px-4 text-sm" onClick={() => setConverting("manual")}>
                <FolderPlus className="size-5" aria-hidden /> إنشاء مشروع
              </button>
            </div>
          )}
        </section>
      )}

      {/* details */}
      <section aria-label="تفاصيل الزبون" className="card mb-5 p-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <Detail label="المتابعون">{prospect.followers.toLocaleString("en-US")}</Detail>
          <Detail label="آخر منشور">{LAST_POST_LABELS[prospect.lastPost]}</Detail>
          <Detail label="يعلن الآن">{RUNNING_ADS_LABELS[prospect.runningAds]}</Detail>
          <Detail label="جودة المحتوى">{prospect.quality ? `${prospect.quality} من 3` : "غير مقيّمة"}</Detail>
          <Detail label="المتابعة القادمة"><FollowUpLabel prospect={prospect} /></Detail>
          <Detail label="المسؤول">
            {isDirector ? (
              <Select
                aria-label="إسناد الزبون"
                className="!h-9 !text-sm"
                value={prospect.assigneeId}
                disabled={busy}
                onChange={(e) => run(() => updateProspect(prospect.id, { assigneeId: e.target.value }))}
              >
                <option value="">غير مسند</option>
                {salesMembers.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
              </Select>
            ) : (
              userName(prospect.assigneeId)
            )}
          </Detail>
        </dl>
        {prospect.notes && (
          <div className="mt-4 border-t border-line pt-4">
            <h2 className="mb-1 text-xs text-muted">ملاحظات</h2>
            <p className="whitespace-pre-wrap text-sm leading-7">{prospect.notes}</p>
          </div>
        )}
        {prospect.outreachStatus === "lost" && prospect.lostReason && (
          <p className="mt-4 rounded-xl border border-crimson/30 bg-crimson/5 p-3 text-sm text-crimson-text">سبب الخسارة: {prospect.lostReason}</p>
        )}
      </section>

      {/* status flow */}
      {!closed && (
        <section aria-label="تغيير الحالة" className="card mb-5 p-5">
          <h2 className="mb-3 text-sm font-bold text-muted">نقل إلى مرحلة</h2>
          <div className="flex flex-wrap gap-2">
            {moves.filter((s) => s !== "lost").map((s) => (
              <button key={s} className="btn-ghost min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => moveTo(s)}>
                {OUTREACH_LABELS[s]}
              </button>
            ))}
            <button className="btn-danger min-h-10 px-3.5 text-sm" disabled={busy} onClick={() => setLostAsk((v) => !v)}>
              {OUTREACH_LABELS.lost}
            </button>
          </div>
          {lostAsk && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <Field label="سبب الخسارة (إلزامي)" htmlFor="lost-reason">
                <input id="lost-reason" className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)} maxLength={500} autoFocus />
              </Field>
              <button className="btn-primary" disabled={busy || !lostReason.trim()} onClick={markLost}>تأكيد: خسارة</button>
            </div>
          )}
        </section>
      )}

      {/* templates */}
      <section aria-label="قوالب الرسائل" className="card mb-5 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5 text-crimson-text" aria-hidden /> قوالب الرسائل</h2>
          <Link to="/templates" className="text-sm font-semibold text-crimson-text hover:underline">كل القوالب</Link>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted">لم يضف المخرج قوالب بعد.</p>
        ) : (
          <ul className="space-y-3">
            {templates.map((t) => {
              const text = fillTemplate(t.body, prospect);
              return (
                <li key={t.id} className="rounded-xl border border-line bg-surface-2 p-4">
                  <h3 className="mb-2 text-sm font-bold">{t.title}</h3>
                  <p data-testid="template-text" className="whitespace-pre-wrap text-sm leading-7">{text}</p>
                  <CopyButton text={text} label="نسخ الرسالة" className="mt-3" />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* outreach log */}
      <section aria-labelledby="log-h" className="mb-6">
        <h2 id="log-h" className="mb-3 text-lg font-bold">سجل التواصل</h2>
        <form onSubmit={submitActivity} className="card mb-4 space-y-4 p-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="نوع التواصل" htmlFor="a-type">
              <Select id="a-type" value={aType} onChange={(e) => { const t = e.target.value as ActivityType; setAType(t); setAChannel(DEFAULT_CHANNEL[t]); }}>
                {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
              </Select>
            </Field>
            <Field label="القناة" htmlFor="a-channel">
              <Select id="a-channel" value={aChannel} onChange={(e) => setAChannel(e.target.value as Channel)}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="ماذا حدث؟" htmlFor="a-text">
            <textarea id="a-text" className="input h-auto min-h-24 py-3 leading-7" value={aText} onChange={(e) => setAText(e.target.value)} maxLength={2000} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="تحديث الحالة (اختياري)" htmlFor="a-status">
              <Select id="a-status" value={effectiveStatus} onChange={(e) => { setAStatus(e.target.value as OutreachStatus | ""); setAStatusTouched(true); }} disabled={closed}>
                <option value="">بدون تغيير</option>
                {activityStatuses.map((s) => <option key={s} value={s}>{OUTREACH_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field label="المتابعة القادمة (اختياري)" htmlFor="a-follow">
              <input id="a-follow" type="date" dir="ltr" className="input input-ltr" value={aFollow} onChange={(e) => setAFollow(e.target.value)} />
            </Field>
          </div>
          <ErrorNote>{aError}</ErrorNote>
          <button type="submit" className="btn-primary" disabled={aBusy}>
            {aBusy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : aFollow ? <CalendarPlus className="size-5" aria-hidden /> : <Send className="size-5" aria-hidden />}
            تسجيل النشاط
          </button>
        </form>

        {timeline.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">لا يوجد تواصل مسجّل بعد.</p>
        ) : (
          <ol className="relative space-y-4 pe-0 ps-0">
            {timeline.map((a, i) => {
              const Icon = ACTIVITY_ICON[a.type];
              return (
                <li key={a.id} className="relative flex gap-3">
                  {i < timeline.length - 1 && <span aria-hidden className="absolute start-[1.1rem] top-10 h-[calc(100%-1.25rem)] w-px bg-line" />}
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-crimson-text">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                      <span className="font-bold text-fg">{ACTIVITY_LABELS[a.type]}</span>
                      <span>· {CHANNEL_LABELS[a.channel]}</span>
                      <span className="inline-flex items-center gap-1"><Users className="size-3" aria-hidden />{userName(a.createdBy)}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" aria-hidden />{fmtDateTime(a.createdAt)}</span>
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-7">{a.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {editing && <ProspectFormModal prospect={prospect} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {converting && (
        <NewProjectModal
          onClose={() => setConverting(null)}
          intro={converting === "offer" ? "🎉 تم الاتفاق! أنشئ مشروعاً في مرحلة «جلب الزبون» — البيانات معبّأة من بطاقة الزبون." : "ينشأ المشروع في مرحلة «جلب الزبون» والبيانات معبّأة من بطاقة الزبون."}
          initial={{ title: `فيديو إعلاني — ${prospect.name}`, clientName: prospect.name, brief, prospectId: prospect.id }}
          onCreated={async (projectId) => {
            setConverting(null);
            await run(() => updateProspect(prospect.id, { projectId }));
          }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="حذف الزبون؟"
          message={`سيُحذف «${prospect.name}». لا يمكن التراجع.`}
          confirmLabel="نعم، احذف"
          busy={busy}
          onConfirm={() => run(async () => { await deleteProspect(prospect.id); navigate("/prospects"); })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
