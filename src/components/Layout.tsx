import { Link, NavLink, Outlet } from "react-router-dom";
import { Bell, LogOut, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { DataProvider, useData } from "../context/DataContext";
import { navFor, sidebarFor, type AppRoute } from "../lib/roles";
import { ROLE_LABELS } from "../lib/labels";
import { Logo, LogoMark } from "./Logo";
import { TaskDetailHost } from "./TaskViews";
import { TemplateSeeder } from "./TemplateSeeder";

/** Small numeric badge (nav items, bell). */
function Count({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={`grid min-w-5 place-items-center rounded-full bg-crimson px-1.5 text-[0.7rem] font-bold leading-5 text-white ${className}`}
      aria-label={`${n}`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function Bell_() {
  const { notifications } = useData();
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <Link
      to="/notifications"
      aria-label={unread ? `الإشعارات، ${unread} غير مقروء` : "الإشعارات"}
      className="relative grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
    >
      <Bell className="size-5" aria-hidden />
      <Count n={unread} className="absolute -end-0.5 -top-0.5 !min-w-[1.15rem] !px-1 !text-[0.65rem] !leading-[1.15rem] ring-2 ring-surface" />
    </Link>
  );
}

function Initial({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-full bg-crimson/15 text-base font-bold text-crimson-text"
    >
      {name.trim().charAt(0).toUpperCase() || "؟"}
    </span>
  );
}

/** Desktop: fixed sidebar on the start (right) edge. */
function Sidebar({ items, badges }: { items: AppRoute[]; badges: Record<string, number> }) {
  const { profile, signOut } = useAuth();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface p-4 md:flex">
      <div className="flex items-center justify-between gap-2 pb-6 pt-2">
        <Logo className="px-2" />
        <Bell_ />
      </div>
      <nav aria-label="التنقل الرئيسي" className="flex flex-1 flex-col gap-1">
        {items.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-semibold transition-colors ${
                isActive
                  ? "bg-crimson/15 text-crimson-text"
                  : "text-muted hover:bg-surface-2 hover:text-fg"
              }`
            }
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            <Count n={badges[path] ?? 0} />
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
        <Initial name={profile?.displayName ?? ""} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{profile?.displayName}</div>
          <div className="truncate text-xs text-muted">{profile && ROLE_LABELS[profile.role]}</div>
        </div>
        <button
          onClick={signOut}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-line hover:text-fg"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** Mobile: top bar with brand + sign-out. */
function TopBar() {
  const { profile, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink/90 px-4 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
      <div className="flex items-center gap-2.5">
        <LogoMark className="size-8" />
        <div dir="ltr" className="text-base font-extrabold tracking-tight">
          Dragon<span className="text-crimson-text">Vision</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="max-w-24 truncate text-xs text-muted">{profile?.displayName}</span>
        <Bell_ />
        {profile?.role === "director" && (
          <Link to="/settings" aria-label="الإعدادات" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
            <Settings className="size-5" aria-hidden />
          </Link>
        )}
        <button
          onClick={signOut}
          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="تسجيل الخروج"
        >
          <LogOut className="size-5 rtl:-scale-x-100" aria-hidden />
        </button>
      </div>
    </header>
  );
}

/** Mobile: bottom navigation. Labels may wrap to two lines (director has 6 items). */
function BottomNav({ items, badges }: { items: AppRoute[]; badges: Record<string, number> }) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {items.map(({ path, label, icon: Icon }) => (
          <li key={path} className="min-w-0 flex-1">
            <NavLink
              to={path}
              className={({ isActive }) =>
                `relative flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-[0.68rem] font-semibold leading-tight transition-colors ${
                  isActive ? "text-crimson-text" : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-crimson" />}
                  <span className="relative">
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <Count n={badges[path] ?? 0} className="absolute -top-2 start-3 !min-w-[1.05rem] !px-1 !text-[0.6rem] !leading-[1.05rem]" />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Shell() {
  const { role } = useAuth();
  const { tasks, error, reload } = useData();
  if (!role) return null;
  const items = navFor(role);
  // director: number of tasks waiting for a decision
  const badges: Record<string, number> = { "/review": tasks.filter((t) => t.status === "in_review").length };
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar items={sidebarFor(role)} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">
          {error && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-sm leading-6 text-crimson-text">
              <span>تعذّر تحميل بعض البيانات: {error}</span>
              <button onClick={reload} className="btn-ghost min-h-9 px-3 text-sm">إعادة المحاولة</button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <BottomNav items={items} badges={badges} />
      <TaskDetailHost />
      <TemplateSeeder />
    </div>
  );
}

export function Layout() {
  return (
    <DataProvider>
      <Shell />
    </DataProvider>
  );
}
