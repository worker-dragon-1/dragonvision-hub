import { Plus } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { NewTaskModal } from "../components/Forms";
import { TaskGroups } from "../components/TaskViews";
import { isOverdue } from "../lib/dates";

/** Every member's own tasks (rules only ever return tasks assigned to them). */
export function MyTasksPage() {
  const { profile } = useAuth();
  const { tasks, loaded } = useData();
  const mine = tasks.filter((t) => t.assigneeId === profile!.id);
  const late = mine.filter((t) => isOverdue(t.dueDate, t.status === "approved")).length;
  const open = mine.filter((t) => t.status !== "approved").length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="مهامي" subtitle={loaded ? `${open} مهمة مفتوحة${late ? ` · ${late} متأخرة` : ""}` : undefined} />
      <TaskGroups
        tasks={mine}
        empty={
          loaded ? (
            <div className="card px-6 py-14 text-center">
              <p className="text-lg font-bold">لا توجد مهام لك الآن</p>
              <p className="mt-2 text-sm text-muted">ستصلك إشعارات عند إسناد مهمة جديدة إليك.</p>
            </div>
          ) : null
        }
      />
    </div>
  );
}

/** Director: every task across projects. */
export function AllTasksPage() {
  const { tasks, projects, loaded } = useData();
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") ?? "";
  const late = tasks.filter((t) => isOverdue(t.dueDate, t.status === "approved")).length;
  const shown = filter === "overdue" ? tasks.filter((t) => isOverdue(t.dueDate, t.status === "approved")) : filter === "review" ? tasks.filter((t) => t.status === "in_review") : tasks;
  const chip = (value: string, label: string) => (
    <button
      key={value}
      onClick={() => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set("filter", value); else n.delete("filter"); return n; })}
      className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${filter === value ? "border-crimson bg-crimson text-white" : "border-line bg-surface text-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="المهام"
        subtitle={loaded ? `${tasks.length} مهمة${late ? ` · ${late} متأخرة` : ""}` : undefined}
        actions={
          <button className="btn-primary" onClick={() => setCreating(true)} disabled={projects.length === 0}>
            <Plus className="size-5" aria-hidden /> مهمة جديدة
          </button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {chip("", "كل المهام")}
        {chip("overdue", `متأخرة (${late})`)}
        {chip("review", "بانتظار المراجعة")}
      </div>
      <TaskGroups
        tasks={shown}
        showAssignee
        empty={
          loaded ? (
            <div className="card px-6 py-14 text-center">
              <p className="text-lg font-bold">لا توجد مهام بعد</p>
              <p className="mt-2 text-sm text-muted">أنشئ مشروعاً وأضف إليه أعضاء ثم أسند المهام.</p>
            </div>
          ) : null
        }
      />
      {creating && <NewTaskModal onClose={() => setCreating(false)} />}
    </div>
  );
}
