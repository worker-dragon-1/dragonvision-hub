import type { Timestamp } from "firebase/firestore";
import { fmtDate } from "../lib/dates";
import { fmtMoney, fmtPercent } from "../lib/money";
import { fmtDuration, quoteTotal } from "../lib/portal";
import type { PortalQuote } from "../lib/types";

/**
 * The printable Arabic quote — always "paper" colours (white page, dark text, crimson accents),
 * so it looks the same on screen, printed on white paper, or saved as PDF.
 */
export function QuoteDocument({ q, projectTitle, clientName, reference, issuedAt }: {
  q: PortalQuote;
  projectTitle: string;
  clientName: string;
  reference: string;
  issuedAt: Timestamp | null;
}) {
  const total = quoteTotal(q);
  const depositPct = total > 0 ? Math.round((q.depositAmount / total) * 100) : 0;
  const cell = "border-b border-[#e7e2e3] px-3 py-2.5 text-start align-top";
  return (
    <article className="print-paper mx-auto w-full max-w-[210mm] bg-white p-6 text-[#1b1416] shadow-2xl sm:p-10" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-4 border-[#C8102E] pb-5">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 512 512" className="size-12" aria-hidden><rect width="512" height="512" rx="112" fill="#C8102E" /><path d="M206 160v192c0 12 13 19 23 13l158-96c9-6 9-20 0-26L229 147c-10-6-23 1-23 13Z" fill="#fff" /></svg>
          <div>
            <p dir="ltr" className="text-start text-xl font-extrabold tracking-tight">Dragon<span className="text-[#C8102E]">Vision</span></p>
            <p className="text-xs text-[#6b5f62]">استوديو فيديو بالذكاء الاصطناعي — تونس</p>
          </div>
        </div>
        <div className="text-end">
          <h1 className="text-2xl font-extrabold text-[#9c0b24]">عرض سعر</h1>
          <p className="mt-1 text-xs text-[#6b5f62]">المرجع: <bdi dir="ltr">{reference}</bdi> · النسخة {q.version}</p>
          {issuedAt && <p className="text-xs text-[#6b5f62]">التاريخ: {fmtDate(issuedAt)}</p>}
          <p className="text-xs font-semibold text-[#9c0b24]">صالح حتى: {fmtDate(q.validUntil)}</p>
        </div>
      </header>

      <section className="mt-5 grid gap-1 rounded-lg bg-[#faf6f6] p-4 text-sm sm:grid-cols-2">
        <p><span className="text-[#6b5f62]">إلى: </span><b>{clientName}</b></p>
        <p><span className="text-[#6b5f62]">المشروع: </span><b>{projectTitle}</b></p>
      </section>

      <h2 className="mb-2 mt-6 text-base font-extrabold text-[#9c0b24]">المُخرَجات</h2>
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[#f4ecec] text-xs text-[#6b5f62]">
          <tr><th className={cell}>#</th><th className={cell}>المُخرَج</th><th className={cell}>المدة</th><th className={cell}>المقاسات</th><th className={cell}>اللغة</th></tr>
        </thead>
        <tbody>
          {q.deliverables.map((d, i) => (
            <tr key={i}>
              <td className={cell}>{i + 1}</td>
              <td className={`${cell} font-semibold`}>{d.title}</td>
              <td className={cell}>{fmtDuration(d.durationSec)}</td>
              <td className={cell}><bdi dir="ltr">{d.formats.join(" · ")}</bdi></td>
              <td className={cell}>{d.language}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 mt-6 text-base font-extrabold text-[#9c0b24]">السعر</h2>
      <table className="w-full max-w-md border-collapse text-sm">
        <tbody>
          <tr><td className={cell}>سعر الإنتاج</td><td className={`${cell} text-end`}>{fmtMoney(q.price)}</td></tr>
          {q.confidential && <tr><td className={cell}>السرية (عدم العرض في أعمالنا)</td><td className={`${cell} text-end`}>{fmtMoney(q.confidentialityPrice)}</td></tr>}
          <tr className="text-base font-extrabold"><td className={cell}>المجموع</td><td data-testid="print-total" className={`${cell} text-end text-[#9c0b24]`}>{fmtMoney(total)}</td></tr>
          <tr><td className={cell}>العربون ({fmtPercent(depositPct)}) — قبل بدء الإنتاج</td><td className={`${cell} text-end`}>{fmtMoney(q.depositAmount)}</td></tr>
          <tr><td className={cell}>الباقي عند التسليم</td><td className={`${cell} text-end`}>{fmtMoney(Math.max(0, total - q.depositAmount))}</td></tr>
        </tbody>
      </table>

      <h2 className="mb-2 mt-6 text-base font-extrabold text-[#9c0b24]">الشروط</h2>
      <ul className="list-disc space-y-1.5 ps-5 text-sm leading-7">
        <li>موعد التسليم: {q.deliveryDate ? fmtDate(q.deliveryDate) : "يُحدَّد عند قبول العرض"}.</li>
        <li>يشمل العرض {q.revisionsIncluded} جولات تعديل. كل جولة إضافية: {fmtMoney(q.extraRevisionPrice)} + تكلفة الأدوات الفعلية لتلك الجولة.</li>
        <li>{q.confidential ? "سري: لن تعرض DragonVision الفيديو في معرض أعمالها." : "يحق لـ DragonVision عرض الفيديو النهائي في معرض أعمالها، ما لم يُختر خيار السرية."}</li>
        <li>العربون يغطي تكاليف أدوات الإنتاج ويُدفع قبل بدء العمل.</li>
      </ul>
      {q.paymentTerms && (
        <>
          <h3 className="mt-4 text-sm font-bold">شروط الدفع</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-7">{q.paymentTerms}</p>
        </>
      )}

      <section className="mt-8 grid gap-6 border-t border-[#e7e2e3] pt-5 text-sm sm:grid-cols-2">
        <div>
          <p className="font-bold">موافقة الزبون</p>
          <p className="mt-1 text-xs text-[#6b5f62]">عبر رابط المتابعة الخاص بكم، أو بالتوقيع هنا.</p>
          <div className="mt-8 border-b border-dashed border-[#b9aeb1]" />
          <p className="mt-1 text-xs text-[#6b5f62]">الاسم والتوقيع والتاريخ</p>
        </div>
        <div>
          <p className="font-bold">DragonVision</p>
          <div className="mt-[3.25rem] border-b border-dashed border-[#b9aeb1]" />
          <p className="mt-1 text-xs text-[#6b5f62]">المخرج</p>
        </div>
      </section>
    </article>
  );
}
