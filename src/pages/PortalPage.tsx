// The CLIENT portal — opened by an outside person through a secret link, without signing in.
// It reads exactly one portal document (by its token) and the client's own answers (by exact id).
// It deliberately imports nothing that knows about the team, tasks, finance or prospects.
import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, Lock, RotateCcw } from "lucide-react";
import { auth } from "../lib/firebase";
import { db } from "../lib/db";
import { LogoMark } from "../components/Logo";
import { submitResponse } from "../lib/clientActions";
import { fmtDate } from "../lib/dates";
import { fmtMoney } from "../lib/money";
import { REVIEW_LABELS, fmtDuration, paidRoundText, quoteTotal, responseId } from "../lib/portal";
import { COL, REVIEW_ITEMS, type ClientResponseDoc, type PortalDoc, type PortalItem, type PortalQuote, type ReviewItem } from "../lib/types";

const TOKEN_RE = /^[A-Za-z0-9]{32,64}$/;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink">
      <header className="border-b border-line bg-surface/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          <LogoMark className="size-8" />
          <div className="leading-tight">
            <p dir="ltr" className="text-start text-base font-extrabold">Dragon<span className="text-crimson-text">Vision</span></p>
            <p className="text-xs text-muted">متابعة مشروعكم</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-5">{children}</main>
    </div>
  );
}

function Invalid({ signedIn }: { signedIn: boolean }) {
  return (
    <Shell>
      <div data-testid="portal-invalid" className="card mt-10 px-6 py-14 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-crimson/15 text-crimson-text"><Lock className="size-7" aria-hidden /></span>
        <h1 className="text-xl font-bold">هذا الرابط لم يعد صالحاً</h1>
        <p className="mt-2 text-sm leading-7 text-muted">تواصلوا مع DragonVision للحصول على رابط جديد.</p>
        {signedIn && <p className="mt-3 text-xs leading-6 text-muted">أنت مسجَّل الدخول بحساب من الفريق. لمعاينة الرابط كما يراه الزبون افتحه في نافذة خاصة.</p>}
      </div>
    </Shell>
  );
}

