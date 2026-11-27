---
name: Curio
description: Clean Gallery Elevation — a tactile whole-life archive and modular MCP vault pairing warm gallery stock with H1 Framed Folio identity and Viridian/Prussian registers.
colors:
  viridian-library: "#1B5E46"
  viridian-glow: "#4CA382"
  viridian-soft: "rgba(27, 94, 70, 0.09)"
  prussian-mcp: "#1B3B6F"
  cobalt-mcp-glow: "#6B93F5"
  mcp-soft: "rgba(27, 59, 111, 0.09)"
  gallery-wall: "#F2EFE9"
  gallery-card: "#FFFFFF"
  espresso-ink: "#1C1A17"
  warm-stone: "#716B62"
  stone-wash: "#E8E3DA"
  gallery-hairline: "rgba(28, 26, 23, 0.07)"
  obsidian-wall: "#121110"
  obsidian-card: "#1C1A17"
  linen-ink: "#F2EFE9"
  ash-muted: "#A8A196"
  bindery-stage: "#201819"
  poster-stage: "#141312"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "var(--font-sans-ui), system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "var(--font-mono-tech), ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.08em"
  micro:
    fontFamily: "var(--font-mono-tech), ui-monospace, monospace"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.1em"
rounded:
  sm: "6px"
  md: "12px"
  lg: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "36px"
components:
  card-gallery:
    backgroundColor: "{colors.gallery-card}"
    textColor: "{colors.espresso-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px"
  button-primary:
    backgroundColor: "{colors.viridian-library}"
    textColor: "{colors.linen-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-mcp:
    backgroundColor: "{colors.mcp-soft}"
    textColor: "{colors.prussian-mcp}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  button-ghost:
    backgroundColor: "{colors.gallery-card}"
    textColor: "{colors.warm-stone}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  pill-filter-active:
    backgroundColor: "{colors.viridian-library}"
    textColor: "{colors.linen-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  input-omnibox:
    backgroundColor: "{colors.gallery-card}"
    textColor: "{colors.espresso-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
---

# Curio Design System

## Overview

**Creative North Star: "The Collector's Gallery Wall"**

Curio presents saved cultural objects, wardrobe pieces, household gear, private notes, and connected life records like curated artifacts mounted on warm gallery walls and housed inside dark bindery alcoves. Its emblem—**H1 · Framed Folio** paired with the solid `Newsreader` wordmark `Curio` (sculptural upright `C`, clean `u`, italic `r`, solid `i` and `o`)—shows three architectural folios inside corner brackets with the middle folio sliding outward across the boundary to signify selective disclosure.

- **Key Characteristics:**
  - Elevated `#FFFFFF` gallery card stock floating over matte `#F2EFE9` warm plaster (`#1C1A17` cards over `#121110` Obsidian in dark mode).
  - Dual-register restraint: **Viridian Library** (`#1B5E46` / `#4CA382`) marks human curation; **Prussian Ink / Archival Cobalt** (`#1B3B6F` / `#6B93F5`) is reserved exclusively for live MCP agent scopes.
  - Strictly 3 navigation tiers (`Top Boards -> Sub-Boards -> Contextual Filters`) and automatic domain views matched to each artifact type.
  - Unified `HairlineTickRuler` telemetry and `Tabular` specimen cards designed to scale cleanly into financial ledgers, health biometrics, and life timelines.

## Colors

Curio relies on warm architectural neutrals for 95% of every viewport.

- **Human Curation Accent:** **Viridian Library** (`#1B5E46` light / `#4CA382` dark; `--brand-soft: rgba(27, 94, 70, 0.09)`). Used on active board tabs, H1's sliding folio slab, wishlist hearts, `Immerse`, and 3D/biometric tick needles.
- **MCP Scope Register:** **Prussian Ink / Archival Cobalt** (`#1B3B6F` light / `#6B93F5` dark; `--mcp-scope-soft: rgba(27, 59, 111, 0.09)`). Reserved **exclusively** for active MCP vault scopes and agent exposure badges.
- **Three-State Exposure Grammar:**
  - *Private / Sealed:* Default Warm Stone ink (`Private · Local Vault`) + closed lock icon in Obsidian MCP pills.
  - *Shared Editorial:* Quiet Viridian ink (`Shared · Editorial`) on public boards.
  - *MCP Scoped:* Prussian/Cobalt hairline pill (`Books · Open`).

**The One Voice Rule.** Never color-code card categories with saturated semantic pills, and never cross-contaminate category chrome with MCP Cobalt.

## Typography

