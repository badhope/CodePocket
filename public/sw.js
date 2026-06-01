const CACHE = "onlinecode-v1";
const PRECACHE = ["/", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll(PRECACHE);
      } catch (e) {
        console.warn("[SW] precache failed", e);
      }
      self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req)
        .then((res) => {
          if (res.ok && (res.type === "basic" || res.type === "default")) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        networkPromise.catch(() => {});
        return cached;
      }
      const network = await networkPromise;
      if (network) return network;
      const fallback = await cache.match("/offline");
      return fallback ?? new Response("Offline", { status: 503 });
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
