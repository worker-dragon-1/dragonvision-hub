import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/cairo"; // self-hosted Cairo (Arabic + Latin) — works offline in the PWA
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
