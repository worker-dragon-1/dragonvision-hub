// Money formatting for an RTL UI.
//
// The classic bug: in right-to-left text the bidi algorithm reverses the order of
// digit groups separated by a plain space ("1 250" -> "250 1") and can move the
// currency to the wrong side. Two things prevent that here:
//   - the whole number is wrapped in an LTR isolate (U+2066 ... U+2069), so whatever
//     sits inside it keeps left-to-right order and its group separators can no
//     longer be reordered, and
//   - the number is followed by a no-break space and the currency sign, so
//     "1 250 د.ت" reads number -> currency.
// The thousands separator is a true THIN SPACE (U+2009; U+202F renders only ~2.6px in
// Cairo, so the groups looked fused) + a WORD JOINER (U+2060) so a line break can never
// split a number in the middle.
// The invisible characters are built with String.fromCharCode on purpose: written
// literally they are easy to strip by accident (editors, formatters, copy/paste).
import { asciiDigits } from "./prospects";

const ch = String.fromCharCode;
const LRI = ch(0x2066); // left-to-right isolate
const PDI = ch(0x2069); // pop directional isolate
const THIN = ch(0x2009, 0x2060); // thousands separator: thin space + word joiner
const NBSP = ch(0x00a0);
const MINUS = ch(0x2212);
export const CURRENCY = "د.ت";

const SPACES = new RegExp("[\\s" + ch(0x202f, 0x00a0, 0x2009, 0x2060) + "]", "g");
const CONTROLS = new RegExp("[" + ch(0x2066) + "-" + ch(0x2069) + ch(0x2060) + "]", "g");
const SPACE_LIKE = new RegExp("[" + ch(0x202f, 0x00a0, 0x2009) + "]", "g");

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 1250 -> "1 250" · 99.5 -> "99.5" · 0.125 -> "0.125" (Western digits, up to 3 decimals). */
export function fmtNumber(n: number): string {
  const v = round3(Math.abs(n));
  const [int, frac] = v.toFixed(3).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  const f = frac.replace(/0+$/, "");
  return f ? `${grouped}.${f}` : grouped;
}

/** "1 250 د.ت" - safe inside any RTL sentence. */
export function fmtMoney(n: number): string {
  const neg = round3(n) < 0;
  return `${LRI}${neg ? MINUS : ""}${fmtNumber(n)}${PDI}${NBSP}${CURRENCY}`;
}

/** "12%" */
export const fmtPercent = (n: number) => `${LRI}${fmtNumber(n)}%${PDI}`;

/** User input -> number. Accepts Arabic-Indic digits, spaces, "," or "." as the decimal mark. "" -> 0. null = invalid. */
export function parseMoney(input: string): number | null {
  const t = asciiDigits(input).replace(SPACES, "").replace(",", ".");
  if (t === "") return 0;
  if (!/^\d+(\.\d{0,3})?$/.test(t)) return null;
  return round3(parseFloat(t));
}

/** For tests / plain-text comparisons: removes the invisible bidi controls and normalises spaces. */
export const plainMoney = (s: string) => s.replace(CONTROLS, "").replace(SPACE_LIKE, " ");
