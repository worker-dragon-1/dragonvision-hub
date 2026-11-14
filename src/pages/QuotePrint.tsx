import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, Loader2, Printer } from "lucide-react";
import { db } from "../lib/db";
import { QuoteDocument } from "../components/QuoteDocument";
import { quoteForClient } from "../lib/portal";
import { COL, type ProjectDoc, type QuoteVersionDoc } from "../lib/types";

/** Director: the printable quote, outside the app shell. Print → "Save as PDF" in the browser. */
export function QuotePrint() {
  const { projectId, version } = useParams();
  const [data, setData] = useState<{ project: ProjectDoc; q: QuoteVersionDoc } | null | "missing">(null);

  useEffect(() => {
    if (!projectId || !version) return;
    Promise.all([getDoc(doc(db, COL.projects, projectId)), getDoc(doc(db, COL.projects, projectId, COL.quoteVersions, version))])
      .then(([p, q]) => setData(p.exists() && q.exists() ? { project: p.data() as ProjectDoc, q: q.data() as QuoteVersionDoc } : "missing"))
      .catch(() => setData("missing"));
  }, [projectId, version]);

  useEffect(() => {
    if (data && data !== "missing") document.title = `عرض سعر — ${data.project.title} — النسخة ${data.q.version}`;
  }, [data]);

  if (data === null) return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-muted" aria-label="جارٍ التحميل" /></div>;
  if (data === "missing") return <p className="p-10 text-center">عرض السعر غير موجود.</p>;

  return (
    <div className="print-bg min-h-dvh bg-[#26262c] px-3 py-6 sm:py-10">
      <div className="no-print mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <Link to={`/projects/${projectId}/quote`} className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowRight className="size-4" aria-hidden /> العودة إلى المحرر
        </Link>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="size-5" aria-hidden /> طباعة / حفظ PDF
        </button>
      </div>
      <QuoteDocument
        q={quoteForClient(data.q)}
        projectTitle={data.project.title}
        clientName={data.project.clientName}
        reference={`DV-${projectId!.slice(0, 6).toUpperCase()}-${data.q.version}`}
        issuedAt={data.q.updatedAt}
      />
    </div>
  );
}
