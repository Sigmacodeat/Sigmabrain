// Sigmabrain service worker.
// Deliberately minimal: precache the offline fallback + icons, serve the
// fallback when a navigation fails. No aggressive caching — the app is
// data-live (auth, queries); stale caches would be worse than none.

const CACHE = "sigmabrain-v1";
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only intercept page navigations; never API calls or assets.
  if (req.mode !== "navigate") return;
  event.respondWith(
    fetch(req).catch(() =>
      caches.match("/offline.html").then((res) => res ?? Response.error()),
    ),
  );
});
