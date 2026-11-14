import type { ActivityType, Channel, LastPost, OutreachStatus, PayoutStatus, Role, RunningAds, Stage, TaskStatus } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  director: "المخرج",
  sales: "جلب الأعمال",
  editor: "المونتاج",
  audio: "الصوت",
  gen_assistant: "مساعد التوليد",
};

export const STAGE_LABELS: Record<Stage, string> = {
  lead: "جلب الزبون",
  script: "السيناريو",
  generation: "التوليد",
  audio: "الصوت",
  editing: "المونتاج والألوان",
  review: "مراجعة الجودة",
  delivered: "التسليم والنشر",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "للإنجاز",
  in_progress: "قيد التنفيذ",
  in_review: "قيد المراجعة",
  changes_requested: "تعديلات مطلوبة",
  approved: "معتمدة",
};

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  not_contacted: "لم يُتصل به",
  contacted: "تم التواصل",
  follow_up: "متابعة",
  meeting: "اجتماع",
  won: "تم الاتفاق",
  lost: "خسارة",
};

export const LAST_POST_LABELS: Record<LastPost, string> = {
  this_week: "هذا الأسبوع",
  this_month: "هذا الشهر",
  "1_3_months": "1–3 أشهر",
  older: "أكثر من 3 أشهر",
  no_page: "الصفحة غير موجودة",
  "": "غير معروف",
};

export const RUNNING_ADS_LABELS: Record<RunningAds, string> = { yes: "نعم", no: "لا", unclear: "غير واضح" };

export const QUALITY_LABELS: Record<1 | 2 | 3, string> = { 1: "1 — ضعيفة", 2: "2 — متوسطة", 3: "3 — جيدة" };

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  message: "رسالة",
  call: "مكالمة",
  visit: "زيارة",
  meeting: "اجتماع",
  note: "ملاحظة",
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  facebook: "فيسبوك",
  instagram: "إنستغرام",
  whatsapp: "واتساب",
  phone: "هاتف",
  in_person: "حضورياً",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  awaiting_client_payment: "بانتظار دفع الزبون",
  ready: "جاهز للدفع",
  paid: "مدفوع",
};
