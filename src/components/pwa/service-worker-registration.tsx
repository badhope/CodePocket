"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        // Aggressively unregister any old service workers from the original
        // static-HTML version of OnlineCode, which served "Loading DATA..." pages
        // that conflict with this Next.js app.
        const existing = await navigator.serviceWorker.getRegistrations();
        for (const reg of existing) {
          const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
          // Unregister non-onlinecode-v2 SWs
          if (!url.endsWith("/sw.js")) {
            console.log("[PWA] unregistering legacy SW:", url);
            await reg.unregister();
          }
        }

        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        reg.addEventListener("updatefound", () => {
          console.log("[PWA] update found, installing new SW");
        });

        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data?.type === "SW_UPDATED") {
            console.log("[PWA] SW updated to", event.data.version);
          }
        });
      } catch (e) {
        console.warn("[PWA] SW registration failed", e);
      }
    };

    void register();
  }, []);

  return null;
}
