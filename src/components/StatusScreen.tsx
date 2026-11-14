import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";

/** Full-screen centered message used for loading / blocked / setup states. */
export function StatusScreen({
  icon: Icon,
  title,
  children,
  actions,
  tone = "default",
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="card w-full max-w-md p-6 text-center sm:p-8">
        <div className="mb-5 flex justify-center">
          {Icon ? (
            <span
              className={`grid size-14 place-items-center rounded-2xl ${
                tone === "danger" ? "bg-crimson/15 text-crimson-text" : "bg-surface-2 text-fg"
              }`}
            >
              <Icon className="size-7" aria-hidden />
            </span>
          ) : (
            <LogoMark className="size-14" />
          )}
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {children && <div className="mt-3 space-y-2 text-[0.95rem] leading-7 text-muted">{children}</div>}
        {actions && <div className="mt-6 flex flex-col gap-2.5">{actions}</div>}
      </div>
    </main>
  );
}

/** Shown inside the app shell while a lazily loaded page downloads. */
export function PageLoading() {
  return (
    <div className="grid place-items-center py-24" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-10 animate-pulse" />
        <p className="text-sm text-muted">جارٍ التحميل…</p>
      </div>
    </div>
  );
}

export function LoadingScreen({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="size-14 animate-pulse" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </main>
  );
}
