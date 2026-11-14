import { Timestamp } from "firebase/firestore";

// Gregorian calendar, Latin digits, Arabic (Tunisian) month names.
const LOCALE = "ar-TN-u-ca-gregory-nu-latn";

const toDate = (t: Timestamp | Date | null | undefined): Date | null =>
  !t ? null : t instanceof Date ? t : t.toDate();

export function fmtDate(t: Timestamp | null | undefined): string {
  const d = toDate(t);
  if (!d) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(d);
}

export function fmtDateTime(t: Timestamp | null | undefined): string {
  const d = toDate(t);
  if (!d) return "";
  return new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** "منذ 3 ساعات" */
export function fmtRelative(t: Timestamp | null | undefined): string {
  const d = toDate(t);
  if (!d) return "";
  const secs = Math.round((d.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("ar-TN-u-nu-latn", { numeric: "auto" });
  const abs = Math.abs(secs);
  if (abs < 60) return "الآن";
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  return rtf.format(Math.round(secs / 86400), "day");
}

/** Timestamp → "YYYY-MM-DD" for <input type="date"> */
export function toInputDate(t: Timestamp | null | undefined): string {
  const d = toDate(t);
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "YYYY-MM-DD" → end of that day (local), so a task due today is not overdue until tonight. */
export function fromInputDate(v: string): Timestamp | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 23, 59, 0));
}

export const isOverdue = (due: Timestamp | null | undefined, done = false): boolean =>
  !!due && !done && due.toMillis() < Date.now();
