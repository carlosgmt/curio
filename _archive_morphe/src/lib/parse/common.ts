import * as chrono from "chrono-node";

export const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => capitalize(w))
    .join(" ");

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Strip dangling connector words left behind after removing a phrase. */
export function tidy(s: string) {
  let out = collapse(s.replace(/[,;]+\s*$/g, "").replace(/^\s*[,;:-]+/g, ""));
  const dangling = /\s+(on|at|by|for|with|to|in|and|the|this|next|from|every|el|la|los|las|de|del|en|para|por|con|a)$/i;
  const leading = /^(on|at|by|for|and|the|to|el|la|los|las|de|del|en|para|por|con|a)\s+/i;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(dangling, "").replace(leading, "");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

export type Currency = "₹" | "$" | "€" | "£";
export const DEFAULT_CURRENCY: Currency = "₹";

export function detectCurrency(text: string): Currency {
  if (/\$|\busd\b|dollars?\b/i.test(text)) return "$";
  if (/€|\beur(os?)?\b/i.test(text)) return "€";
  if (/£|\bgbp\b|pounds? sterling/i.test(text)) return "£";
  return DEFAULT_CURRENCY;
}

export const AMOUNT_RE = /(?:₹|rs\.?|inr|\$|€|£)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k\b)?/i;

export function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** Find the first money-like amount in the text. */
export function findAmount(text: string): { value: number; index: number; length: number } | null {
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = toNumber(m[1]);
    if (!Number.isFinite(n)) continue;
    return { value: m[2] ? n * 1000 : n, index: m.index, length: m[0].length };
  }
  return null;
}

export type DateHit = {
  start: Date;
  end: Date | null;
  hasTime: boolean;
  text: string;
  index: number;
};

export function findDate(text: string, ref: Date = new Date()): DateHit | null {
  const enResults = chrono.parse(text, ref, { forwardDate: true });
  const esResults = chrono.es ? chrono.es.parse(text, ref, { forwardDate: true }) : [];
  const allResults = [...enResults, ...esResults].filter(
    (r) => !/^\d+$/.test(r.text.trim()) && r.text.trim().length >= 3
  );

  if (!allResults.length) return null;

  // Prioritize longest date match (e.g. "mañana a las 21:00" over "21:00" or accidental substring "Mar")
  allResults.sort((a, b) => b.text.length - a.text.length);
  const r = allResults[0];

  return {
    start: r.start.date(),
    end: r.end ? r.end.date() : null,
    hasTime: r.start.isCertain("hour"),
    text: r.text,
    index: r.index,
  };
}

export function removeRange(text: string, index: number, length: number) {
  return text.slice(0, index) + " " + text.slice(index + length);
}

export function formatAmount(n: number, currency: Currency = DEFAULT_CURRENCY) {
  const locale = currency === "₹" ? "en-IN" : "en-US";
  const rounded = Math.round(n * 100) / 100;
  return (
    currency +
    rounded.toLocaleString(locale, {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}
