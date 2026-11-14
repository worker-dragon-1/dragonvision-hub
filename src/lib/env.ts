// Single place where environment variables are read.
const e = import.meta.env;

export const firebaseConfig = {
  apiKey: e.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: e.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: e.VITE_FIREBASE_APP_ID as string | undefined,
};

/** Lower-cased director email. UI hint only — the real gate is firestore.rules. */
export const DIRECTOR_EMAIL = ((e.VITE_DIRECTOR_EMAIL as string | undefined) ?? "").trim().toLowerCase();

export const USE_EMULATORS = e.VITE_USE_EMULATORS === "true";

const REQUIRED = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
  VITE_DIRECTOR_EMAIL: DIRECTOR_EMAIL,
} as const;

/** Names of required variables that are still empty. */
export const missingEnv: string[] = Object.entries(REQUIRED)
  .filter(([, v]) => !v)
  .map(([k]) => k);

export const isConfigured = missingEnv.length === 0;
