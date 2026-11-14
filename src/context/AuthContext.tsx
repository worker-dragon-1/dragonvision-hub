import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { loadFirestore } from "../lib/firestoreLoader";
import { DIRECTOR_EMAIL } from "../lib/env";
import { COL, type InviteDoc, type Role, type UserDoc, type WithId } from "../lib/types";
import { errorMessage } from "../lib/authErrors";

export type AuthStatus =
  | "loading" // waiting for Firebase
  | "signed-out"
  | "unverified" // email/password account whose email isn't verified yet
  | "provisioning" // first sign-in: creating the profile
  | "no-invite" // signed in + verified, but nobody invited this email
  | "deactivated"
  | "error"
  | "ready";

interface AuthValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: WithId<UserDoc> | null;
  role: Role | null;
  isDirector: boolean;
  errorText: string | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Re-checks email verification after the user clicked the link. */
  refreshVerification: () => Promise<void>;
  retryProvisioning: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = Firebase hasn't answered yet
  const [fbUser, setFbUser] = useState<User | null | undefined>(undefined);
  const [verified, setVerified] = useState(false);
  // undefined = waiting for snapshot, null = no profile doc yet
  const [profile, setProfile] = useState<WithId<UserDoc> | null | undefined>(undefined);
  const [provisionState, setProvisionState] = useState<"idle" | "running" | "no-invite" | "error">("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const claimedFor = useRef<string | null>(null);

  // 1) Track the Firebase user (and its verified flag, which changes on token refresh).
  useEffect(
    () =>
      onIdTokenChanged(auth, (u) => {
        setFbUser(u);
        setVerified(!!u?.emailVerified);
        if (!u) {
          setProfile(undefined);
          setProvisionState("idle");
          setErrorText(null);
          claimedFor.current = null;
        }
      }),
    [],
  );

  // 2) Live profile doc — only once the email is verified (rules require it anyway).
  const uid = fbUser?.uid;
  useEffect(() => {
    if (!uid || !verified) return;
    setProfile(undefined);
    let cancelled = false;
    let off: (() => void) | undefined;
    const fail = (err: unknown) => {
      setErrorText(errorMessage(err));
      setProvisionState("error");
    };
    loadFirestore()
      .then(({ fs, db }) => {
        if (cancelled) return;
        off = fs.onSnapshot(
          fs.doc(db, COL.users, uid),
          (snap) => {
            // The client creates this doc itself on first sign-in. Its optimistic local
            // snapshot appears BEFORE the server has committed it, and rules can't see
            // the user yet — so wait for the server-confirmed version, otherwise the
            // data listeners start too early and are rejected for good.
            if (snap.exists() && snap.metadata.hasPendingWrites) return;
            setProfile(snap.exists() ? { id: snap.id, ...(snap.data() as UserDoc) } : null);
          },
          fail,
        );
      })
      .catch(fail);
    return () => {
      cancelled = true;
      off?.();
    };
  }, [uid, verified]);

  // 3) First sign-in: create the profile with the INVITED role (or director).
  useEffect(() => {
    if (!fbUser || !verified || profile !== null) return;
    if (claimedFor.current === `${fbUser.uid}:${attempt}`) return;
    claimedFor.current = `${fbUser.uid}:${attempt}`;

    (async () => {
      setProvisionState("running");
      try {
        const email = (fbUser.email ?? "").toLowerCase();
        const isDirectorEmail = !!DIRECTOR_EMAIL && email === DIRECTOR_EMAIL;
        let role: Role = "director";
        const { fs, db } = await loadFirestore();
        const batch = fs.writeBatch(db);

        if (!isDirectorEmail) {
          const inviteRef = fs.doc(db, COL.invites, email);
          const invite = await fs.getDoc(inviteRef);
          const data = invite.exists() ? (invite.data() as InviteDoc) : null;
          if (!data || data.status !== "pending") {
            setProvisionState("no-invite");
            return;
          }
          role = data.role;
          batch.update(inviteRef, { status: "accepted" });
        }

        batch.set(fs.doc(db, COL.users, fbUser.uid), {
          displayName: fbUser.displayName?.trim() || email.split("@")[0],
          email,
          role,
          active: true,
          createdAt: fs.serverTimestamp(),
        });
        await batch.commit();
        setProvisionState("idle"); // the snapshot listener delivers the new profile
      } catch (err) {
        setErrorText(errorMessage(err));
        setProvisionState("error");
      }
    })();
  }, [fbUser, verified, profile, attempt]);

  const status: AuthStatus = useMemo(() => {
    if (fbUser === undefined) return "loading";
    if (fbUser === null) return "signed-out";
    if (!verified) return "unverified";
    if (provisionState === "error") return "error";
    if (profile === undefined) return "loading";
    if (profile === null) return provisionState === "no-invite" ? "no-invite" : "provisioning";
    return profile.active ? "ready" : "deactivated";
  }, [fbUser, verified, profile, provisionState]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpEmail = useCallback(async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await sendEmailVerification(cred.user);
  }, []);

  const signInGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      if ((err as { code?: string }).code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshVerification = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    await u.getIdToken(true); // new token carries email_verified = true (fires onIdTokenChanged)
    setVerified(u.emailVerified);
  }, []);

  const retryProvisioning = useCallback(() => {
    setProvisionState("idle");
    setErrorText(null);
    setAttempt((n) => n + 1);
  }, []);

  const signOut = useCallback(() => fbSignOut(auth), []);

  const value: AuthValue = {
    status,
    firebaseUser: fbUser ?? null,
    profile: profile ?? null,
    role: profile?.role ?? null,
    isDirector: profile?.role === "director" && profile.active,
    errorText,
    signInEmail,
    signUpEmail,
    signInGoogle,
    resetPassword,
    resendVerification,
    refreshVerification,
    retryProvisioning,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
