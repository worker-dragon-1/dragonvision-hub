import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, FolderOpen, Hourglass, Loader2, Pencil, Play, RotateCcw, Send, Trash2, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Modal } from "./Modal";
import { ConfirmDialog } from "./ConfirmDialog";
import { DriveLink, DueDate, ErrorNote, StatusBadge } from "./Bits";
import { TaskForm } from "./Forms";
import { approveTask, deleteTask, requestChanges, saveDeliverable, startTask, submitTask } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fmtDateTime, isOverdue } from "../lib/dates";
import { STAGE_LABELS } from "../lib/labels";
import type { TaskDoc, WithId } from "../lib/types";
import { TASK_GROUP_LABELS, TASK_GROUP_ORDER, assigneeAction, byDue, isHttpUrl } from "../lib/workflow";

// ── opening a task: `?task=<id>` works on any page ───────────────────────────
export function useOpenTask() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (id: string) =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.set("task", id);
        return n;
      }),
    [setParams],
  );
}

export function TaskCard({ task, showAssignee = false }: { task: WithId<TaskDoc>; showAssignee?: boolean }) {
  const open = useOpenTask();
  const { projects, userName } = useData();
  const project = projects.find((p) => p.id === task.projectId);
  const late = isOverdue(task.dueDate, task.status === "approved");
  return (
    <button
      onClick={() => open(task.id)}
      className={`card block w-full p-4 text-start transition-colors hover:border-muted/50 ${
        late ? "border-crimson/60 bg-crimson/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-[0.95rem] font-bold leading-6">{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>
      <p className="mt-1 truncate text-sm text-muted">
        {project ? `${project.title} · ` : ""}
        {STAGE_LABELS[task.stage]}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <DueDate due={task.dueDate} done={task.status === "approved"} />
        {showAssignee && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <User className="size-3.5" aria-hidden />
            {userName(task.assigneeId)}
          </span>
        )}
      </div>
    </button>
  );
}

/** Tasks grouped by status; approved ones collapsed. */
export function TaskGroups({ tasks, showAssignee = false, empty }: { tasks: WithId<TaskDoc>[]; showAssignee?: boolean; empty: ReactNode }) {
  if (tasks.length === 0) return <>{empty}</>;
  return (
    <div className="space-y-7">
      {TASK_GROUP_ORDER.map((status) => {
        const list = tasks.filter((t) => t.status === status).sort(byDue);
        if (list.length === 0) return null;
        const body = (
          <ul className="space-y-2.5">
            {list.map((t) => (
              <li key={t.id}>
                <TaskCard task={t} showAssignee={showAssignee} />
              </li>
            ))}
          </ul>
        );
        if (status === "approved") {
          return (
            <details key={status} className="group">
              <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 text-lg font-bold">
                <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" aria-hidden />
                {TASK_GROUP_LABELS[status]}
                <span className="text-sm font-medium text-muted">({list.length})</span>
              </summary>
              {body}
            </details>
          );
        }
        return (
          <section key={status} aria-label={TASK_GROUP_LABELS[status]}>
            <h2 className={`mb-3 flex items-center gap-2 text-lg font-bold ${status === "changes_requested" ? "text-crimson-text" : ""}`}>
              {status === "changes_requested" && <AlertTriangle className="size-5" aria-hidden />}
              {TASK_GROUP_LABELS[status]}
              <span className="text-sm font-medium text-muted">({list.length})</span>
            </h2>
            {body}
          </section>
        );
      })}
    </div>
  );
}

function ReviewHistory({ task }: { task: WithId<TaskDoc> }) {
  const { userName } = useData();
  if (task.reviewNotes.length === 0) return null;
  return (
    <section aria-label="سجل المراجعة">
      <h3 className="mb-3 text-sm font-bold text-muted">سجل المراجعة</h3>
      <ol className="space-y-2.5">
        {task.reviewNotes.map((n, i) => {
          const ok = n.kind === "approved";
          return (
            <li key={i} className={`rounded-xl border p-3 ${ok ? "border-emerald-400/25 bg-emerald-400/5" : "border-crimson/30 bg-crimson/5"}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${ok ? "text-emerald-300" : "text-crimson-text"}`}>
                  {ok ? <CheckCircle2 className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                  {ok ? "اعتُمدت" : "طُلبت تعديلات"}
                </span>
                <span className="text-xs text-muted">{userName(n.by)} · {fmtDateTime(n.at)}</span>
              </div>
              {n.text && <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{n.text}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function TaskDetail({ task, onClose }: { task: WithId<TaskDoc>; onClose: () => void }) {
  const { profile, isDirector } = useAuth();
  const { projects, userName, directorIds } = useData();
  const project = projects.find((p) => p.id === task.projectId);
  const isAssignee = task.assigneeId === profile!.id;
  const action = isAssignee ? assigneeAction(task.status) : null;

  const [url, setUrl] = useState(task.deliverableUrl);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false); // director is writing a change request
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep the field in sync if the link changes elsewhere
  useEffect(() => setUrl(task.deliverableUrl), [task.deliverableUrl]);

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

  const cleanUrl = url.trim();
  const lastChange = [...task.reviewNotes].reverse().find((n) => n.kind === "changes_requested");

  if (mode === "edit") {
    return (
      <Modal title="تعديل المهمة" onClose={onClose}>
        <TaskForm task={task} onDone={() => setMode("view")} onCancel={() => setMode("view")} />
      </Modal>
    );
  }

  return (
    <Modal title={task.title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <StatusBadge status={task.status} />
          <span className="text-sm text-muted">{STAGE_LABELS[task.stage]}</span>
          <DueDate due={task.dueDate} done={task.status === "approved"} />
        </div>

        <dl className="grid gap-3 rounded-xl bg-surface-2 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">المشروع</dt>
            <dd className="mt-0.5 font-semibold">
              {project ? (
                <Link to={`/projects/${project.id}`} onClick={onClose} className="hover:underline">
                  {project.title}
                </Link>
              ) : (
                "—"
              )}
              {project && <span className="block text-xs font-normal text-muted">{project.clientName}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">المسؤول</dt>
            <dd className="mt-0.5 font-semibold">{userName(task.assigneeId)}</dd>
          </div>
          {project?.driveFolderUrl && (
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs text-muted">مجلد المشروع على Drive</dt>
              <dd>
                <DriveLink href={project.driveFolderUrl}>فتح المجلد</DriveLink>
              </dd>
            </div>
          )}
        </dl>

        {task.instructions && (
          <section>
            <h3 className="mb-1.5 text-sm font-bold text-muted">التعليمات</h3>
            <p className="whitespace-pre-wrap text-[0.95rem] leading-7">{task.instructions}</p>
          </section>
        )}

        {task.status === "changes_requested" && lastChange && (
          <div className="rounded-xl border border-crimson/40 bg-crimson/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-crimson-text">
              <AlertTriangle className="size-4" aria-hidden />
              مطلوب تعديلات
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{lastChange.text}</p>
          </div>
        )}

        {/* ── deliverable ── */}
        {isAssignee && task.status === "in_progress" ? (
          <div>
            <label htmlFor="deliverable" className="label">رابط التسليم (Google Drive)</label>
            <input
              id="deliverable"
              type="url"
              inputMode="url"
              dir="ltr"
              className="input input-ltr"
              placeholder="https://drive.google.com/file/d/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted">الرابط إلزامي لتسليم المهمة للمراجعة. لا تُرفع الملفات هنا.</p>
          </div>
        ) : (
          task.deliverableUrl && (
            <div>
              <span className="label">رابط التسليم</span>
              <DriveLink href={task.deliverableUrl}>فتح التسليم</DriveLink>
            </div>
          )
        )}

        {/* ── assignee actions (only the allowed transition) ── */}
        {action === "start" && (
          <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => startTask(task))}>
            <Play className="size-5" aria-hidden /> ابدأ العمل
          </button>
        )}
        {action === "resume" && (
          <button className="btn-primary w-full" disabled={busy} onClick={() => run(() => startTask(task))}>
            <RotateCcw className="size-5" aria-hidden /> استئناف العمل بعد التعديلات
          </button>
        )}
        {action === "submit" && (
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              className="btn-primary flex-1"
              disabled={busy || !isHttpUrl(cleanUrl)}
              onClick={() => run(() => submitTask(task, cleanUrl, profile!.displayName, directorIds))}
            >
              {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
              سلّم للمراجعة
            </button>
            <button
              className="btn-ghost"
              disabled={busy || cleanUrl === task.deliverableUrl || (cleanUrl !== "" && !isHttpUrl(cleanUrl))}
              onClick={() => run(() => saveDeliverable(task, cleanUrl))}
            >
              حفظ الرابط فقط
            </button>
          </div>
        )}
        {action === "submit" && cleanUrl !== "" && !isHttpUrl(cleanUrl) && (
          <p className="text-sm text-crimson-text">الرابط غير صحيح: يجب أن يبدأ بـ https:// أو http://</p>
        )}
        {isAssignee && task.status === "in_review" && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-300">
            <Hourglass className="size-4 shrink-0" aria-hidden />
            تم التسليم وبانتظار مراجعة المخرج.
          </p>
        )}
        {isAssignee && task.status === "approved" && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            تم اعتماد هذه المهمة.
          </p>
        )}

        {/* ── director: review ── */}
        {isDirector && task.status === "in_review" && (
          <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="text-sm font-bold text-amber-300">بانتظار قرارك</p>
            {asking ? (
              <>
                <label htmlFor="cr-note" className="label">ما المطلوب تعديله؟ (إلزامي)</label>
                <textarea id="cr-note" className="input h-auto min-h-24 py-3 leading-7" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
                <div className="flex gap-2.5">
                  <button
                    className="btn-primary flex-1"
                    disabled={busy || !note.trim()}
                    onClick={() => run(async () => { await requestChanges(task, profile!.id, note); setAsking(false); setNote(""); })}
                  >
                    {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
                    إرسال طلب التعديل
                  </button>
                  <button className="btn-ghost" disabled={busy} onClick={() => setAsking(false)}>تراجع</button>
                </div>
              </>
            ) : (
              <div className="flex gap-2.5">
                <button className="btn-primary flex-1" disabled={busy} onClick={() => run(() => approveTask(task, profile!.id))}>
                  {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
                  اعتماد
                </button>
                <button className="btn-ghost flex-1" disabled={busy} onClick={() => setAsking(true)}>
                  <RotateCcw className="size-5" aria-hidden /> طلب تعديلات
                </button>
              </div>
            )}
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>

        <ReviewHistory task={task} />

        {isDirector && (
          <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
            {project && (
              <Link to={`/projects/${project.id}`} onClick={onClose} className="btn-ghost min-h-10 px-3 text-sm">
                <FolderOpen className="size-4" aria-hidden /> صفحة المشروع
              </Link>
            )}
            <button className="btn-ghost min-h-10 px-3 text-sm" onClick={() => setMode("edit")}>
              <Pencil className="size-4" aria-hidden /> تعديل / إعادة إسناد
            </button>
            <button className="btn-danger min-h-10 px-3 text-sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" aria-hidden /> حذف
            </button>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="حذف المهمة؟"
          message={`ستُحذف «${task.title}» نهائياً مع سجل مراجعتها.`}
          confirmLabel="نعم، احذف"
          busy={busy}
          onConfirm={() => run(async () => { await deleteTask(task.id); onClose(); })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Modal>
  );
}

/** Renders the detail view when the URL has ?task=<id>. Lives in the layout. */
export function TaskDetailHost() {
  const [params, setParams] = useSearchParams();
  const { tasks, loaded } = useData();
  const id = params.get("task");
  const task = id ? tasks.find((t) => t.id === id) : undefined;

  const close = useCallback(
    () =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        n.delete("task");
        return n;
      }, { replace: true }),
    [setParams],
  );

  // link to a task that no longer exists (deleted) or isn't yours → drop the param
  useEffect(() => {
    if (id && loaded && !task) close();
  }, [id, loaded, task, close]);

  return task ? <TaskDetail key={task.id} task={task} onClose={close} /> : null;
}
