// Curio service worker — minimal app-shell caching. Served from /curio/sw.js (scope /curio/).
const CACHE_NAME = "curio-shell-v3";
const BASE = "/curio";
const PRECACHE = [`${BASE}/manifest.webmanifest`, `${BASE}/icon-192.png`, `${BASE}/icon-512.png`, `${BASE}/apple-touch-icon.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Never cache or intercept API traffic.
  if (url.pathname.startsWith(`${BASE}/api/`) || url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to cached shell if offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(`${BASE}/`, copy));
          }
          return res;
        })
        .catch(() => caches.match(`${BASE}/`).then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.pathname.startsWith(`${BASE}/_next/static/`) || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
