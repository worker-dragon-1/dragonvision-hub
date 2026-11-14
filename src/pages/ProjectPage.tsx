import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Building2, Check, ChevronLeft, FileText, Handshake, Link2, Loader2, Plus, ShieldAlert, Undo2, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { DriveLink, DueDate, ErrorNote, Initial } from "../components/Bits";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { MembersModal, NewTaskModal } from "../components/Forms";
import { FinanceBlock } from "../components/FinanceBlock";
import { Modal } from "../components/Modal";
import { useProjectClient, useQuoteVersions } from "../hooks/useProjectClient";
import { moveWithOverride } from "../lib/clientActions";
import { REVIEW_LABELS, answerFor, clientGate } from "../lib/portal";
import { TaskCard } from "../components/TaskViews";
import { moveProjectStage } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { ROLE_LABELS, STAGE_LABELS } from "../lib/labels";
import { STAGES } from "../lib/types";
import { byDue, prevStage, stageGate, stageIndex } from "../lib/workflow";

export function ProjectPage() {
  const { projectId } = useParams();
  const { isDirector, profile } = useAuth();
  const { projects, tasks, users, prospects, finances, loaded } = useData();
  const client = useProjectClient(projectId);
  const quotes = useQuoteVersions(isDirector ? projectId : undefined);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const project = projects.find((p) => p.id === projectId);

  const [newTask, setNewTask] = useState(false);
  const [editMembers, setEditMembers] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectTasks = useMemo(() => (project ? tasks.filter((t) => t.projectId === project.id) : []), [tasks, project]);
  // only director / sales can read prospects, so the link simply doesn't appear for others
  const linkedProspect = project?.prospectId ? prospects.find((p) => p.id === project.prospectId) : undefined;
  const members = useMemo(() => users.filter((u) => project?.memberIds.includes(u.id)), [users, project]);

  if (!project) {
    return loaded ? (
      <div className="card px-6 py-14 text-center">
        <p className="text-lg font-bold">المشروع غير موجود</p>
        <p className="mt-2 text-sm text-muted">قد يكون محذوفاً، أو غير مُسنَد إليك.</p>
        <Link to="/projects" className="btn-ghost mt-6 inline-flex">العودة إلى المشاريع</Link>
      </div>
    ) : (
      <div className="grid place-items-center py-20" role="status"><Loader2 className="size-6 animate-spin text-muted" aria-label="جارٍ التحميل" /></div>
    );
  }

  const gate = stageGate(project, tasks);
  // client approvals (script before production, final video before delivery) — director only
  const cg = isDirector ? clientGate(project, gate.next, client.active, client.responses, finances[project.id]) : { blocked: false, reasons: [], overridden: false };
  const lastOverride = (project.gateOverrides ?? []).filter((o) => o.from === project.stage && o.to === gate.next).pop();
  const back = prevStage(project.stage);
  const idx = stageIndex(project.stage);

  const move = async (to: (typeof STAGES)[number]) => {
    setBusy(true);
    setError(null);
    try {
      await moveProjectStage(project.id, to);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirmBack(false);
    }
  };

  // tasks grouped by stage: current stage first (always shown), then the others that have tasks
  const stageOrder = [project.stage, ...STAGES.filter((s) => s !== project.stage)];

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/projects" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> كل المشاريع
      </Link>

      <header className="mb-5">
        <h1 className="text-2xl font-extrabold leading-9 tracking-tight md:text-3xl">{project.title}</h1>
        <p className="mt-1 flex items-center gap-2 text-muted">
          <Building2 className="size-4 shrink-0" aria-hidden /> {project.clientName}
        </p>
        {linkedProspect && (
          <Link to={`/prospects/${linkedProspect.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-crimson-text hover:underline">
            <Link2 className="size-4" aria-hidden /> الزبون المحتمل: {linkedProspect.name}
          </Link>
        )}
      </header>

      {/* ── stage tracker ── */}
      <section aria-label="مراحل المشروع" className="card mb-5 p-4">
        <ol className="flex flex-wrap gap-2">
          {STAGES.map((s, i) => {
            const state = i < idx ? "done" : i === idx ? "now" : "todo";
            return (
              <li
                key={s}
                aria-current={state === "now" ? "step" : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${
                  state === "now"
                    ? "border-crimson bg-crimson text-white"
                    : state === "done"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-line text-muted"
                }`}
              >
                {state === "done" && <Check className="size-3.5" aria-hidden />}
                {STAGE_LABELS[s]}
              </li>
            );
          })}
        </ol>

        {isDirector && (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            {gate.message && (
              <p role="status" data-testid="gate-message" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm leading-7 text-amber-200">
                {gate.message}
              </p>
            )}
            {(cg.blocked || cg.overridden) && (
              <div data-testid="client-gate" className={`rounded-xl border p-3 text-sm leading-7 ${cg.blocked ? "border-crimson/40 bg-crimson/10 text-crimson-text" : "border-line bg-surface-2 text-muted"}`}>
                <p className="flex items-center gap-2 font-bold"><ShieldAlert className="size-4" aria-hidden /> {cg.blocked ? `لا يمكن الانتقال إلى «${STAGE_LABELS[gate.next!]}» قبل موافقة الزبون:` : "تم تجاوز شرط موافقة الزبون:"}</p>
                <ul className="ms-5 list-disc">{cg.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                {cg.overridden && lastOverride && <p className="mt-1">السبب المسجَّل: «{lastOverride.reason}»</p>}
                {cg.blocked && gate.canAdvance && (
                  <button className="mt-2 text-sm font-semibold underline" onClick={() => setOverrideOpen(true)}>تجاوز الشرط مع تسجيل السبب…</button>
                )}
              </div>
            )}
            {gate.next && gate.canAdvance && idx === STAGES.length - 2 && (
              <p className="text-sm text-muted">هذه آخر مرحلة قبل التسليم، وقد اجتازت مراجعة الجودة.</p>
            )}
            <div className="flex flex-wrap gap-2.5">
              {gate.next && (
                <button
                  data-testid="advance"
                  className="btn-primary"
                  disabled={!gate.canAdvance || cg.blocked || busy}
                  onClick={() => move(gate.next!)}
                >
                  {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
                  الانتقال إلى «{STAGE_LABELS[gate.next]}»
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
              )}
              {back && (
                <button className="btn-ghost" disabled={busy} onClick={() => setConfirmBack(true)}>
                  <Undo2 className="size-5" aria-hidden /> إرجاع إلى «{STAGE_LABELS[back]}»
                </button>
              )}
              {!gate.next && <p className="text-sm font-semibold text-emerald-300">تم تسليم هذا المشروع ✓</p>}
            </div>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </section>

      {/* ── client & agreement (director) ── */}
      {isDirector && (
        <section aria-label="الزبون والاتفاق" data-testid="client-card" className="card mb-5 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Handshake className="size-5 text-crimson-text" aria-hidden /> الزبون والاتفاق</h2>
            <b data-testid="project-revisions" className={client.stats.used > client.stats.included ? "text-amber-300" : ""}>جولات التعديل: <bdi dir="ltr">{client.stats.used} / {client.stats.included}</bdi></b>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>عرض السعر: <b>{(() => { const v = quotes?.[quotes.length - 1]; return !v ? "لا يوجد" : v.status === "accepted" ? `مقبول (النسخة ${v.version})` : v.status === "sent" ? `بانتظار الزبون (النسخة ${v.version})` : `مسودة (النسخة ${v.version})`; })()}</b></p>
            <p>رابط الزبون: <b>{client.active ? "نشِط" : client.portals.length ? "ملغى" : "لم يُنشأ"}</b>{client.unseen.length > 0 && <span className="ms-2 badge border-crimson/40 bg-crimson/15 text-crimson-text">{client.unseen.length} رد جديد</span>}</p>
            {(["script", "final"] as const).map((k) => {
              const it = client.active?.items[k];
              const a = it ? answerFor(client.responses, k, it.version) : undefined;
              return <p key={k}>{REVIEW_LABELS[k]}: <b>{!it ? "لم يُنشر" : a?.decision === "approved" ? `وافق الزبون — النسخة ${it.version}` : a ? `طُلبت تعديلات — النسخة ${it.version}` : `بانتظار الزبون — النسخة ${it.version}`}</b></p>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/projects/${project.id}/quote`} className="btn-ghost min-h-10 px-3.5 text-sm"><FileText className="size-4" aria-hidden /> عرض السعر</Link>
            <Link to={`/projects/${project.id}/client`} className="btn-ghost min-h-10 px-3.5 text-sm"><Link2 className="size-4" aria-hidden /> بوابة الزبون والردود</Link>
          </div>
        </section>
      )}

      {/* ── details ── */}
      <section aria-label="تفاصيل المشروع" className="card mb-6 space-y-4 p-5">
        {project.brief ? (
          <div>
            <h2 className="mb-1.5 text-sm font-bold text-muted">الوصف</h2>
            <p className="whitespace-pre-wrap text-[0.95rem] leading-7">{project.brief}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">لا يوجد وصف لهذا المشروع.</p>
        )}
        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1.5 text-sm font-bold text-muted">تاريخ التسليم</h2>
            {project.dueDate ? <DueDate due={project.dueDate} done={project.stage === "delivered"} className="!text-sm" /> : <span className="text-sm text-muted">غير محدد</span>}
          </div>
          <div>
            <h2 className="mb-1.5 text-sm font-bold text-muted">مجلد Drive</h2>
            {project.driveFolderUrl ? <DriveLink href={project.driveFolderUrl}>فتح المجلد</DriveLink> : <span className="text-sm text-muted">لم يُضَف رابط</span>}
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-muted">
              <Users className="size-4" aria-hidden /> الأعضاء
            </h2>
            {isDirector && (
              <button className="text-sm font-semibold text-crimson-text hover:underline" onClick={() => setEditMembers(true)}>
                تعديل
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted">لم يُضَف أعضاء بعد{isDirector ? " — أضفهم لتتمكن من إسناد المهام." : "."}</p>
          ) : (
            <ul className="flex flex-wrap gap-2.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pe-3 ps-1">
                  <Initial id={m.id} name={m.displayName} size="size-7" />
                  <span className="text-sm font-semibold">{m.displayName}</span>
                  <span className="text-xs text-muted">{ROLE_LABELS[m.role]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── finance: DIRECTOR ONLY (the component and its data are never loaded for anyone else) ── */}
      {isDirector && loaded && <FinanceBlock key={project.id} project={project} />}

      {/* ── tasks by stage ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">المهام</h2>
        {isDirector && (
          <button className="btn-primary" onClick={() => setNewTask(true)}>
            <Plus className="size-5" aria-hidden /> مهمة جديدة
          </button>
        )}
      </div>
      {!isDirector && <p className="mb-4 text-sm text-muted">تظهر هنا المهام المسندة إليك في هذا المشروع فقط.</p>}

      <div className="space-y-6">
        {stageOrder.map((s) => {
          const list = projectTasks.filter((t) => t.stage === s).sort(byDue);
          const current = s === project.stage;
          if (list.length === 0 && !current) return null;
          return (
            <section key={s} aria-label={`مهام ${STAGE_LABELS[s]}`}>
              <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-muted">
                {STAGE_LABELS[s]}
                {current && <span className="badge border-crimson/40 bg-crimson/15 text-crimson-text">المرحلة الحالية</span>}
                <span className="font-medium">({list.length})</span>
              </h3>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">لا توجد مهام في هذه المرحلة</p>
              ) : (
                <ul className="space-y-2.5">
                  {list.map((t) => (
                    <li key={t.id}>
                      <TaskCard task={t} showAssignee={isDirector} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {newTask && <NewTaskModal project={project} defaultStage={project.stage} onClose={() => setNewTask(false)} />}
      {editMembers && <MembersModal project={project} onClose={() => setEditMembers(false)} />}
      {overrideOpen && gate.next && (
        <Modal title="تجاوز شرط موافقة الزبون" onClose={() => setOverrideOpen(false)}>
          <div className="space-y-4">
            <ul className="ms-5 list-disc text-sm leading-7 text-muted">{cg.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            <div>
              <label htmlFor="override-reason" className="label">سبب التجاوز (يُسجَّل في المشروع)</label>
              <textarea id="override-reason" className="input h-auto min-h-24 py-3 leading-7" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} maxLength={500} />
            </div>
            <button className="btn-primary w-full" disabled={busy || overrideReason.trim().length < 5}
              onClick={async () => { setBusy(true); setError(null); try { await moveWithOverride(project.id, project.stage, gate.next!, overrideReason, profile!.id); setOverrideOpen(false); setOverrideReason(""); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }}>
              تجاوز والانتقال إلى «{STAGE_LABELS[gate.next]}»
            </button>
          </div>
        </Modal>
      )}
      {confirmBack && back && (
        <ConfirmDialog
          title="إرجاع المشروع؟"
          message={`سيعود المشروع إلى مرحلة «${STAGE_LABELS[back]}».`}
          confirmLabel="نعم، أرجعه"
          busy={busy}
          onConfirm={() => move(back)}
          onCancel={() => setConfirmBack(false)}
        />
      )}
    </div>
  );
}
