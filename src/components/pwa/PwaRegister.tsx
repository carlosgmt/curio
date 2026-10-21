"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __curioInstallPrompt?: any;
  }
}

/** Registers the service worker and captures the `beforeinstallprompt` event. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__curioInstallPrompt = e;
      window.dispatchEvent(new Event("curio:install-available"));
    };
    const onInstalled = () => {
      window.__curioInstallPrompt = undefined;
      window.dispatchEvent(new Event("curio:install-available"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
      const isLocalDev = process.env.NODE_ENV !== "production";
      if (!isLocalDev) {
        navigator.serviceWorker.register("/curio/sw.js", { scope: "/curio/" }).catch(() => {});
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
