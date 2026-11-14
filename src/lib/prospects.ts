// Pure prospect logic: priority score, follow-up buckets, status flow,
// message templates and the bulk-import parser. Nothing here touches Firestore.
import { LAST_POST_LABELS, RUNNING_ADS_LABELS } from "./labels";
import {
  LAST_POSTS,
  type LastPost,
  type OutreachStatus,
  type ProspectDoc,
  type RunningAds,
  type WithId,
} from "./types";

// ── priority score (computed in the app, never stored) ──────────────────────
// The best prospects RUN ADS but have WEAK creatives.
export type PriorityLevel = "high" | "medium" | "low";

export interface ScoreLine {
  label: string;
  points: number;
}

export interface Priority {
  score: number;
  level: PriorityLevel;
  label: string;
  lines: ScoreLine[];
}

const ADS_POINTS: Record<RunningAds, number> = { yes: 3, unclear: 1, no: 0 };
const QUALITY_POINTS = { 1: 3, 2: 1, 3: 0 } as const;
const LAST_POST_POINTS: Record<LastPost, number> = {
  this_week: 2,
  this_month: 2,
  "1_3_months": 1,
  older: 0,
  no_page: 0,
  "": 0,
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  high: "أولوية عالية",
  medium: "أولوية متوسطة",
  low: "أولوية منخفضة",
};

export function priorityOf(p: Pick<ProspectDoc, "runningAds" | "quality" | "lastPost" | "followers">): Priority {
  const lines: ScoreLine[] = [
    { label: `يعلن الآن: ${RUNNING_ADS_LABELS[p.runningAds]}`, points: ADS_POINTS[p.runningAds] },
    {
      label: p.quality ? `جودة المحتوى الحالي: ${p.quality} (الأضعف = فرصة أفضل)` : "جودة المحتوى الحالي: غير مقيّمة",
      points: p.quality ? QUALITY_POINTS[p.quality] : 0,
    },
    { label: `آخر منشور: ${LAST_POST_LABELS[p.lastPost]}`, points: LAST_POST_POINTS[p.lastPost] },
    { label: "5000 متابع أو أكثر", points: p.followers >= 5000 ? 1 : 0 },
  ];
  const score = lines.reduce((n, l) => n + l.points, 0);
  const level: PriorityLevel = score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  return { score, level, label: PRIORITY_LABELS[level], lines };
}

// ── follow-ups ──────────────────────────────────────────────────────────────
const DAY = 86_400_000;
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isClosed = (s: OutreachStatus) => s === "won" || s === "lost";

/** 0 = overdue · 1 = due today · 2 = later / none · 3 = closed (won / lost) */
export function followUpBucket(p: Pick<ProspectDoc, "nextFollowUp" | "outreachStatus">, now = startOfToday()): 0 | 1 | 2 | 3 {
  if (isClosed(p.outreachStatus)) return 3;
  if (!p.nextFollowUp) return 2;
  const t = p.nextFollowUp.toMillis();
  if (t < now) return 0;
  if (t < now + DAY) return 1;
  return 2;
}

/** Default order: overdue → today → by priority (high first) → name. Closed ones last. */
export function compareProspects(a: WithId<ProspectDoc>, b: WithId<ProspectDoc>): number {
  const ba = followUpBucket(a);
  const bb = followUpBucket(b);
  if (ba !== bb) return ba - bb;
  const pa = priorityOf(a).score;
  const pb = priorityOf(b).score;
  if (pa !== pb) return pb - pa;
  return a.name.localeCompare(b.name, "ar");
}

// ── status flow: not_contacted → contacted → follow_up → meeting → won | lost ─
export const STATUS_FLOW: OutreachStatus[] = ["not_contacted", "contacted", "follow_up", "meeting", "won"];

/** Statuses a prospect may move to from `current` (itself included). Won / lost are final. */
export function nextStatuses(current: OutreachStatus): OutreachStatus[] {
  if (isClosed(current)) return [current];
  const i = STATUS_FLOW.indexOf(current);
  return [current, ...STATUS_FLOW.slice(i + 1), "lost"];
}

export const normalizeName = (n: string) => n.replace(/\s+/g, " ").trim().toLowerCase();

