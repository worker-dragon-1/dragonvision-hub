import { useEffect, useRef } from "react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 p-4 sm:place-items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        className="card w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">{title}</h2>
        <p id="confirm-msg" className="mt-2 text-sm leading-7 text-muted">{message}</p>
        <div className="mt-6 flex gap-3">
          <button className="btn-primary flex-1" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
          <button ref={cancelRef} className="btn-ghost flex-1" disabled={busy} onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
