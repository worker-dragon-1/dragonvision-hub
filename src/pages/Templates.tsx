import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Field, Select } from "../components/Forms";
import { Modal } from "../components/Modal";
import { CopyButton } from "../components/ProspectBits";
import { deleteTemplate, saveTemplate } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fillTemplate } from "../lib/prospects";
import type { TemplateDoc, WithId } from "../lib/types";

function TemplateForm({ template, onClose }: { template?: WithId<TemplateDoc>; onClose: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(template?.title ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return setError("اكتب العنوان ونص الرسالة.");
    setBusy(true);
    try {
      await saveTemplate({ id: template?.id, title, body }, profile!.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={template ? "تعديل القالب" : "قالب جديد"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="العنوان" htmlFor="tpl-title">
          <input id="tpl-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} autoFocus />
        </Field>
        <Field label="نص الرسالة" htmlFor="tpl-body" hint={<>استعمل <bdi dir="ltr">{"{name}"}</bdi> لاسم الزبون، واستعمل <bdi dir="ltr">{"{city}"}</bdi> لمدينته — يُستبدلان تلقائياً عند النسخ.</>}>
          <textarea id="tpl-body" className="input h-auto min-h-48 py-3 leading-7" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          حفظ القالب
        </button>
      </form>
    </Modal>
  );
}

export function TemplatesPage() {
  const { isDirector } = useAuth();
  const { templates, prospects, loaded } = useData();
  const [editing, setEditing] = useState<WithId<TemplateDoc> | "new" | null>(null);
  const [removing, setRemoving] = useState<WithId<TemplateDoc> | null>(null);
  const [prospectId, setProspectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prospect = prospects.find((p) => p.id === prospectId);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/prospects" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowRight className="size-4" aria-hidden /> الزبائن المحتملون
      </Link>
      <PageHeader
        title="قوالب الرسائل"
        subtitle={isDirector ? "أنشئ القوالب وعدّلها — يقرؤها فريق جلب الأعمال وينسخها." : "انسخ القالب وأرسله لزبونك."}
        actions={isDirector && (
          <button className="btn-primary" onClick={() => setEditing("new")}>
            <Plus className="size-5" aria-hidden /> قالب جديد
          </button>
        )}
      />

      <div className="card mb-5 p-4">
        <Field label="املأ القالب ببيانات زبون (اختياري)" htmlFor="tpl-prospect" hint={<>يستبدل <bdi dir="ltr">{"{name}"}</bdi> وكذلك <bdi dir="ltr">{"{city}"}</bdi> في النص قبل النسخ.</>}>
          <Select id="tpl-prospect" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
            <option value="">بدون — اعرض القالب كما هو</option>
            {prospects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>

      <ErrorNote>{error}</ErrorNote>

      {loaded && templates.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-lg font-bold">لا توجد قوالب بعد</p>
          <p className="mt-2 text-sm text-muted">{isDirector ? "أنشئ أول قالب." : "لم يضف المخرج قوالب بعد."}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => {
            const text = prospect ? fillTemplate(t.body, prospect) : t.body;
            return (
              <li key={t.id} className="card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold leading-7">{t.title}</h2>
                  {isDirector && (
                    <div className="flex shrink-0 gap-1.5">
                      <button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" onClick={() => setEditing(t)} aria-label={`تعديل ${t.title}`}>
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-crimson/10 hover:text-crimson-text" onClick={() => setRemoving(t)} aria-label={`حذف ${t.title}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
                <p data-testid="template-text" className="whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-sm leading-7">{text}</p>
                <CopyButton text={text} label="نسخ الرسالة" className="mt-3" />
              </li>
            );
          })}
        </ul>
      )}

      {editing && <TemplateForm template={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {removing && (
        <ConfirmDialog
          title="حذف القالب؟"
          message={`سيُحذف «${removing.title}».`}
          confirmLabel="نعم، احذف"
          busy={busy}
          onConfirm={async () => {
            setBusy(true);
            try { await deleteTemplate(removing.id); } catch (err) { setError(errorMessage(err)); }
            setBusy(false);
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
