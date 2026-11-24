import type { PressPalette } from "./archetypes";

type Rgb = [number, number, number];

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
}

export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

export function rgbToHex(rgb: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2])]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHsl(rgb: Rgb): [number, number, number] {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function ensureMinContrast(candidate: Rgb, background: Rgb, minRatio: number): Rgb {
  let [h, s, l] = rgbToHsl(candidate);
  const bgLum = relativeLuminance(background);
  const lighten = bgLum < 0.35;
  let cur = candidate;
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(cur, background) >= minRatio) return cur;
    l = lighten ? Math.min(0.96, l + 0.04) : Math.max(0.06, l - 0.04);
    s = lighten ? Math.max(0.18, s * 0.98) : s;
    cur = hslToRgb(h, s, l);
  }
  return lighten ? [244, 240, 232] : [22, 20, 18];
}

export function clampPaletteForReadability(rawRgb: Rgb, fallback: PressPalette, accentHint?: Rgb): PressPalette {
  const [h, s] = rgbToHsl(rawRgb);
  // Deep archival tint from the cover hue for rich Stripe Press Press Stage backdrop
  const clampedSat = Math.max(0.08, Math.min(0.42, s));
  const surfaceRgb = hslToRgb(h, clampedSat, 0.14);
  const surfaceSecRgb = hslToRgb(h, clampedSat, 0.1);
  const coverBgRgb = hslToRgb(h, Math.min(0.5, clampedSat + 0.08), 0.24);
  const ruleRgb = hslToRgb(h, Math.min(0.36, clampedSat), 0.28);

  const inkRgb = ensureMinContrast([244, 240, 230], surfaceRgb, 7.0);
  const mutedRgb = ensureMinContrast(hslToRgb(h, Math.min(0.25, clampedSat), 0.72), surfaceRgb, 4.6);
  const rawAccent = accentHint || hslToRgb((h + 0.04) % 1, Math.max(0.45, Math.min(0.78, s + 0.25)), 0.7);
  const accentRgb = ensureMinContrast(rawAccent, surfaceRgb, 4.5);
  const coverInkRgb = ensureMinContrast(accentRgb, coverBgRgb, 4.5);

  return {
    id: `${fallback.id}-extracted`,
    surface: rgbToHex(surfaceRgb),
    surfaceSecondary: rgbToHex(surfaceSecRgb),
    ink: rgbToHex(inkRgb),
    muted: rgbToHex(mutedRgb),
    accent: rgbToHex(accentRgb),
    rule: rgbToHex(ruleRgb),
    coverBg: rgbToHex(coverBgRgb),
    coverInk: rgbToHex(coverInkRgb),
  };
}

const paletteCache = new Map<string, PressPalette>();

function extractDominantFromPixels(pixels: Uint8ClampedArray): { dominant: Rgb; accent?: Rgb } | null {
  let bestScore = -1;
  let dominant: Rgb | null = null;
  let bestAccentScore = -1;
  let accent: Rgb | undefined;

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 180) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Skip pure background whites / pure black borders
    if ((max > 240 && min > 235) || (max < 15 && min < 15)) continue;
    const kr = Math.floor(r / 24);
    const kg = Math.floor(g / 24);
    const kb = Math.floor(b / 24);
    const key = `${kr},${kg},${kb}`;
    const entry = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.count += 1;
    buckets.set(key, entry);
  }

  for (const entry of buckets.values()) {
    const avg: Rgb = [entry.r / entry.count, entry.g / entry.count, entry.b / entry.count];
    const [, sat, lum] = rgbToHsl(avg);
    const domScore = entry.count * (0.4 + sat * 1.4);
    if (domScore > bestScore) {
      bestScore = domScore;
      dominant = avg;
    }
    const accentScore = Math.sqrt(entry.count) * sat * (lum > 0.25 && lum < 0.85 ? 1.5 : 0.6);
    if (accentScore > bestAccentScore) {
      bestAccentScore = accentScore;
      accent = avg;
    }
  }

  if (!dominant) return null;
  return { dominant, accent };
}

export async function extractPaletteFromImageUrl(
  sameOriginUrl: string | null,
  fallback: PressPalette
): Promise<PressPalette> {
  if (!sameOriginUrl || typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
  const cached = paletteCache.get(sameOriginUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    const done = (pal: PressPalette) => {
      if (settled) return;
      settled = true;
      if (paletteCache.size > 300) {
        const firstKey = paletteCache.keys().next().value;
        if (firstKey) paletteCache.delete(firstKey);
      }
      paletteCache.set(sameOriginUrl, pal);
      resolve(pal);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return done(fallback);
        ctx.drawImage(img, 0, 0, 24, 24);
        const data = ctx.getImageData(0, 0, 24, 24).data;
        const sampled = extractDominantFromPixels(data);
        if (!sampled) return done(fallback);
        done(clampPaletteForReadability(sampled.dominant, fallback, sampled.accent));
      } catch {
        done(fallback);
      }
    };
    img.onerror = () => done(fallback);
    img.src = sameOriginUrl;
  });
}
