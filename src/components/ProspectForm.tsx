import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { Modal } from "./Modal";
import { ErrorNote } from "./Bits";
import { Field, Select } from "./Forms";
import { createProspect, updateProspect } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { fromInputDate, toInputDate } from "../lib/dates";
import { LAST_POST_LABELS, OUTREACH_LABELS, QUALITY_LABELS, RUNNING_ADS_LABELS } from "../lib/labels";
import { asciiDigits, nextStatuses } from "../lib/prospects";
import { LAST_POSTS, type LastPost, type OutreachStatus, type ProspectDoc, type RunningAds, type WithId } from "../lib/types";
import { isHttpUrl } from "../lib/workflow";

const CREATE_STATUSES: OutreachStatus[] = ["not_contacted", "contacted", "follow_up", "meeting"];

/** Create (no `prospect`) or edit a prospect. Sales: always assigned to themselves, cannot reassign. */
export function ProspectFormModal({
  prospect,
  onClose,
  onSaved,
}: {
  prospect?: WithId<ProspectDoc>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { profile, isDirector } = useAuth();
  const { users } = useData();
  const salesMembers = useMemo(() => users.filter((u) => u.active && u.role === "sales"), [users]);

  const [name, setName] = useState(prospect?.name ?? "");
  const [city, setCity] = useState(prospect?.city ?? "");
  const [sector, setSector] = useState(prospect?.sector ?? "");
  const [pageUrl, setPageUrl] = useState(prospect?.pageUrl ?? "");
  const [followers, setFollowers] = useState(prospect ? String(prospect.followers) : "");
  const [lastPost, setLastPost] = useState<LastPost>(prospect?.lastPost ?? "");
  const [runningAds, setRunningAds] = useState<RunningAds>(prospect?.runningAds ?? "unclear");
  const [quality, setQuality] = useState<string>(prospect?.quality ? String(prospect.quality) : "");
  const [notes, setNotes] = useState(prospect?.notes ?? "");
  const [status, setStatus] = useState<OutreachStatus>(prospect?.outreachStatus ?? "not_contacted");
  const [lostReason, setLostReason] = useState(prospect?.lostReason ?? "");
  const [followUp, setFollowUp] = useState(toInputDate(prospect?.nextFollowUp));
  const [assigneeId, setAssigneeId] = useState(prospect?.assigneeId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = prospect ? nextStatuses(prospect.outreachStatus) : CREATE_STATUSES;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const url = pageUrl.trim();
    if (!name.trim()) return setError("اكتب اسم الزبون.");
    if (url && !isHttpUrl(url)) return setError("رابط الصفحة يجب أن يبدأ بـ https://");
    const f = asciiDigits(followers).replace(/[,\s]/g, "");
    if (f && !/^\d+$/.test(f)) return setError("عدد المتابعين أرقام فقط.");
    if (status === "lost" && !lostReason.trim()) return setError("اكتب سبب الخسارة باختصار.");

    const input = {
      name: name.trim(),
      city: city.trim(),
      sector: sector.trim(),
      pageUrl: url,
      followers: f ? Number(f) : 0,
      lastPost,
      runningAds,
      quality: (quality ? Number(quality) : null) as 1 | 2 | 3 | null,
      notes: notes.trim(),
      outreachStatus: status,
      nextFollowUp: fromInputDate(followUp),
      lostReason: status === "lost" ? lostReason.trim() : "",
    };
    setBusy(true);
    setError(null);
    try {
      if (prospect) {
        // sales can't reassign: leave assigneeId out of the patch entirely
        await updateProspect(prospect.id, isDirector ? { ...input, assigneeId } : input);
        onSaved(prospect.id);
      } else {
        onSaved(await createProspect({ ...input, assigneeId: isDirector ? assigneeId : profile!.id }, profile!.id));
      }
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={prospect ? "تعديل الزبون" : "زبون محتمل جديد"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="الاسم" htmlFor="pr-name">
          <input id="pr-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="المدينة" htmlFor="pr-city">
            <input id="pr-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
          </Field>
          <Field label="المجال" htmlFor="pr-sector">
            <input id="pr-sector" className="input" value={sector} onChange={(e) => setSector(e.target.value)} maxLength={100} placeholder="مطاعم، مقاهي، تجميل…" />
          </Field>
        </div>
        <Field label="رابط صفحة فيسبوك" htmlFor="pr-url">
          <input id="pr-url" type="url" inputMode="url" dir="ltr" className="input input-ltr" placeholder="https://facebook.com/…" value={pageUrl} onChange={(e) => setPageUrl(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عدد المتابعين" htmlFor="pr-fol">
            <input id="pr-fol" inputMode="numeric" dir="ltr" className="input input-ltr" placeholder="0" value={followers} onChange={(e) => setFollowers(e.target.value)} />
          </Field>
          <Field label="آخر منشور" htmlFor="pr-last">
            <Select id="pr-last" value={lastPost} onChange={(e) => setLastPost(e.target.value as LastPost)}>
              <option value="">غير معروف</option>
              {LAST_POSTS.map((l) => (
                <option key={l} value={l}>{LAST_POST_LABELS[l]}</option>
              ))}
            </Select>
          </Field>
          <Field label="يعلن الآن؟" htmlFor="pr-ads">
            <Select id="pr-ads" value={runningAds} onChange={(e) => setRunningAds(e.target.value as RunningAds)}>
              {(["yes", "unclear", "no"] as const).map((a) => (
                <option key={a} value={a}>{RUNNING_ADS_LABELS[a]}</option>
              ))}
            </Select>
          </Field>
          <Field label="جودة محتواهم الحالي" htmlFor="pr-q" hint="1 = ضعيف (أفضل فرصة لنا) · 3 = جيد">
            <Select id="pr-q" value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="">غير مقيّمة</option>
              {([1, 2, 3] as const).map((q) => (
                <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="ملاحظات" htmlFor="pr-notes">
          <textarea id="pr-notes" className="input h-auto min-h-24 py-3 leading-7" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="حالة التواصل" htmlFor="pr-status">
            <Select id="pr-status" value={status} onChange={(e) => setStatus(e.target.value as OutreachStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>{OUTREACH_LABELS[s]}</option>
              ))}
            </Select>
          </Field>
          <Field label="المتابعة القادمة" htmlFor="pr-follow">
            <input id="pr-follow" type="date" dir="ltr" className="input input-ltr" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
        </div>
        {status === "lost" && (
          <Field label="سبب الخسارة (إلزامي)" htmlFor="pr-lost">
            <input id="pr-lost" className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)} maxLength={500} />
          </Field>
        )}
        {isDirector && (
          <Field label="المسؤول (جلب الأعمال)" htmlFor="pr-assignee">
            <Select id="pr-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">غير مسند</option>
              {salesMembers.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </Select>
          </Field>
        )}
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {prospect ? "حفظ التعديلات" : "إضافة الزبون"}
        </button>
      </form>
    </Modal>
  );
}
