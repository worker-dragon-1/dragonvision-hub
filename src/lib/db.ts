import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { app } from "./firebase";
import { USE_EMULATORS } from "./env";

// Offline cache: the team often works on patchy mobile connections.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATORS) connectFirestoreEmulator(db, location.hostname, 8080);
