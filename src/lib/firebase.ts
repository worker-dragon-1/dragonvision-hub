import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { USE_EMULATORS, firebaseConfig } from "./env";

// Placeholders keep module evaluation from throwing when .env is still empty;
// the app shows a setup screen instead of ever using these (see App.tsx).
const app = initializeApp({
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey || "missing-api-key",
  projectId: firebaseConfig.projectId || "missing-project",
  appId: firebaseConfig.appId || "missing-app-id",
});

export const auth = getAuth(app);

// Offline cache: the team often works on patchy mobile connections.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATORS) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
