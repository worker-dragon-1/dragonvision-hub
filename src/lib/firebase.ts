import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { USE_EMULATORS, firebaseConfig } from "./env";

// Placeholders keep module evaluation from throwing when .env is still empty;
// the app shows a setup screen instead of ever using these (see App.tsx).
export const app = initializeApp({
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey || "missing-api-key",
  projectId: firebaseConfig.projectId || "missing-project",
  appId: firebaseConfig.appId || "missing-app-id",
});

export const auth = getAuth(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
}

// Firestore lives in ./db so the login page does not have to download it:
// see loadFirestore() in ./firestoreLoader.
