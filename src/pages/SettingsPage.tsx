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
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pick up the stored values once they arrive
  useEffect(() => {
    if (!loaded) return;
    setMin(String(financeSettings.minProjectPrice));
    setDelay(String(financeSettings.paymentDelayDays));
  }, [loaded, financeSettings]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = parseMoney(min);
    const d = /^\d+$/.test(delay.trim()) ? Number(delay) : null;
    if (m === null) return setError("الحد الأدنى للسعر رقم صحيح.");
    if (d === null || d > 365) return setError("مدة الدفع عدد أيام صحيح (0–365).");
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // defaultCommissionRate is no longer editable (no commissions for now) but the settings
      // document keeps it, unchanged, because firestore.rules require the field.
      await saveFinanceSettings({ defaultCommissionRate: financeSettings.defaultCommissionRate, minProjectPrice: m, paymentDelayDays: d });
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