- **Brand & Display Headlines (`display`, `headline`, `title`):** `Newsreader` / `--font-serif-editorial` (`font-weight: 400`, tight tracking, `text-wrap: balance`). Wordmark pairs upright `C`/`u`/`i`/`o` with italic `r`.
- **UI & Notes (`body`):** `Inter` (`14px`, line-height `1.5`, `text-wrap: pretty`).
- **Tabular Data & Index Counts (`label`, `micro`):** `JetBrains Mono` (`10px–11px`, `tabular-nums`) for counts, prices, financial figures, biometric metrics, and `HairlineTickRuler` indices.

**The Silent Spec Sheet Rule.** Never invent placeholder metadata (empty ratings or fake durations), expose internal ingestion keys inside cards, or precede titles with uppercase eyebrow kickers.

## Layout

- **Masthead & 3-Tier Navigation:** Single-row `max-w-6xl` masthead (`[H1] Curio` left, `Omnibox` center, `MCP · N Scopes` + `Sync` + `Immerse` + `UserNav` right), followed cleanly by `Level A: Top Boards` (`Stream`, `Wishlist`, root boards), `Level B: Sub-Boards` (shown only when nested sub-boards or contextual actions exist), and `Level C: Contextual Filters`.
- **Automatic Domain Views:** `Books` (`3D Stripe Press`), `Films` (`3D Cinema Posters`), and `Music` (`3D LP Vinyl Crate`) support a scoped `3D Stage / 2D Grid` toggle; `Closet` & `My Stuff` stay locked to `2D Grid` (ceiling `lg:grid-cols-3`); `Stream`, `Recipes`, & `Granada` stay locked to `2D Masonry` (`lg:columns-3`).
- **Mobile Chrome (`< 768px`):** Compact `< 48px` (`h-11`) auto-hiding sticky header using bare-folio `CurioLogo` + native `<dialog>` filter/MCP sheets + `100dvh` horizontal `scroll-snap` Exhibition Deck.

## Elevation & Depth

- **Resting Card (`--shadow-rest`):** Top edge catchlight `inset 0 1px 0 #FFFFFF` + soft drop shadow + `1px solid var(--gallery-hairline)`.
- **Hover Lift (`--shadow-lift`):** `translateY(-2.5px)` at `180ms cubic-bezier(0.23, 1, 0.32, 1)`.
- **3D Press Stage:** Unboxed `#201819` Dark Bindery / `#141312` Obsidian Poster Stage lit by soft radial scrim and pointer-tracked light.

**The Tactile Stock Rule.** Never nest bordered boxes inside bordered cards or place raw inputs above unstyled frames.

## Shapes

- **Cards & Omnibox (`12px`):** Clean book-plate corners; **Pills (`9999px`):** Interactive filters, MCP scope toggles, and primary actions.
- **`HairlineTickRuler`:** `1px` vertical index ticks with a `15px` active Viridian needle inside a `role="slider"` track—shared by 3D stages and biometric/timeline strips.

## Components

- **H1 Framed Folio (`CurioLogo`):** `CurioMark` SVG in Obsidian/Cream (PWA icons & desktop masthead) simplifying gracefully to bare `H3` folio bars below `24px`.
- **Modular MCP Vault Sheet (`McpVaultSheet`):** Native `<dialog>` Obsidian (`#121110`) control panel managing persisted domain scopes (`Books`, `Films`, `Music`, `Recipes`, `Places`, `Closet`, `My Stuff`, `Private Memos`).
- **Type-Scoped Card Actions (`capabilities.ts`):** `"Bought it"` renders strictly on unowned purchasable goods; `"Press Stage / 3D"` strictly on physical media; `CardFooterWaterfall` returns `null` when zero authentic links apply.

## Do's and Don'ts

### Do:
- **Do** reserve Viridian (`#1B5E46` / `#4CA382`) for human curation and Prussian/Cobalt (`#1B3B6F` / `#6B93F5`) for live MCP agent scopes.
- **Do** route automatic views through `resolveAutomaticBoardLayout()` so recipes and purchased inventory never mount as 3D books.
- **Do** use native `<dialog>` (`showModal()`), `100dvh` units, `overscroll-behavior-x: contain`, and clamped `{ passive: true }` scroll listeners.

### Don't:
- **Don't** render `"Bought it"` or fabricated search footers (`Google Shopping`, `Instacart`, `NYT Cooking`, `Lookbook`) on recipes, outfits, quotes, or memos.
- **Don't** surface hidden `Closet` or `Private Memos` items when their Modular MCP domain scope is sealed.
- **Don't** add `role="dialog"`, `aria-modal`, `<input type="range">` scrubbers, or hooks after conditional returns.
