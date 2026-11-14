/** Maps Firebase Auth / Firestore error codes to Arabic messages. */
export function errorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "البريد الإلكتروني أو كلمة السر غير صحيحة.";
    case "auth/invalid-email":
      return "صيغة البريد الإلكتروني غير صحيحة.";
    case "auth/email-already-in-use":
      return "يوجد حساب بهذا البريد بالفعل. جرّب تسجيل الدخول.";
    case "auth/weak-password":
      return "كلمة السر ضعيفة. استعمل 6 أحرف على الأقل.";
    case "auth/too-many-requests":
      return "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
    case "auth/network-request-failed":
    case "unavailable":
      return "تعذّر الاتصال بالشبكة. تحقق من الإنترنت وأعد المحاولة.";
    case "auth/popup-blocked":
      return "المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة وأعد المحاولة.";
    case "auth/unauthorized-domain":
      return "هذا النطاق غير مصرّح به في إعدادات Firebase Authentication.";
    case "auth/operation-not-allowed":
      return "طريقة تسجيل الدخول هذه غير مفعّلة في Firebase Console.";
    case "permission-denied":
      return "ليست لديك صلاحية لهذه العملية.";
    default:
      return "حدث خطأ غير متوقع. أعد المحاولة.";
  }
}

/** Errors that are the user's own doing and should not show a message. */
export const isSilentAuthError = (err: unknown) => {
  const code = (err as { code?: string })?.code;
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request";
};