// ── quick links ─────────────────────────────────────────────────────────────
export const adLibraryUrl = (name: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TN&search_type=keyword_unordered&q=${encodeURIComponent(name.trim())}`;

// ── message templates ───────────────────────────────────────────────────────
/** Replaces {name} and {city}. With no city, "{city}" becomes a neutral word. */
export function fillTemplate(body: string, p: Pick<ProspectDoc, "name" | "city">): string {
  return body.replaceAll("{name}", p.name).replaceAll("{city}", p.city.trim() || "منطقتكم");
}

export const DEFAULT_TEMPLATES = [
  {
    id: "default-first-contact",
    title: "رسالة أولى (عيّنة فيديو مجانية)",
    body: `عسلامة {name} 👋
أنا من فريق DragonVision، نصنعو فيديوهات إعلانية بالذكاء الاصطناعي.
شفت صفحتكم في {city} وعجبني شغلكم برشا. نحب نعملكم فيديو قصير (15–20 ثانية) مجاني لمنتوج من عندكم، كعيّنة، باش تشوفو الجودة بعينيكم.
إذا تحبو، ابعثولي اسم المنتوج وصورة ونرجعلكم بالفيديو في أقرب وقت. شنوة رايكم؟`,
  },
  {
    id: "default-follow-up",
    title: "رسالة متابعة",
    body: `عسلامة {name}،
نرجع نسألكم على الفيديو العيّنة اللي حكينا عليه. تحب نحضّرو لمنتوج من منتوجاتكم باش تشوفو النتيجة؟
الفيديو مجاني وما عليكم حتى التزام. نستناو ردكم 🙏`,
  },
] as const;

// ── bulk import ─────────────────────────────────────────────────────────────
export const IMPORT_HEADER = "الاسم | المتابعين | آخر منشور | يعلن الآن | الجودة | ملاحظات";
export const IMPORT_EXAMPLE = `${IMPORT_HEADER}
مطعم الياسمين | 5200 | هذا الأسبوع | نعم | 1 | صور المنتجات ضعيفة
صالون ليلى | 1800 | 1–3 أشهر | غير واضح | 2 | -
معرض الزيتون | - | الصفحة غير موجودة | لا | - | -`;

export interface ParsedRow {
  line: number; // 1-based line in the pasted text
  raw: string;
  data?: Pick<ProspectDoc, "name" | "followers" | "lastPost" | "runningAds" | "quality" | "notes">;
  error?: string;
}

/** Arabic-Indic / Persian digits → ASCII. */
export const asciiDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

const isEmpty = (v: string) => v === "" || /^[-–—]+$/.test(v);

const LAST_POST_PARSE: Record<string, LastPost> = {
  "هذا الأسبوع": "this_week",
  "هذا الشهر": "this_month",
  "1-3 أشهر": "1_3_months",
  "أكثر من 3 أشهر": "older",
  "الصفحة غير موجودة": "no_page",
};
const ADS_PARSE: Record<string, RunningAds> = { نعم: "yes", لا: "no", "غير واضح": "unclear" };

function parseFollowers(v: string): number | null {
  const t = asciiDigits(v).replace(/[,\s٬]/g, "").toLowerCase();
  const m = /^(\d+(?:\.\d+)?)([km])?$/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Parses the pipe-delimited paste. The first non-empty line is the header and is skipped. */
export function parseImport(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/);
  let headerSkipped = false;
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    if (!headerSkipped) {
      headerSkipped = true;
      return;
    }
    const line = i + 1;
    const cols = raw.split("|").map((c) => c.trim());
    if (cols.length < 6) {
      rows.push({ line, raw, error: `عدد الأعمدة ${cols.length} بدل 6 (الاسم | المتابعين | آخر منشور | يعلن الآن | الجودة | ملاحظات)` });
      return;
    }
    const [name, fol, last, ads, qual] = cols;
    const notesRaw = cols.slice(5).join(" | "); // extra pipes belong to the notes
    if (isEmpty(name)) return void rows.push({ line, raw, error: "الاسم فارغ" });
    if (name.length > 200) return void rows.push({ line, raw, error: "الاسم طويل جداً" });

    let followers = 0;
    if (!isEmpty(fol)) {
      const n = parseFollowers(fol);
      if (n === null) return void rows.push({ line, raw, error: `عدد المتابعين غير صالح: «${fol}»` });
      followers = n;
    }

    let lastPost: LastPost = "";
    if (!isEmpty(last)) {
      const key = asciiDigits(last).replace(/[–—]/g, "-").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-");
      const v = LAST_POST_PARSE[key];
      if (!v || !LAST_POSTS.includes(v as never)) return void rows.push({ line, raw, error: `قيمة «آخر منشور» غير معروفة: «${last}»` });
      lastPost = v;
    }

    let runningAds: RunningAds = "unclear";
    if (!isEmpty(ads)) {
      const v = ADS_PARSE[ads.replace(/\s+/g, " ")];
      if (!v) return void rows.push({ line, raw, error: `قيمة «يعلن الآن» غير معروفة: «${ads}» (نعم / لا / غير واضح)` });
      runningAds = v;
    }

    let quality: 1 | 2 | 3 | null = null;
    if (!isEmpty(qual)) {
      const q = asciiDigits(qual);
      if (!/^[123]$/.test(q)) return void rows.push({ line, raw, error: `الجودة يجب أن تكون 1 أو 2 أو 3: «${qual}»` });
      quality = Number(q) as 1 | 2 | 3;
    }

    rows.push({
      line,
      raw,
      data: { name: name.replace(/\s+/g, " "), followers, lastPost, runningAds, quality, notes: isEmpty(notesRaw) ? "" : notesRaw.slice(0, 5000) },
    });
  });
  return rows;
}

export interface ImportPlan {
  ready: (ParsedRow & { data: NonNullable<ParsedRow["data"]> })[];
  duplicates: { row: ParsedRow; reason: string }[];
  errors: ParsedRow[];
}

/** Splits parsed rows into: importable · exact-name duplicates · parse failures. */
export function planImport(rows: ParsedRow[], existingNames: string[]): ImportPlan {
  const seen = new Set(existingNames.map(normalizeName));
  const plan: ImportPlan = { ready: [], duplicates: [], errors: [] };
  for (const row of rows) {
    if (!row.data) {
      plan.errors.push(row);
      continue;
    }
    const key = normalizeName(row.data.name);
    if (seen.has(key)) {
      plan.duplicates.push({ row, reason: plan.ready.some((r) => normalizeName(r.data.name) === key) ? "مكرر داخل النص" : "موجود مسبقاً" });
      continue;
    }
    seen.add(key);
    plan.ready.push(row as ImportPlan["ready"][number]);
  }
  return plan;
}
