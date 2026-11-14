import { useState } from "react";
import { CheckCircle2, Clock, Loader2, PartyPopper, RotateCcw, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { DriveLink, ErrorNote } from "../components/Bits";
import { useOpenTask } from "../components/TaskViews";
import { approveTask, requestChanges } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fmtRelative } from "../lib/dates";
import { STAGE_LABELS } from "../lib/labels";
import type { TaskDoc, WithId } from "../lib/types";

function ReviewItem({ task, onError }: { task: WithId<TaskDoc>; onError: (m: string | null) => void }) {
  const { profile } = useAuth();
  const { projects, userName } = useData();
  const open = useOpenTask();
  const project = projects.find((p) => p.id === task.projectId);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (err) {
      // reported on the page: the optimistic update may already have removed this item
      onError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <li className="card p-4">
      <button onClick={() => open(task.id)} className="block w-full text-start">
        <h3 className="text-base font-bold leading-6 hover:underline">{task.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {project ? `${project.title} · ` : ""}
          {STAGE_LABELS[task.stage]}
        </p>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <User className="size-4" aria-hidden /> {userName(task.assigneeId)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-300">
          <Clock className="size-4" aria-hidden /> سُلّمت {fmtRelative(task.updatedAt)}
        </span>
        {task.deliverableUrl && <DriveLink href={task.deliverableUrl}>فتح التسليم</DriveLink>}
      </div>

      {asking ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <label htmlFor={`note-${task.id}`} className="label">ما المطلوب تعديله؟ (إلزامي)</label>
          <textarea
            id={`note-${task.id}`}
            className="input h-auto min-h-24 py-3 leading-7"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2.5">
            <button className="btn-primary flex-1" disabled={busy || !note.trim()} onClick={() => run(() => requestChanges(task, profile!.id, note))}>
              {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
              إرسال طلب التعديل
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => setAsking(false)}>تراجع</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2.5 border-t border-line pt-4">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => run(() => approveTask(task, profile!.id))}>
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
            اعتماد
          </button>
          <button className="btn-ghost flex-1" disabled={busy} onClick={() => setAsking(true)}>
            <RotateCcw className="size-5" aria-hidden /> طلب تعديلات
          </button>
        </div>
      )}
    </li>
  );
}

/** Director: everything awaiting a decision, oldest submission first. */
export function ReviewQueuePage() {
  const { tasks, loaded } = useData();
  const [error, setError] = useState<string | null>(null);
  const queue = tasks
    .filter((t) => t.status === "in_review")
    .sort((a, b) => (a.updatedAt?.toMillis() ?? 0) - (b.updatedAt?.toMillis() ?? 0));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="للمراجعة" subtitle={loaded ? (queue.length ? `${queue.length} مهمة بانتظار قرارك — الأقدم أولاً` : undefined) : undefined} />
      <div className="mb-4 empty:hidden">
        <ErrorNote>{error}</ErrorNote>
      </div>
      {loaded && queue.length === 0 ? (
        <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
            <PartyPopper className="size-7" aria-hidden />
          </span>
          <p className="text-lg font-bold">لا شيء بانتظار المراجعة</p>
          <p className="text-sm text-muted">ستظهر هنا المهام التي يسلّمها الفريق.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((t) => (
            <ReviewItem key={t.id} task={t} onError={setError} />
          ))}
        </ul>
      )}
    </div>
  );
}
