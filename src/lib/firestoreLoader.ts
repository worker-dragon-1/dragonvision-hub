// The Firestore SDK is the biggest dependency. It is NOT needed to show the login page,
// so it is loaded on demand: right after sign-in, or in the background shortly after
// the first paint (see main.tsx) so returning users rarely wait for it.
export const loadFirestore = () =>
  Promise.all([import("firebase/firestore"), import("./db")]).then(([fs, { db }]) => ({ fs, db }));
