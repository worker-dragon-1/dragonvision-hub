import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/db";
import { useData } from "../context/DataContext";
import { revisionStats } from "../lib/portal";
import { COL, type QuoteVersionDoc, type WithId } from "../lib/types";

/** Director: the quote versions of a project (live). */
export function useQuoteVersions(projectId: string | undefined) {
  const [versions, setVersions] = useState<WithId<QuoteVersionDoc>[] | null>(null);
  useEffect(() => {
    if (!projectId) return;
    return onSnapshot(
      collection(db, COL.projects, projectId, COL.quoteVersions),
      (snap) => setVersions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as QuoteVersionDoc) })).sort((a, b) => a.version - b.version)),
      (e) => console.error("[quotes]", e),
    );
  }, [projectId]);
  return versions;
}

/** Director: everything client-related for one project — portals, responses, revision rounds. */
export function useProjectClient(projectId: string | undefined) {
  const { portals, responses, financeSettings } = useData();
  return useMemo(() => {
    const mine = portals.filter((p) => p.projectId === projectId).sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
    const active = mine.find((p) => !p.revoked);
    const tokens = new Set(mine.map((p) => p.id));
    const projectResponses = responses.filter((r) => tokens.has(r.token)).sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now()));
    const included = active?.revisionsIncluded ?? mine[0]?.revisionsIncluded ?? financeSettings.includedRevisions;
    const counted = active?.countedItems ?? mine[0]?.countedItems ?? ["final"];
    const stats = revisionStats(projectResponses, counted, included);
    const seenAt = Math.max(0, ...mine.map((p) => p.responsesSeenAt?.toMillis() ?? 0));
    const unseen = projectResponses.filter((r) => (r.createdAt?.toMillis() ?? Date.now()) > seenAt);
    return { portals: mine, active, responses: projectResponses, stats, unseen, extraRevisionPrice: active?.extraRevisionPrice ?? financeSettings.extraRevisionPrice };
  }, [portals, responses, projectId, financeSettings]);
}
