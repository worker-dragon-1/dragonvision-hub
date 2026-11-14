import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Modal } from "./Modal";
import { ErrorNote, Initial } from "./Bits";
import { createProject, createTask, editTask, setProjectMembers } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fromInputDate, toInputDate } from "../lib/dates";
import { ROLE_LABELS, STAGE_LABELS } from "../lib/labels";
import { STAGES, type ProjectDoc, type Stage, type TaskDoc, type WithId } from "../lib/types";
import { isHttpUrl } from "../lib/workflow";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const SELECT_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a8a8b4' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`input appearance-none bg-[length:1.1rem] bg-[position:left_0.75rem_center] bg-no-repeat text-start ps-3.5 pe-9 ${props.className ?? ""}`}
      style={{ backgroundImage: SELECT_BG }}
    />
  );
}

/** Non-director, active members that can be put on a project. */
function useAssignable() {
  const { users } = useData();
  return useMemo(() => users.filter((u) => u.active && u.role !== "director"), [users]);
}

function MemberPicker({
  selected,
  onToggle,
  locked = [],
}: {
  selected: string[];
  onToggle: (id: string) => void;
  /** Members that cannot be removed (they still have tasks on the project). */
  locked?: string[];
}) {
  const people = useAssignable();
  if (people.length === 0) return <p className="text-sm text-muted">لا يوجد أعضاء في الفريق بعد. ادعُ أعضاء من صفحة «الفريق».</p>;
  return (
    <ul className="space-y-2">
      {people.map((u) => {
        const on = selected.includes(u.id);
        const isLocked = on && locked.includes(u.id);
        return (
          <li key={u.id}>
            <label
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                on ? "border-crimson/50 bg-crimson/10" : "border-line bg-surface-2"
              } ${isLocked ? "opacity-70" : ""}`}
            >
              <input
                type="checkbox"
                className="size-5 accent-[#C8102E]"
                checked={on}
                disabled={isLocked}
                onChange={() => onToggle(u.id)}
              />
              <Initial id={u.id} name={u.displayName} size="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{u.displayName}</span>
                <span className="block text-xs text-muted">
                  {ROLE_LABELS[u.role]}
                  {isLocked && " · عنده مهام في هذا المشروع"}
                </span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────── New project ───────────────────────────────
export interface ProjectPrefill {
  title: string;
  clientName: string;
  brief: string;
  prospectId: string;
}

export function NewProjectModal({
  onClose,
  onCreated,
  initial,
  intro,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  /** e.g. when converting a prospect */
  initial?: ProjectPrefill;
  intro?: string;
}) {
  const { profile, role } = useAuth();
  const isDirector = role === "director";
  const [title, setTitle] = useState(initial?.title ?? "");
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [brief, setBrief] = useState(initial?.brief ?? "");
  const [due, setDue] = useState("");
  const [drive, setDrive] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("اكتب عنوان المشروع.");
    if (!clientName.trim()) return setError("اكتب اسم الزبون.");
    if (drive.trim() && !isHttpUrl(drive.trim())) return setError("رابط Google Drive يجب أن يبدأ بـ http:// أو https://");
    setBusy(true);
    setError(null);
    try {
      const id = await createProject(
        {
          title: title.trim(),
          clientName: clientName.trim(),
          brief: brief.trim(),
          dueDate: fromInputDate(due),
          driveFolderUrl: drive.trim(),
          memberIds: isDirector ? members : [], // sales can't assign members (rules)
          prospectId: initial?.prospectId,
        },
        profile!.id,
      );
      onCreated(id);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="مشروع جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {intro && <p className="rounded-xl bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-300">{intro}</p>}
        {!isDirector && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm leading-6 text-muted">
            سيُنشأ المشروع في مرحلة «{STAGE_LABELS.lead}». يضيف المخرج الأعضاء لاحقاً.
          </p>
        )}
        <Field label="عنوان المشروع" htmlFor="p-title">
          <input id="p-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <Field label="اسم الزبون" htmlFor="p-client">
          <input id="p-client" className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={200} />
        </Field>
        <Field label="الوصف (Brief)" htmlFor="p-brief">
          <textarea id="p-brief" className="input h-auto min-h-28 py-3 leading-7" value={brief} onChange={(e) => setBrief(e.target.value)} />
        </Field>
        <Field label="تاريخ التسليم" htmlFor="p-due">
          <input id="p-due" type="date" dir="ltr" className="input input-ltr" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="رابط مجلد Google Drive" htmlFor="p-drive" hint="اختياري. تُحفظ الروابط فقط — لا تُرفع ملفات الفيديو إلى التطبيق.">
          <input
            id="p-drive"
            type="url"
            inputMode="url"
            dir="ltr"
            className="input input-ltr"
            placeholder="https://drive.google.com/drive/folders/…"
            value={drive}
            onChange={(e) => setDrive(e.target.value)}
          />
        </Field>
        {isDirector && (
          <div>
            <span className="label">الأعضاء</span>
            <MemberPicker selected={members} onToggle={(id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))} />
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          إنشاء المشروع
        </button>
      </form>
    </Modal>
  );
}

// ─────────────────────────── Project members editor ───────────────────────────
export function MembersModal({ project, onClose }: { project: WithId<ProjectDoc>; onClose: () => void }) {
  const { tasks } = useData();
  const [members, setMembers] = useState<string[]>(project.memberIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // removing someone who still has tasks here would orphan their access
  const locked = useMemo(() => tasks.filter((t) => t.projectId === project.id).map((t) => t.assigneeId), [tasks, project.id]);

  const save = async () => {
    setBusy(true);
    try {
      await setProjectMembers(project.id, members);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="أعضاء المشروع" onClose={onClose}>
      <div className="space-y-4">
        <MemberPicker
          selected={members}
          locked={locked}
          onToggle={(id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))}
        />
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full" disabled={busy} onClick={save}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          حفظ
        </button>
      </div>
    </Modal>
  );
}

// ───────────────────────────────── Task form ─────────────────────────────────
interface TaskFormProps {
  /** Fixed project (from a project page / edit). When omitted the director picks one. */
  project?: WithId<ProjectDoc>;
  task?: WithId<TaskDoc>; // edit mode
  defaultStage?: Stage;
  onDone: (taskId?: string) => void;
  onCancel?: () => void;
}

export function TaskForm({ project, task, defaultStage, onDone, onCancel }: TaskFormProps) {
  const { projects, users } = useData();
  const [projectId, setProjectId] = useState(project?.id ?? task?.projectId ?? "");
  const chosen = project ?? projects.find((p) => p.id === projectId);
  const [stage, setStage] = useState<Stage>(task?.stage ?? defaultStage ?? chosen?.stage ?? "lead");
  const [title, setTitle] = useState(task?.title ?? "");
  const [instructions, setInstructions] = useState(task?.instructions ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [due, setDue] = useState(toInputDate(task?.dueDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = useMemo(
    () => users.filter((u) => u.active && u.role !== "director" && chosen?.memberIds.includes(u.id)),
    [users, chosen],
  );
  // can't reassign a task that is under review / approved (rules)
  const locked = task ? task.status === "in_review" || task.status === "approved" : false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen) return setError("اختر المشروع.");
    if (!title.trim()) return setError("اكتب عنوان المهمة.");
    if (!assigneeId) return setError("اختر المسؤول عن المهمة.");
    setBusy(true);
    setError(null);
    try {
      const input = {
        stage,
        title: title.trim(),
        instructions: instructions.trim(),
        assigneeId,
        dueDate: fromInputDate(due),
      };
      if (task) {
        await editTask(task, input);
        onDone(task.id);
      } else {
        onDone(await createTask({ ...input, projectId: chosen.id }));
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!project && !task && (
        <Field label="المشروع" htmlFor="t-project">
          <Select
            id="t-project"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setAssigneeId("");
              const p = projects.find((x) => x.id === e.target.value);
              if (p) setStage(p.stage);
            }}
          >
            <option value="">اختر المشروع…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title} — {p.clientName}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="المرحلة" htmlFor="t-stage">
        <Select id="t-stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </Select>
      </Field>
      <Field label="عنوان المهمة" htmlFor="t-title">
        <input id="t-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </Field>
      <Field
        label="المسؤول"
        htmlFor="t-assignee"
        hint={
          chosen && candidates.length === 0
            ? "لا يوجد أعضاء في هذا المشروع. أضف أعضاء إلى المشروع أولاً."
            : locked
              ? "لا يمكن تغيير المسؤول أثناء المراجعة أو بعد الاعتماد."
              : undefined
        }
      >
        <Select id="t-assignee" value={assigneeId} disabled={!chosen || locked} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">اختر العضو…</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName} — {ROLE_LABELS[u.role]}</option>
          ))}
        </Select>
      </Field>
      <Field label="تاريخ التسليم" htmlFor="t-due">
        <input id="t-due" type="date" dir="ltr" className="input input-ltr" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="تعليمات (اختياري)" htmlFor="t-instr">
        <textarea id="t-instr" className="input h-auto min-h-24 py-3 leading-7" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {task ? "حفظ التعديلات" : "إنشاء المهمة وإسنادها"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>إلغاء</button>
        )}
      </div>
    </form>
  );
}

export function NewTaskModal({ project, defaultStage, onClose }: { project?: WithId<ProjectDoc>; defaultStage?: Stage; onClose: () => void }) {
  return (
    <Modal title="مهمة جديدة" onClose={onClose}>
      <TaskForm project={project} defaultStage={defaultStage} onDone={() => onClose()} />
    </Modal>
  );
}
