import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, Mail, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { errorMessage, isSilentAuthError } from "../lib/authErrors";
import { Logo } from "../components/Logo";

type Mode = "signin" | "signup" | "reset";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const TITLES: Record<Mode, string> = {
  signin: "تسجيل الدخول",
  signup: "إنشاء حساب",
  reset: "استعادة كلمة السر",
};

export function Login() {
  const { signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (err) {
      if (!isSilentAuthError(err)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "signin") await signInEmail(email, password);
      else if (mode === "signup") await signUpEmail(name, email, password);
      else {
        await resetPassword(email);
        setInfo("إن كان البريد مسجّلاً فقد أرسلنا إليه رابط استعادة كلمة السر.");
      }
    });
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* soft crimson glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60rem 28rem at 50% -4rem, rgba(200,16,46,0.22), transparent 70%)" }}
      />

      <div className="relative w-full max-w-md">
        <Logo className="mb-8 justify-center" />

        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold">{TITLES[mode]}</h1>
          <p className="mb-6 mt-1 text-sm leading-6 text-muted">
            {mode === "signup"
              ? "للأعضاء المدعوّين فقط. استعمل نفس البريد الذي دعاك به المخرج."
              : mode === "reset"
                ? "أدخل بريدك وسنرسل إليك رابطاً لتعيين كلمة سر جديدة."
                : "مرحباً بعودتك. سجّل الدخول لمتابعة العمل."}
          </p>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <div>
                <label htmlFor="name" className="label">الاسم</label>
                <div className="relative">
                  <User className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    id="name"
                    className="input ps-11"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">البريد الإلكتروني</label>
              <div className="relative" dir="ltr">
                <Mail className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  className="input input-ltr ps-11"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div>
                <label htmlFor="password" className="label">كلمة السر</label>
                <div className="relative" dir="ltr">
                  <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    id="password"
                    type="password"
                    dir="ltr"
                    className="input input-ltr ps-11"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-sm text-crimson-text">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
            {info && (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                {info}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
              {mode === "signin" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال الرابط"}
            </button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                أو
                <span className="h-px flex-1 bg-line" />
              </div>
              <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => run(signInGoogle)}>
                <GoogleIcon />
                المتابعة بحساب Google
              </button>
            </>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
            {mode === "signin" ? (
              <>
                <button type="button" className="py-2 font-semibold text-crimson-text hover:underline" onClick={() => switchMode("signup")}>
                  أول مرة؟ أنشئ حسابك
                </button>
                <button type="button" className="py-2 text-muted hover:text-fg" onClick={() => switchMode("reset")}>
                  نسيت كلمة السر؟
                </button>
              </>
            ) : (
              <button type="button" className="py-2 font-semibold text-crimson-text hover:underline" onClick={() => switchMode("signin")}>
                العودة إلى تسجيل الدخول
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-6 text-muted">
          التسجيل مفتوح للأعضاء الذين دعاهم المخرج فقط.
        </p>
      </div>
    </main>
  );
}
