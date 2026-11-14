import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { AvatarStack, DueDate } from "../components/Bits";
import { NewProjectModal } from "../components/Forms";
import { STAGE_LABELS } from "../lib/labels";
import { STAGES, type ProjectDoc, type Stage, type WithId } from "../lib/types";

function ProjectCard({ project, reviewCount }: { project: WithId<ProjectDoc>; reviewCount: number }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="card block p-4 transition-colors hover:border-muted/50 focus-visible:border-crimson-text"
    >
      <h3 className="line-clamp-2 text-[0.95rem] font-bold leading-6">{project.title}</h3>
      <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
        <Building2 className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{project.clientName}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <DueDate due={project.dueDate} done={project.stage === "delivered"} />
        <AvatarStack ids={project.memberIds} />
      </div>
      {reviewCount > 0 && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
          {reviewCount === 1 ? "مهمة بانتظار المراجعة" : `${reviewCount} مهام بانتظار المراجعة`}
        </p>
      )}
    </Link>
  );
}

export function ProjectsPage() {
  const { role } = useAuth();
  const { projects, tasks, loaded } = useData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [mobileStage, setMobileStage] = useState<Stage>("lead");
  const canCreate = role === "director" || role === "sales";

  const reviewCounts = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => t.status === "in_review" && m.set(t.projectId, (m.get(t.projectId) ?? 0) + 1));
    return m;
  }, [tasks]);

  const byStage = useMemo(() => {
    const m = new Map<Stage, WithId<ProjectDoc>[]>(STAGES.map((s) => [s, []]));
    [...projects]
      .sort((a, b) => (a.dueDate?.toMillis() ?? Infinity) - (b.dueDate?.toMillis() ?? Infinity))
      .forEach((p) => m.get(p.stage)?.push(p));
    return m;
  }, [projects]);

  const renderList = (stage: Stage) => {
    const list = byStage.get(stage) ?? [];
    return list.length === 0 ? (
      <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">لا توجد مشاريع</p>
    ) : (
      <ul className="space-y-2.5">
        {list.map((p) => (
          <li key={p.id}>
            <ProjectCard project={p} reviewCount={reviewCounts.get(p.id) ?? 0} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <PageHeader
        title="المشاريع"
        subtitle={loaded ? `${projects.length} مشروع` : undefined}
        actions={
          canCreate && (
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="size-5" aria-hidden />
              مشروع جديد
            </button>
          )
        }
      />

      {loaded && projects.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold">لا توجد مشاريع بعد</p>
          <p className="mt-2 text-sm text-muted">
            {role === "director" ? "ابدأ بإنشاء أول مشروع." : role === "sales" ? "أنشئ مشروعاً جديداً للزبون الذي جلبته." : "لم تُسنَد إليك مشاريع بعد."}
          </p>
        </div>
      ) : (
        <>
          {/* Phones: choose a stage, see one column at a time */}
          <div className="md:hidden">
            <div role="tablist" aria-label="مراحل المشروع" className="mb-4 flex flex-wrap gap-2">
              {STAGES.map((s) => {
                const on = s === mobileStage;
                return (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setMobileStage(s)}
                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      on ? "border-crimson bg-crimson text-white" : "border-line bg-surface text-muted"
                    }`}
                  >
                    {STAGE_LABELS[s]}
                    <span className={`grid min-w-5 place-items-center rounded-full px-1 text-xs ${on ? "bg-white/20" : "bg-surface-2"}`}>
                      {byStage.get(s)?.length ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
            <div role="tabpanel">{renderList(mobileStage)}</div>
          </div>

          {/* Desktop: horizontal columns */}
          <div className="-mx-8 hidden gap-4 overflow-x-auto px-8 pb-4 md:flex">
            {STAGES.map((s, i) => (
              <section key={s} aria-label={STAGE_LABELS[s]} className="w-64 shrink-0 rounded-2xl border border-line bg-surface/60 p-3">
                <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold">
                  <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-xs text-muted">{i + 1}</span>
                  {STAGE_LABELS[s]}
                  <span className="ms-auto text-xs font-medium text-muted">{byStage.get(s)?.length ?? 0}</span>
                </h2>
                {renderList(s)}
              </section>
            ))}
          </div>
        </>
      )}

      {creating && (
        <NewProjectModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            navigate(`/projects/${id}`);
          }}
        />
      )}
    </>
  );
}
