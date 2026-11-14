import {
  Banknote,
  Bell,
  Clapperboard,
  ClipboardCheck,
  MessageSquareText,
  Settings,
  LayoutDashboard,
  ListChecks,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export interface AppRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Roles allowed to open this page (UI guard — Firestore rules are the real one). */
  roles: readonly Role[];
  /** Placeholder copy for pages that arrive in later prompts. */
  description: string;
}

const CREW: readonly Role[] = ["editor", "audio", "gen_assistant"];

export const ROUTES = {
  dashboard: {
    path: "/dashboard",
    label: "لوحة المخرج",
    icon: LayoutDashboard,
    roles: ["director"],
    description: "نظرة شاملة على المشاريع والمهام والمداخيل.",
  },
  projects: {
    path: "/projects",
    label: "المشاريع",
    icon: Clapperboard,
    roles: ["director", "sales", ...CREW],
    description: "كل المشاريع ومراحلها السبع من جلب الزبون إلى التسليم.",
  },
  tasks: {
    path: "/tasks",
    label: "المهام",
    icon: ListChecks,
    roles: ["director"],
    description: "مهام كل الفريق، والمراجعة والاعتماد.",
  },
  review: {
    path: "/review",
    label: "للمراجعة",
    icon: ClipboardCheck,
    roles: ["director"],
    description: "المهام المُسلَّمة بانتظار الاعتماد.",
  },
  myTasks: {
    path: "/my-tasks",
    label: "مهامي",
    icon: ListChecks,
    roles: ["sales", ...CREW],
    description: "المهام المسندة إليك وروابط التسليم.",
  },
  prospects: {
    path: "/prospects",
    label: "الزبائن المحتملون",
    icon: Target,
    roles: ["director", "sales"],
    description: "قائمة الزبائن المحتملين ومتابعة التواصل معهم.",
  },
  payouts: {
    path: "/payouts",
    label: "المستحقات",
    icon: Banknote,
    roles: ["director"],
    description: "مستحقات كل أعضاء الفريق وحالة الدفع.",
  },
  myPayouts: {
    path: "/my-payouts",
    label: "مستحقاتي",
    icon: Banknote,
    roles: ["sales", ...CREW],
    description: "مستحقاتك الخاصة فقط وحالة كل دفعة.",
  },
  notifications: {
    path: "/notifications",
    label: "الإشعارات",
    icon: Bell,
    roles: ["director", "sales", ...CREW],
    description: "",
  },
  settings: {
    path: "/settings",
    label: "الإعدادات",
    icon: Settings,
    roles: ["director"],
    description: "",
  },
  templates: {
    path: "/templates",
    label: "قوالب الرسائل",
    icon: MessageSquareText,
    roles: ["director", "sales"],
    description: "",
  },
  team: {
    path: "/team",
    label: "الفريق",
    icon: Users,
    roles: ["director"],
    description: "",
  },
} as const satisfies Record<string, AppRoute>;

export type RouteKey = keyof typeof ROUTES;

/** Navigation order per role — exactly as specified. */
const NAV_KEYS: Record<Role, RouteKey[]> = {
  director: ["dashboard", "projects", "tasks", "review", "prospects", "payouts", "team"],
  sales: ["myTasks", "projects", "prospects", "myPayouts"],
  editor: ["myTasks", "projects", "myPayouts"],
  audio: ["myTasks", "projects", "myPayouts"],
  gen_assistant: ["myTasks", "projects", "myPayouts"],
};

/** Extra links shown in the desktop sidebar only (the mobile bottom bar is already full). */
export const SIDEBAR_EXTRA: Partial<Record<Role, RouteKey[]>> = { director: ["settings"] };
export const sidebarFor = (role: Role): AppRoute[] => [...navFor(role), ...(SIDEBAR_EXTRA[role] ?? []).map((k) => ROUTES[k])];

export const navFor = (role: Role): AppRoute[] => NAV_KEYS[role].map((k) => ROUTES[k]);

/** Where a role lands after login. */
export const homeFor = (role: Role): string => navFor(role)[0].path;
