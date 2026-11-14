import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Loader2, RefreshCw } from "lucide-react";

const HOUR = 60 * 60 * 1000;

/**
 * PWA "prompt" mode: a freshly deployed build waits in the background until the user taps
 * «تحديث» — then it takes over and the page reloads. We also look for a new version
 * whenever the app regains focus, so a returning user is never left on a stale cached build.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let last = 0;
      const check = () => {
        if (!navigator.onLine || Date.now() - last < 15_000) return; // don't hammer the server
        last = Date.now();
        registration.update().catch(() => undefined);
      };
      window.addEventListener("focus", check);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      setInterval(check, HOUR);
    },
  });

  const [updating, setUpdating] = useState(false);

  /**
   * Tell the waiting worker to take over, then reload ONCE it controls the page.
   * (We reload ourselves on "controllerchange": relying on the library's own reload left
   * the page on the old build in testing.) A short timeout is a safety net.
   */
  const apply = async () => {
    setUpdating(true);
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reload, { once: true });
    setTimeout(reload, 5000);
    await updateServiceWorker(false);
  };

  if (!needRefresh) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-banner"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[70] md:inset-x-auto md:bottom-5 md:end-5 md:w-96"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-crimson/50 bg-surface p-3.5 ps-4 shadow-2xl shadow-black/60">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-crimson/15 text-crimson-text">
          <RefreshCw className="size-5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm font-bold">نسخة جديدة متاحة</p>
        <button className="btn-primary min-h-10 px-4 text-sm" disabled={updating} onClick={apply}>
          {updating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {updating ? "جارٍ التحديث" : "تحديث"}
        </button>
      </div>
    </div>
  );
}
