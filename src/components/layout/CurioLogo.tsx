import React from "react";

export interface CurioMarkProps {
  /** Render size in CSS pixels. Below 24px or when variant="compact", drops outer brackets cleanly. */
  size?: number;
  variant?: "full" | "compact";
  className?: string;
}

/**
 * H1 · Framed Folio emblem: four architectural corner brackets mark the personal vault
 * while the Viridian center folio slides outward to signify selective board / MCP disclosure.
 */
export function CurioMark({
  size = 28,
  variant = "full",
  className = "",
}: CurioMarkProps) {
  const useCompact = variant === "compact" || size < 24;

  if (useCompact) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
        className={`shrink-0 ${className}`}
      >
        <rect x="4" y="8.5" width="18" height="3.2" rx="0.6" fill="currentColor" />
        <rect
          x="4"
          y="15.8"
          width="27"
          height="4.4"
          rx="0.7"
          fill="var(--brand)"
        />
        <rect x="4" y="24.3" width="18" height="3.2" rx="0.6" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {/* Vault Corner Framing Brackets */}
      <path
        d="M4 11V4H11M25 4H32V11M4 25V32H11M25 32H32V25"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="square"
      />
      {/* Top & Bottom Archival Folio Slabs */}
      <rect x="9.5" y="11.4" width="13.2" height="2.2" rx="0.5" fill="currentColor" />
      <rect x="9.5" y="22.4" width="13.2" height="2.2" rx="0.5" fill="currentColor" />
      {/* Active Sliding Folio Crossing the Right Boundary Gap */}
      <rect
        x="9.5"
        y="16.1"
        width="23.5"
        height="3.8"
        rx="0.6"
        fill="var(--brand)"
      />
    </svg>
  );
}

export interface CurioLogoProps {
  variant?: "full" | "compact";
  size?: number;
  className?: string;
}

/**
 * Option B Solid Newsreader wordmark ("Curio" with italic 'r' and solid 'o') paired
 * beside the H1 Framed Folio mark.
 */
export function CurioLogo({
  variant = "full",
  size,
  className = "",
}: CurioLogoProps) {
  const iconSize = size ?? (variant === "compact" ? 18 : 28);
  const textClass =
    variant === "compact"
      ? "text-[17px] leading-none"
      : "text-[24px] sm:text-[26px] leading-none";

  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <CurioMark size={iconSize} variant={variant} />
      <span
        className={`font-serif-editorial font-normal tracking-[-0.025em] text-foreground ${textClass}`}
      >
        Cu<em className="italic font-normal">r</em>io
      </span>
    </span>
  );
}