function QuoteView({ q }: { q: PortalQuote }) {
  const total = quoteTotal(q);
  const row = (k: string, v: React.ReactNode, strong = false) => (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "text-base font-extrabold" : "text-sm"}`}><span className={strong ? "" : "text-muted"}>{k}</span><span className="text-end">{v}</span></div>
  );
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {q.deliverables.map((d, i) => (
          <li key={i} className="rounded-xl bg-surface-2 p-3 text-sm">
            <p className="font-bold">{d.title}</p>
            <p className="mt-0.5 text-xs text-muted">{fmtDuration(d.durationSec)} · <bdi dir="ltr">{d.formats.join(" · ")}</bdi> · {d.language}</p>
          </li>
        ))}
      </ul>
      <div className="divide-y divide-line rounded-xl border border-line px-4">
        {row("سعر الإنتاج", fmtMoney(q.price))}
        {q.confidential && row("السرية (عدم العرض في أعمالنا)", fmtMoney(q.confidentialityPrice))}
        {row("المجموع", <span data-testid="portal-total">{fmtMoney(total)}</span>, true)}
        {row("العربون قبل بدء الإنتاج", fmtMoney(q.depositAmount))}
        {row("التسليم", q.deliveryDate ? fmtDate(q.deliveryDate) : "يُحدَّد عند القبول")}
        {row("جولات التعديل المشمولة", q.revisionsIncluded)}
        {row("كل جولة إضافية", paidRoundText(q.extraRevisionPrice))}
        {row("صالح حتى", fmtDate(q.validUntil))}
      </div>
      <p className="text-sm leading-7 text-muted">{q.confidential ? "سري: لن نعرض الفيديو في معرض أعمالنا." : "يحق لـ DragonVision عرض الفيديو النهائي في معرض أعمالها (يمكن طلب السرية مقابل مبلغ إضافي)."}</p>
      {q.paymentTerms && <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-sm leading-7">{q.paymentTerms}</p>}
    </div>
  );
}

function Respond({ token, item, it, paidRound, fee, disabled }: { token: string; item: ReviewItem; it: PortalItem; paidRound: boolean; fee: number; disabled: boolean }) {
  const [mode, setMode] = useState<"approve" | "changes" | null>(null);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = REVIEW_LABELS[item];

  const send = async () => {
    if (name.trim().length < 2) return setError("اكتب اسمك الكامل.");
    if (mode === "changes" && comment.trim().length < 3) return setError("اكتب ما تريدون تعديله.");
    if (mode === "changes" && paidRound && !ack) return setError("يرجى الموافقة على تكلفة هذه الجولة أولاً.");
    setBusy(true); setError(null);
    try {
      await submitResponse(token, {
        item, version: it.version, decision: mode === "approve" ? "approved" : "changes_requested",
        name: name.trim().slice(0, 80), comment: mode === "changes" ? comment.trim().slice(0, 2000) : "", extraRoundAck: mode === "changes" && paidRound && ack,
      });
    } catch {
      setError("تعذّر الإرسال. ربما تغيّرت النسخة أو أُرسل رد سابقاً — حدّثوا الصفحة.");
      setBusy(false);
    }
  };

  if (disabled) return <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">معاينة: لا يمكن الرد وأنت مسجَّل الدخول بحساب من الفريق.</p>;
  if (!mode) {
    return (
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button className="btn-primary flex-1" onClick={() => setMode("approve")}><CheckCircle2 className="size-5" aria-hidden /> موافقة</button>
        <button className="btn-ghost flex-1" onClick={() => setMode("changes")}><RotateCcw className="size-5" aria-hidden /> طلب تعديلات</button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
      {mode === "changes" && paidRound && (
        <div data-testid="paid-warning" className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-3.5 text-sm leading-7 text-amber-100">
          <p className="flex items-center gap-2 font-bold text-amber-300"><AlertTriangle className="size-4" aria-hidden /> هذه جولة تعديل مدفوعة</p>
          <p>استُهلكت جولات التعديل المشمولة في العرض. تكلفة هذه الجولة: <b>{paidRoundText(fee)}</b>.</p>
          <label className="mt-2 flex cursor-pointer items-start gap-2.5">
            <input id="ack" type="checkbox" className="mt-1 size-5 accent-[#C8102E]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>أوافق على تكلفة هذه الجولة الإضافية.</span>
          </label>
        </div>
      )}
      <div>
        <label htmlFor={`name-${item}`} className="label">{mode === "approve" ? "اكتبوا الاسم الكامل (يُعتبر توقيعاً)" : "الاسم الكامل"}</label>
        <input id={`name-${item}`} className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
      </div>
      {mode === "changes" && (
        <div>
          <label htmlFor={`comment-${item}`} className="label">ما الذي تريدون تعديله؟</label>
          <textarea id={`comment-${item}`} className="input h-auto min-h-28 py-3 leading-7" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-crimson-text">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy} onClick={send}>
          {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
          {mode === "approve" ? `أوافق على ${label}` : "إرسال طلب التعديل"}
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => { setMode(null); setError(null); }}>رجوع</button>
      </div>
    </div>
  );
}

export function PortalPage({ token }: { token: string }) {
  const valid = TOKEN_RE.test(token);
  const [portal, setPortal] = useState<PortalDoc | null | "invalid">(valid ? null : "invalid");
  const [answers, setAnswers] = useState<Record<string, ClientResponseDoc | null>>({});
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(!!u)), []);
  useEffect(() => {
    document.title = "DragonVision — متابعة مشروعكم";
    if (!valid) return;
    return onSnapshot(
      doc(db, COL.portals, token),
      (snap) => setPortal(snap.exists() ? (snap.data() as PortalDoc) : "invalid"),
      () => setPortal("invalid"), // revoked, unknown or not allowed → same message
    );
  }, [token, valid]);

  const versions = portal && portal !== "invalid" ? REVIEW_ITEMS.map((k) => `${k}:${portal.items[k]?.version ?? 0}`).join(",") : "";
  useEffect(() => {
    if (!versions) return;
    const offs = versions.split(",").filter((s) => !s.endsWith(":0")).map((s) => {
      const [item, v] = s.split(":");
      const id = responseId(item as ReviewItem, Number(v));
      return onSnapshot(doc(db, COL.portals, token, COL.responses, id), (snap) => setAnswers((a) => ({ ...a, [id]: snap.exists() ? (snap.data() as ClientResponseDoc) : null })), () => undefined);
    });
    return () => offs.forEach((o) => o());
  }, [token, versions]);

  const used = useMemo(() => {
    if (!portal || portal === "invalid") return 0;
    // rounds counted at the last publish + a change request on the current version not yet counted
    const pending = portal.countedItems.filter((k) => {
      const it = portal.items[k];
      return it && (answers[responseId(k, it.version)] ?? it.answer)?.decision === "changes_requested";
    }).length;
    return portal.revisionsUsed + pending;
  }, [portal, answers]);

  if (portal === "invalid") return <Invalid signedIn={signedIn} />;
  if (!portal) return <Shell><div className="grid place-items-center py-24" role="status"><Loader2 className="size-7 animate-spin text-muted" aria-label="جارٍ التحميل" /></div></Shell>;

  const left = Math.max(0, portal.revisionsIncluded - used);
  return (
    <Shell>
      <section className="mb-5">
        <h1 data-testid="portal-title" className="text-2xl font-extrabold leading-9">{portal.projectTitle}</h1>
        <p className="mt-1 text-sm text-muted">{portal.clientName}</p>
      </section>

      <section className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p data-testid="portal-revisions" className="text-base font-extrabold">جولات التعديل: <bdi dir="ltr">{used} / {portal.revisionsIncluded}</bdi></p>
          <p className="mt-0.5 text-xs leading-6 text-muted">
            {left > 0 ? `متبقٍ لكم ${left} من الجولات المشمولة.` : `استُهلكت الجولات المشمولة. كل جولة إضافية: ${paidRoundText(portal.extraRevisionPrice)}.`}
          </p>
        </div>
      </section>

      <ol className="space-y-4">
        {REVIEW_ITEMS.map((item, i) => {
          const it = portal.items[item];
          const ans = it ? (answers[responseId(item, it.version)] ?? it.answer) : undefined;
          const counted = (portal.countedItems as string[]).includes(item);
          return (
            <li key={item} data-testid={`portal-item-${item}`} className={`card p-4 sm:p-5 ${!it ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold"><span className="text-muted">{i + 1}.</span> {REVIEW_LABELS[item]}{it && it.version > 1 ? ` — النسخة ${it.version}` : ""}</h2>
                {!it ? (
                  <span className="badge border-line bg-surface-2 text-muted"><Clock className="size-3" aria-hidden /> لم يُنشر بعد</span>
                ) : ans?.decision === "approved" ? (
                  <span className="badge border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-3" aria-hidden /> تمت الموافقة</span>
                ) : ans ? (
                  <span className="badge border-amber-400/30 bg-amber-400/10 text-amber-300"><RotateCcw className="size-3" aria-hidden /> طُلبت تعديلات</span>
                ) : it.open ? (
                  <span className="badge border-sky-400/30 bg-sky-400/10 text-sky-300">بانتظار ردكم</span>
                ) : (
                  <span className="badge border-line bg-surface-2 text-muted">مغلق</span>
                )}
              </div>

              {it && (
                <div className="mt-3 space-y-3">
                  {it.note && <p className="rounded-xl bg-surface-2 p-3 text-sm leading-7">{it.note}</p>}
                  {item === "quote" && portal.quote ? <QuoteView q={portal.quote} /> : null}
                  {item !== "quote" && it.text && <p data-testid="script-text" className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-4 text-[0.95rem] leading-8">{it.text}</p>}
                  {item !== "quote" && it.link && (
                    <a href={it.link} target="_blank" rel="noopener noreferrer" className="btn-ghost w-full sm:w-auto"><ExternalLink className="size-5" aria-hidden /> مشاهدة {REVIEW_LABELS[item]}</a>
                  )}

                  {ans?.decision === "approved" && (
                    <p data-testid={`approved-${item}`} className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3 text-sm text-emerald-300">
                      وافق عليها <b>{ans.name}</b> بتاريخ {fmtDate(ans.createdAt)}.
                    </p>
                  )}
                  {ans?.decision === "changes_requested" && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm leading-7">
                      <p className="font-bold text-amber-300">تم إرسال طلب التعديل — سنعود إليكم بنسخة جديدة.</p>
                      <p className="whitespace-pre-wrap text-fg/90">{ans.comment}</p>
                    </div>
                  )}
                  {!ans && it.open && (
                    <Respond token={token} item={item} it={it} fee={portal.extraRevisionPrice} disabled={signedIn}
                      paidRound={counted && used >= portal.revisionsIncluded} />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-center text-xs leading-6 text-muted">هذا الرابط خاص بكم — يرجى عدم مشاركته.</p>
    </Shell>
  );
}
