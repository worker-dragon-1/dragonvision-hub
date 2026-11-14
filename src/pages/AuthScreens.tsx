import { useState } from "react";
import { AlertTriangle, Ban, Loader2, MailCheck, SearchX, Settings2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LoadingScreen, StatusScreen } from "../components/StatusScreen";
import { errorMessage } from "../lib/authErrors";
import { missingEnv } from "../lib/env";

const SignOutButton = () => {
  const { signOut } = useAuth();
  return (
    <button className="btn-ghost" onClick={signOut}>
      تسجيل الخروج
    </button>
  );
};

export function VerifyEmailScreen() {
  const { firebaseUser, resendVerification, refreshVerification } = useAuth();
  const [busy, setBusy] = useState<"check" | "send" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const act = async (kind: "check" | "send") => {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "send") {
        await resendVerification();
        setMsg("أعدنا إرسال رسالة التأكيد.");
      } else {
        await refreshVerification();
        // still unverified → this screen stays; tell the user
        setMsg("لم يتم التأكيد بعد. افتح الرابط في رسالة البريد ثم اضغط هنا مجدداً.");
      }
    } catch (err) {
      setMsg(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <StatusScreen
      icon={MailCheck}
      title="أكّد بريدك الإلكتروني"
      actions={
        <>
          <button className="btn-primary" disabled={!!busy} onClick={() => act("check")}>
            {busy === "check" && <Loader2 className="size-5 animate-spin" aria-hidden />}
            لقد أكّدت بريدي
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => act("send")}>
            إعادة إرسال الرسالة
          </button>
          <SignOutButton />
        </>
      }
    >
      <p>
        أرسلنا رسالة تأكيد إلى <bdi dir="ltr" className="font-semibold text-fg">{firebaseUser?.email}</bdi>.
        افتح الرابط فيها ثم عُد إلى هنا.
      </p>
      {msg && <p role="status" className="text-sm text-fg">{msg}</p>}
    </StatusScreen>
  );
}

export function ProvisioningScreen() {
  return <LoadingScreen label="جارٍ إعداد حسابك…" />;
}

export function NoInviteScreen() {
  const { firebaseUser, retryProvisioning } = useAuth();
  return (
    <StatusScreen
      icon={SearchX}
      title="لا توجد دعوة لهذا البريد"
      actions={
        <>
          <button className="btn-primary" onClick={retryProvisioning}>
            تحقّق مجدداً
          </button>
          <SignOutButton />
        </>
      }
    >
      <p>
        الدخول للأعضاء المدعوّين فقط. اطلب من المخرج أن يدعو{" "}
        <bdi dir="ltr" className="font-semibold text-fg">{firebaseUser?.email}</bdi> من صفحة «الفريق»، ثم اضغط «تحقّق مجدداً».
      </p>
    </StatusScreen>
  );
}

export function DeactivatedScreen() {
  return (
    <StatusScreen icon={Ban} tone="danger" title="تم إيقاف حسابك" actions={<SignOutButton />}>
      <p>لم يعد بإمكانك الوصول إلى التطبيق. تواصل مع المخرج إن كان هذا خطأً.</p>
    </StatusScreen>
  );
}

export function ErrorScreen() {
  const { errorText, retryProvisioning } = useAuth();
  return (
    <StatusScreen
      icon={AlertTriangle}
      tone="danger"
      title="تعذّر إعداد حسابك"
      actions={
        <>
          <button className="btn-primary" onClick={retryProvisioning}>
            إعادة المحاولة
          </button>
          <SignOutButton />
        </>
      }
    >
      <p>{errorText ?? "حدث خطأ غير متوقع."}</p>
    </StatusScreen>
  );
}

/** Shown when .env is not filled in yet. */
export function SetupScreen() {
  return (
    <StatusScreen icon={Settings2} title="التطبيق غير مُهيّأ بعد">
      <p>أكمل ملف <bdi dir="ltr" className="font-semibold text-fg">.env</bdi> بالقيم التالية ثم أعد تشغيل التطبيق:</p>
      <ul dir="ltr" className="space-y-1 rounded-xl bg-surface-2 p-3 text-start font-mono text-sm text-fg">
        {missingEnv.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
    </StatusScreen>
  );
}
