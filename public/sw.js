// OnlineCode Service Worker v2
// Strategy:
//   - HTML/navigation: network-first, fall back to cache only if explicitly precached offline page
//   - Static assets (_next/static, public assets): cache-first
//   - /api/*: never intercepted
//   - On activate: aggressively clear all old caches (onlinecode-v1, workbox-*, etc.) to wipe state
//     from the original static-HTML version of OnlineCode that was served at this origin.

const VERSION = "v2";
const CACHE = `onlinecode-${VERSION}`;
const OFFLINE_PATHS = ["/en/offline", "/zh-CN/offline", "/ja/offline", "/ko/offline", "/es/offline", "/fr/offline"];
const PRECACHE = ["/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        await cache.addAll([...OFFLINE_PATHS, ...PRECACHE]);
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
      await Promise.all(
        keys
          .filter((k) => k !== CACHE)
          .map((k) => {
            console.log("[SW] deleting old cache", k);
            return caches.delete(k);
          }),
      );
      // Notify all clients so they can reload fresh content
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "SW_UPDATED", version: VERSION });
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept API
  if (url.pathname.startsWith("/api/")) return;

  // Never intercept HMR / dev assets
  if (
    url.pathname.includes("@vite") ||
    url.pathname.includes("@vite-plugin-pwa") ||
    url.pathname.includes("@react-refresh") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs") ||
    url.pathname.startsWith("/dev-sw")
  ) {
    return;
  }

  // Navigation requests: network-first, fall back to localized offline page
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          return network;
        } catch {
          const cache = await caches.open(CACHE);
          const locale = url.pathname.split("/")[1] || "en";
          const offlinePath = OFFLINE_PATHS.includes(`/${locale}/offline`)
            ? `/${locale}/offline`
            : "/en/offline";
          const cached = await cache.match(offlinePath);
          if (cached) return cached;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|mp3|wav|mp4|webm)$/i.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) {
          // Refresh in background
          fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone()).catch(() => {});
            })
            .catch(() => {});
          return cached;
        }
        try {
          const network = await fetch(req);
          if (network.ok) cache.put(req, network.clone()).catch(() => {});
          return network;
        } catch {
          return new Response("Asset unavailable", { status: 504 });
        }
      })(),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHES") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        const cache = await caches.open(CACHE);
        try {
          await cache.addAll([...OFFLINE_PATHS, ...PRECACHE]);
        } catch {}
      })(),
    );
  }
});
