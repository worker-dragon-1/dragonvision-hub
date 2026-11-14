import { useEffect, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { useData } from "../context/DataContext";
import { PageHeader } from "../components/PageHeader";
import { ErrorNote } from "../components/Bits";
import { Field } from "../components/Forms";
import { saveFinanceSettings } from "../lib/actions";
import { errorMessage } from "../lib/authErrors";
import { DEFAULT_FINANCE_SETTINGS } from "../lib/finance";
import { fmtMoney, parseMoney } from "../lib/money";

/** Director only: settings/finance. */
export function SettingsPage() {
  const { financeSettings, loaded } = useData();
  const [min, setMin] = useState(String(financeSettings.minProjectPrice));
  const [delay, setDelay] = useState(String(financeSettings.paymentDelayDays));
  const [inc, setInc] = useState(String(financeSettings.includedRevisions));
  const [extra, setExtra] = useState(String(financeSettings.extraRevisionPrice));
  const [dep, setDep] = useState(String(financeSettings.depositPercent));
  const [conf, setConf] = useState(String(financeSettings.confidentialityPrice));
  const [valid, setValid] = useState(String(financeSettings.quoteValidityDays));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pick up the stored values once they arrive
  useEffect(() => {
    if (!loaded) return;
    setMin(String(financeSettings.minProjectPrice));
    setDelay(String(financeSettings.paymentDelayDays));
    setInc(String(financeSettings.includedRevisions));
    setExtra(String(financeSettings.extraRevisionPrice));
    setDep(String(financeSettings.depositPercent));
    setConf(String(financeSettings.confidentialityPrice));
    setValid(String(financeSettings.quoteValidityDays));
  }, [loaded, financeSettings]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = parseMoney(min);
    const d = /^\d+$/.test(delay.trim()) ? Number(delay) : null;
    if (m === null) return setError("الحد الأدنى للسعر رقم صحيح.");
    if (d === null || d > 365) return setError("مدة الدفع عدد أيام صحيح (0–365).");
    const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);
    const i = int(inc), x = parseMoney(extra), dp = parseMoney(dep), c = parseMoney(conf), vd = int(valid);
    if (i === null || i > 50) return setError("عدد جولات التعديل المشمولة عدد صحيح (0–50).");
    if (x === null || c === null) return setError("تحقق من الأسعار.");
    if (dp === null || dp > 100) return setError("نسبة العربون بين 0 و100.");
    if (vd === null || vd < 1 || vd > 365) return setError("صلاحية العرض بين 1 و365 يوماً.");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // defaultCommissionRate is no longer editable (no commissions for now) but the settings
      // document keeps it, unchanged, because firestore.rules require the field.
      await saveFinanceSettings({
        defaultCommissionRate: financeSettings.defaultCommissionRate,
        minProjectPrice: m,
        paymentDelayDays: d,
        includedRevisions: i,
        extraRevisionPrice: x,
        depositPercent: dp,
        confidentialityPrice: c,
        quoteValidityDays: vd,
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const D = DEFAULT_FINANCE_SETTINGS;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="الإعدادات" subtitle="إعدادات المالية — للمخرج فقط." />
      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6" noValidate>
        <Field label="الحد الأدنى لسعر المشروع (د.ت)" htmlFor="s-min" hint={`يظهر تنبيه إن كان السعر أقل منه — دون منع الحفظ (الافتراضي ${fmtMoney(D.minProjectPrice)}).`}>
          <input id="s-min" inputMode="decimal" dir="ltr" className="input input-ltr" value={min} onChange={(e) => { setMin(e.target.value); setSaved(false); }} />
        </Field>
        <Field label="مهلة دفع المستحقات (أيام)" htmlFor="s-delay" hint={`بعد أن يدفع الزبون كامل المبلغ، تُدفع مستحقات الفريق خلال هذه المدة (الافتراضي ${D.paymentDelayDays} أيام).`}>
          <input id="s-delay" inputMode="numeric" dir="ltr" className="input input-ltr" value={delay} onChange={(e) => { setDelay(e.target.value); setSaved(false); }} />
        </Field>
        <div className="border-t border-line pt-5">
          <h2 className="mb-4 text-base font-bold">عرض السعر والاتفاق (القيم الافتراضية لكل مشروع)</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="جولات التعديل المشمولة" htmlFor="s-inc">
              <input id="s-inc" inputMode="numeric" dir="ltr" className="input input-ltr" value={inc} onChange={(e) => { setInc(e.target.value); setSaved(false); }} />
            </Field>
            <Field label="سعر كل جولة إضافية (د.ت)" htmlFor="s-extra" hint="تُضاف إليه تكلفة الأدوات الفعلية لتلك الجولة.">
              <input id="s-extra" inputMode="decimal" dir="ltr" className="input input-ltr" value={extra} onChange={(e) => { setExtra(e.target.value); setSaved(false); }} />
            </Field>
            <Field label="العربون (% من السعر)" htmlFor="s-dep" hint="يغطي تكاليف الأدوات، ومطلوب قبل بدء الإنتاج.">
              <input id="s-dep" inputMode="decimal" dir="ltr" className="input input-ltr" value={dep} onChange={(e) => { setDep(e.target.value); setSaved(false); }} />
            </Field>
            <Field label="سعر السرية (د.ت)" htmlFor="s-conf" hint="افتراضياً يحق لنا عرض الفيديو في أعمالنا؛ يدفع الزبون هذا المبلغ لإبقائه سرياً.">
              <input id="s-conf" inputMode="decimal" dir="ltr" className="input input-ltr" value={conf} onChange={(e) => { setConf(e.target.value); setSaved(false); }} />
            </Field>
            <Field label="صلاحية عرض السعر (أيام)" htmlFor="s-valid">
              <input id="s-valid" inputMode="numeric" dir="ltr" className="input input-ltr" value={valid} onChange={(e) => { setValid(e.target.value); setSaved(false); }} />
            </Field>
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
            حفظ الإعدادات
          </button>
          {saved && <span role="status" className="flex items-center gap-1.5 text-sm text-emerald-300"><Check className="size-4" aria-hidden /> تم الحفظ</span>}
        </div>
      </form>
    </div>
  );
}
