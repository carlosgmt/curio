"use client";

import { useCallback, useEffect, useState } from "react";

export interface InstallState {
  /** Native install prompt is available (Chromium/Android/desktop). */
  canInstall: boolean;
  /** iOS Safari where install is a manual "Add to Home Screen". */
  showIosHint: boolean;
  /** Already running as an installed app. */
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
}

export function useInstallPrompt(): InstallState {
  const [canInstall, setCanInstall] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(Boolean(standalone));

    const ua = navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setShowIosHint(isIos && !standalone);

    const sync = () => setCanInstall(Boolean(window.__curioInstallPrompt));
    sync();
    window.addEventListener("curio:install-available", sync);
    return () => window.removeEventListener("curio:install-available", sync);
  }, []);

  const promptInstall = useCallback(async () => {
    const evt = window.__curioInstallPrompt;
    if (!evt) return;
    evt.prompt();
    try {
      await evt.userChoice;
    } finally {
      window.__curioInstallPrompt = undefined;
      setCanInstall(false);
    }
  }, []);

  return { canInstall, showIosHint, isStandalone, promptInstall };
}
