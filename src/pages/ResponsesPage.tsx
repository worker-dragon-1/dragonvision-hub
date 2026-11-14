import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { ResponseCard } from "./ClientPage";
import { markResponsesSeen } from "../lib/clientActions";
import { REVIEW_LABELS } from "../lib/portal";

/** Director: every client response, newest first; new ones highlighted. */
export function ResponsesPage() {
  const { portals, responses, projects, loaded } = useData();
  const seen = useMemo(() => Object.fromEntries(portals.map((p) => [p.id, p.responsesSeenAt?.toMillis() ?? 0])), [portals]);
  const sorted = useMemo(() => [...responses].sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now())), [responses]);
  const isNew = (r: (typeof sorted)[number]) => (r.createdAt?.toMillis() ?? Date.now()) > (seen[r.token] ?? 0);
  const unseenTokens = [...new Set(sorted.filter(isNew).map((r) => r.token))];
  const projectOf = (token: string) => projects.find((p) => p.id === portals.find((x) => x.id === token)?.projectId);
  const frozen = useRef<Set<string> | null>(null);
  if (frozen.current === null && loaded) frozen.current = new Set(sorted.filter(isNew).map((r) => `${r.token}/${r.id}`));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="ردود الزبائن"
        subtitle={loaded ? `${sorted.length} رد · ${sorted.filter(isNew).length} جديد` : undefined}
        actions={unseenTokens.length > 0 && (
          <button className="btn-ghost min-h-10 px-3.5 text-sm" onClick={() => markResponsesSeen(unseenTokens)}>
            <CheckCheck className="size-4" aria-hidden /> تعليم الكل كمقروء
          </button>
        )}
      />
      {loaded && sorted.length === 0 ? (
        <div className="card px-6 py-14 text-center"><p className="text-lg font-bold">لا توجد ردود بعد</p><p className="mt-2 text-sm text-muted">تظهر هنا موافقات الزبائن وطلبات التعديل من بوابة الزبون.</p></div>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((r) => {
            const p = projectOf(r.token);
            return (
              <ResponseCard
                key={`${r.token}/${r.id}`}
                r={r}
                highlight={frozen.current?.has(`${r.token}/${r.id}`) ?? isNew(r)}
                title={<>{p ? <Link to={`/projects/${p.id}/client`} className="hover:underline">{p.title}</Link> : "مشروع"} · {REVIEW_LABELS[r.item]} — النسخة {r.version}</>}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
