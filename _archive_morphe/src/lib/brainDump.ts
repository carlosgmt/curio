/**
 * Brain dump detection and splitting.
 */

const BULLET_PREFIX_RE = /^(?:[-*•]|\d+[\.)]|\[[ xX]?\])\s+/;

export function splitBrainDump(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(BULLET_PREFIX_RE, "").trim())
    .filter((line) => line.length > 0);
}

export function isBrainDump(rawText: string): boolean {
  const lines = splitBrainDump(rawText);
  return lines.length >= 2;
}
