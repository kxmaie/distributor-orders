import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// /api is proxied to the Fastify server => same origin, so the httpOnly refresh cookie just works.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new version waits until the user taps "تحديث" (never reloads mid-checkout).
      registerType: "prompt",
      includeAssets: ["favicon.svg", "favicon-48.png", "apple-touch-icon.png", "logo-light.png", "logo-dark.png"],
      manifest: {
        id: "/",
        name: "Turk-pen — UPVC Accessories",
        short_name: "Turk-pen",
        description: "بوابة طلبات الموزعين: تصفّح المنتجات، اطلب، وتابع حالة طلبك لحظة بلحظة. / Turk-pen B2B distributor ordering portal.",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0B1220",
        theme_color: "#0B1220",
        categories: ["business", "productivity", "shopping"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "المنتجات · Catalog", short_name: "المنتجات", url: "/catalog", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "طلباتي · My orders", short_name: "طلباتي", url: "/orders", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // SPA: any navigation falls back to the cached shell — except API calls (incl. the SSE stream).
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // NOTE: /api/* is deliberately NOT cached: it is authenticated, per-user data and must never
        // outlive the session in a shared cache. Offline, the app shell opens and the offline banner shows.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request, url }) => request.destination === "image" && !url.pathname.startsWith("/api/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  // Build the web app straight from the shared TypeScript source (the compiled CJS index.js
  // has no named exports visible to Rollup).
  resolve: {
    alias: {
      "@do/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache well across deploys (and keep the entry chunk small).
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          query: ["@tanstack/react-query", "zustand"],
        },
      },
    },
  },
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
});