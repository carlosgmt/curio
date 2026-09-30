"use client";

import { useState, useEffect } from "react";

export type ColorMode = "light" | "dark" | "system";
export type ColorPalette = "indigo" | "emerald" | "amber" | "violet" | "rose" | "slate" | "dynamic";

const THEME_KEY = "brainspace:theme";
const PALETTE_KEY = "brainspace:palette";

export function applyTheme(mode: ColorMode, palette: ColorPalette) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;

  // 1. Mode
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Palette
  root.setAttribute("data-palette", palette);

  // 3. Android / Pixel Status Bar Dynamic Theming (meta theme-color)
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.setAttribute("name", "theme-color");
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", isDark ? "#09090b" : "#ffffff");
}

export function useTheme() {
  const [mode, setMode] = useState<ColorMode>("system");
  const [palette, setPalette] = useState<ColorPalette>("indigo");

  useEffect(() => {
    try {
      const savedMode = (localStorage.getItem(THEME_KEY) as ColorMode) || "system";
      const savedPalette = (localStorage.getItem(PALETTE_KEY) as ColorPalette) || "indigo";
      setMode(savedMode);
      setPalette(savedPalette);
      applyTheme(savedMode, savedPalette);
    } catch {}
  }, []);

  const updateMode = (m: ColorMode) => {
    setMode(m);
    try { localStorage.setItem(THEME_KEY, m); } catch {}
    applyTheme(m, palette);
  };

  const updatePalette = (p: ColorPalette) => {
    setPalette(p);
    try { localStorage.setItem(PALETTE_KEY, p); } catch {}
    applyTheme(mode, p);
  };

  return { mode, palette, setMode: updateMode, setPalette: updatePalette };
}