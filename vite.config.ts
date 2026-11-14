import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": a new build waits until the user taps «تحديث» in the banner (see UpdateBanner)
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "DragonVision Hub",
        short_name: "DragonVision",
        description: "منصة إدارة فريق DragonVision لإنتاج الفيديو بالذكاء الاصطناعي",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0B0B0E",
        theme_color: "#0B0B0E",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Prompt mode: the new worker waits until the user taps «تحديث» (SKIP_WAITING message).
        // It must then CLAIM the open page, otherwise no "controllerchange" fires and the page
        // would never reload onto the new build.
        clientsClaim: true,
        // SPA fallback; Firebase/Google API traffic is never cached by the SW.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/__\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Stable vendor chunks: they change rarely, so returning users keep them cached across deploys.
        codeSplitting: {
          groups: [
            { name: "vendor-react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: "vendor-firestore", test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)[\\/]/ },
            { name: "vendor-auth", test: /node_modules[\\/](@firebase[\\/]auth|firebase[\\/]auth)[\\/]/ },
            { name: "vendor-firebase", test: /node_modules[\\/](@firebase|firebase|idb)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { host: true },
});
