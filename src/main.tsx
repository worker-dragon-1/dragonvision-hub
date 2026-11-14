import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/cairo"; // self-hosted Cairo (Arabic + Latin) — works offline in the PWA
import "./index.css";
import App from "./App";
import { isConfigured } from "./lib/env";
import { loadFirestore } from "./lib/firestoreLoader";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// After the login page has painted, fetch the Firestore chunk in the background so it is
// usually cached by the time someone has typed their password.
if (isConfigured) {
  const warm = () => void loadFirestore().catch(() => undefined);
  if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 4000 });
  else setTimeout(warm, 2000);
}
