import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { AlertCircle, Check, Copy, Loader2, Mail, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { db } from "../lib/db";
import { DIRECTOR_EMAIL } from "../lib/env";
import { useAuth } from "../context/AuthContext";
import { COL, MEMBER_ROLES, type InviteDoc, type MemberRole, type UserDoc, type WithId } from "../lib/types";
import { ROLE_LABELS } from "../lib/labels";
import { errorMessage } from "../lib/authErrors";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RoleSelect({
  value,
  onChange,
  disabled,
  id,
  label,
}: {
  value: MemberRole;
  onChange: (r: MemberRole) => void;
  disabled?: boolean;
  id?: string;
  label: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      className="input appearance-none text-start bg-[length:1.1rem] bg-[position:left_0.75rem_center] bg-no-repeat ps-3.5 pe-9"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a8a8b4' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MemberRole)}
    >
      {MEMBER_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function Avatar({ name, dim }: { name: string; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold ${
        dim ? "bg-surface-2 text-muted" : "bg-crimson/15 text-crimson-text"
      }`}
    >
      {name.trim().charAt(0).toUpperCase() || "؟"}
    </span>
  );
}

function InviteForm({ members }: { members: WithId<UserDoc>[] }) {
  const { profile } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    setDone(null);
    if (!EMAIL_RE.test(clean)) return setError("أدخل بريداً إلكترونياً صحيحاً.");
    if (clean === DIRECTOR_EMAIL) return setError("هذا بريد المخرج، وهو موجود بالفعل.");
    if (members.some((m) => m.email === clean)) return setError("هذا البريد عضو في الفريق بالفعل.");

    setBusy(true);
    setError(null);
    try {
      // The invite's document id IS the lower-cased email: Firestore rules
      // look it up by id when the invitee signs in for the first time.
      await setDoc(doc(db, COL.invites, clean), {
        email: clean,
        role,
        invitedBy: profile!.id,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setEmail("");
      setDone(`تمت دعوة ${clean}. أخبره بتسجيل الدخول بهذا البريد.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5" aria-labelledby="invite-h">
      <h2 id="invite-h" className="flex items-center gap-2 text-lg font-bold">
        <UserPlus className="size-5 text-crimson-text" aria-hidden />
        دعوة عضو جديد
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        لا يُرسَل بريد تلقائياً: بعد الدعوة أخبر العضو أن يسجّل الدخول بنفس البريد، فيُنشأ حسابه بالدور الذي تختاره.
      </p>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" noValidate>
        <div>
          <label htmlFor="inv-email" className="label">البريد الإلكتروني</label>
          <div className="relative" dir="ltr">
            <Mail className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="inv-email"
              type="email"
              inputMode="email"
              dir="ltr"
              className="input input-ltr ps-11"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div>
          <label htmlFor="inv-role" className="label">الدور</label>
          <RoleSelect id="inv-role" label="الدور" value={role} onChange={setRole} />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <UserPlus className="size-5" aria-hidden />}
          إرسال الدعوة
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-crimson-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 flex items-start gap-2 text-sm text-ok">
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          {done}
        </p>
      )}
    </section>
  );
}

function PendingInvites({ invites, onError }: { invites: WithId<InviteDoc>[]; onError: (m: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (inv: WithId<InviteDoc>) => {
    const text = `مرحباً! دعاك المخرج للانضمام إلى DragonVision Hub بدور «${ROLE_LABELS[inv.role]}».\nافتح الرابط وسجّل الدخول بنفس هذا البريد: ${inv.email}\n${location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(inv.id);
      setTimeout(() => setCopied((c) => (c === inv.id ? null : c)), 2000);
    } catch {
      onError("تعذّر النسخ. انسخ الرابط يدوياً.");
    }
  };

  const cancel = async (inv: WithId<InviteDoc>) => {
    try {
      await deleteDoc(doc(db, COL.invites, inv.id));
    } catch (err) {
      onError(errorMessage(err));
    }
  };

  return (
    <section aria-labelledby="pending-h">
      <h2 id="pending-h" className="mb-3 text-lg font-bold">
        دعوات معلّقة <span className="text-sm font-medium text-muted">({invites.length})</span>
      </h2>
      <ul className="space-y-2">
        {invites.map((inv) => (
          <li key={inv.id} className="card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-semibold"><bdi dir="ltr">{inv.email}</bdi></p>
              <p className="mt-0.5 text-xs text-muted">{ROLE_LABELS[inv.role]} · بانتظار أول تسجيل دخول</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost min-h-10 px-3 text-sm" onClick={() => copy(inv)}>
                {copied === inv.id ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === inv.id ? "تم النسخ" : "نسخ الدعوة"}
              </button>
              <button
                className="btn-ghost min-h-10 px-3 text-sm"
                onClick={() => cancel(inv)}
                aria-label={`إلغاء دعوة ${inv.email}`}
              >
                <X className="size-4" aria-hidden />
                إلغاء
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MemberCard({
  member,
  isSelf,
  onRole,
  onToggle,
  saving,
}: {
  member: WithId<UserDoc>;
  isSelf: boolean;
  onRole: (r: MemberRole) => void;
  onToggle: () => void;
  saving: boolean;
}) {
  const isOwner = member.role === "director";
  return (
    <li className={`card p-4 ${member.active ? "" : "opacity-80"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={member.displayName} dim={!member.active} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-bold">{member.displayName}</span>
              {isSelf && <span className="text-xs text-muted">(أنت)</span>}
              {isOwner ? (
                <span className="badge border-crimson/40 bg-crimson/15 text-crimson-text">{ROLE_LABELS.director}</span>
              ) : (
                <span className="badge border-line bg-surface-2 text-fg">{ROLE_LABELS[member.role]}</span>
              )}
              {!member.active && <span className="badge border-warn/40 bg-warn/10 text-warn">موقوف</span>}
            </div>
            <p className="mt-0.5 truncate text-sm text-muted"><bdi dir="ltr">{member.email}</bdi></p>
          </div>
        </div>

        {!isOwner && !isSelf && (
          <div className="flex items-center gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <RoleSelect
                label={`تغيير دور ${member.displayName}`}
                value={member.role as MemberRole}
                onChange={onRole}
                disabled={saving || !member.active}
              />
            </div>
            <button
              className={member.active ? "btn-danger shrink-0" : "btn-ghost shrink-0"}
              disabled={saving}
              onClick={onToggle}
            >
              {saving ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : member.active ? (
                <UserX className="size-5" aria-hidden />
              ) : (
                <UserCheck className="size-5" aria-hidden />
              )}
              {member.active ? "إيقاف" : "تفعيل"}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function TeamPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<WithId<UserDoc>[] | null>(null);
  const [invites, setInvites] = useState<WithId<InviteDoc>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<WithId<UserDoc> | null>(null);

  useEffect(() => {
    const offUsers = onSnapshot(
      collection(db, COL.users),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserDoc) }))),
      (err) => setError(errorMessage(err)),
    );
    const offInvites = onSnapshot(
      query(collection(db, COL.invites), where("status", "==", "pending")),
      (snap) => setInvites(snap.docs.map((d) => ({ id: d.id, ...(d.data() as InviteDoc) }))),
      (err) => setError(errorMessage(err)),
    );
    return () => {
      offUsers();
      offInvites();
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...(members ?? [])].sort((a, b) => {
        if ((a.role === "director") !== (b.role === "director")) return a.role === "director" ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
        return (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0);
      }),
    [members],
  );

  const update = async (m: WithId<UserDoc>, patch: Partial<Pick<UserDoc, "role" | "active">>) => {
    setSavingId(m.id);
    setError(null);
    try {
      await updateDoc(doc(db, COL.users, m.id), patch);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingId(null);
      setConfirm(null);
    }
  };

  const activeCount = sorted.filter((m) => m.active).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="الفريق"
        subtitle={members ? `${activeCount} عضو نشط${invites.length ? ` · ${invites.length} دعوة معلّقة` : ""}` : undefined}
      />

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 p-3 text-sm text-crimson-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="space-y-8">
        <InviteForm members={sorted} />

        {invites.length > 0 && <PendingInvites invites={invites} onError={setError} />}

        <section aria-labelledby="members-h">
          <h2 id="members-h" className="mb-3 text-lg font-bold">
            الأعضاء {members && <span className="text-sm font-medium text-muted">({sorted.length})</span>}
          </h2>
          {members === null ? (
            <div className="card grid place-items-center py-12" role="status" aria-label="جارٍ التحميل">
              <Loader2 className="size-6 animate-spin text-muted" aria-hidden />
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sorted.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  isSelf={m.id === profile?.id}
                  saving={savingId === m.id}
                  onRole={(role) => update(m, { role })}
                  onToggle={() => (m.active ? setConfirm(m) : update(m, { active: true }))}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {confirm && (
        <ConfirmDialog
          title="إيقاف العضو؟"
          message={`سيفقد ${confirm.displayName} الوصول إلى التطبيق فوراً. يمكنك إعادة تفعيله لاحقاً.`}
          confirmLabel="نعم، أوقفه"
          busy={savingId === confirm.id}
          onConfirm={() => update(confirm, { active: false })}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
