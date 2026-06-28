/*
 * Service worker template. The build id and precache list below are filled in at
 * build time by the pwaServiceWorker() plugin in vite.config.ts, so the script
 * bytes change on every deploy — that's what lets the browser detect an update.
 */
/* eslint-disable */
const BUILD_ID = "__BUILD_ID__";
const PRECACHE = __PRECACHE__;
const CACHE = "seating-" + BUILD_ID;

// Install: warm the cache with the app shell. allSettled so one miss (e.g. "./"
// on a host that doesn't serve a directory index) doesn't abort the whole install.
// skipWaiting() so a freshly deployed worker activates immediately instead of waiting
// for every tab to close — the page reloads onto it (see src/pwa.ts), so users never
// get stuck on a stale cached build.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u)))),
  );
});

// Activate: drop caches from previous builds and take control.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("seating-") && k !== CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page asks the waiting worker to take over immediately (manual "Update").
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first (fresh HTML when online), fall back to the
  // cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        async () =>
          (await caches.match("./index.html")) || (await caches.match("./")) || Response.error(),
      ),
    );
    return;
  }

  // Other same-origin GETs (hashed JS/CSS, icons, fonts): cache-first, then fill
  // the runtime cache. Hashed names make cache-first safe across versions.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});
