---
name: Curio
description: Clean Gallery Elevation — a tactile editorial taste-graph workspace pairing warm gallery card stock with 3D Stripe Press volumes.
colors:
  cognac-sienna: "#8C5A3C"
  cognac-sienna-glow: "#C89572"
  cognac-sienna-soft: "rgba(140, 90, 60, 0.10)"
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
    backgroundColor: "{colors.cognac-sienna}"
    textColor: "{colors.linen-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  button-ghost:
    backgroundColor: "{colors.gallery-card}"
    textColor: "{colors.warm-stone}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  pill-filter:
    backgroundColor: "{colors.gallery-card}"
    textColor: "{colors.warm-stone}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  pill-filter-active:
    backgroundColor: "{colors.cognac-sienna}"
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

Curio presents saved cultural objects—books, garments, films, venues, recipes, and notes—like artifacts mounted on warm linen gallery walls and housed inside dark bindery alcoves. The visual voice is quiet, tactile, editorial, and sunlit.

- **Key Characteristics:**
  - Elevated `#FFFFFF` gallery card stock floating over matte `#F2EFE9` warm plaster (`#1C1A17` cards over `#121110` Obsidian in dark mode).
  - Real `1px` perimeter hairlines, crisp top catchlights (`inset 0 1px 0 #FFFFFF`), and layered contact shadows replacing flat bordered SaaS tiles.
  - Strictly restrained monochrome ink and single Cognac Sienna accent (`#8C5A3C` light / `#C89572` dark) across all chrome.
  - Content-first rest state: action toolbars and merchant waterfalls reveal on hover or keyboard focus, never permanently cluttering every object.
  - Tactile 3D Stripe Press stages (`#201819` Dark Bindery / `#141312` Obsidian Poster Stage) with overhanging cloth hardcovers, cream page blocks, and hairline index rulers.

- **Confirmed Visual Anti-References:**
  - Flat un-lifted cards with indistinguishable page/surface contrast.
  - Permanent action badge walls (`70–179+` structural wear/synapse pills under cards).
  - Uppercase serif-over-mono "eyebrow kickers", decorative status dots, or rainbow category pills.

## Colors

Curio relies on warm architectural neutrals for 95% of every viewport, reserving Cognac Sienna solely for active state commitment and primary editorial calls to action.

- **Primary Accent:** Cognac Sienna (`#8C5A3C` on light walls; `#C89572` on dark Obsidian and Bindery stages; `rgba(140, 90, 60, 0.10)` soft wash).
- **Light Surface Ramp:** `#F2EFE9` Warm Gallery Wall (`--background`), `#FFFFFF` Elevated Gallery Card Stock (`--card`), `#E8E3DA` Warm Stone wash (`--secondary`), `rgba(28, 26, 23, 0.07)` Stone Hairline (`--gallery-hairline`).
- **Dark & 3D Stage Ramp:** `#121110` Obsidian Gallery Wall, `#1C1A17` Obsidian Card Surface, `#201819` Stripe Press Dark Bindery Stage, `#141312` Poster Screening Stage.
- **Typography Ink:** `#1C1A17` Espresso Ink (`#F2EFE9` Linen in dark mode), `#716B62` Warm Stone Secondary Ink (`#A8A196` Ash in dark mode).

**The One Voice Rule.** Never color-code card categories with neon or saturated semantic pills (no cyan/emerald/violet category badges on gallery cards). Semantic colors (`emerald`, `amber`) are reserved strictly for live sync telemetry and transient toast alerts.

## Typography

Curio pairs an expressive high-contrast editorial serif with clean UI sans-serif body copy and tabular monospace metadata.

- **Display / Editorial Headlines (`display`, `headline`, `title`):** `Newsreader` / `--font-serif-editorial` (`font-weight: 400`, tight `-0.015em` to `-0.025em` tracking, `text-wrap: balance`).
- **UI & Notes (`body`):** `Inter` / `--font-sans-ui` (`14px`, line-height `1.5`, `text-wrap: pretty`).
- **Metadata & Index Counts (`label`):** `JetBrains Mono` / `--font-mono-tech` (`11px`, `font-variant-numeric: tabular-nums`) for counts, years, runtimes, prices, and hairline ruler indices.

**The Silent Spec Sheet Rule.** Never invent placeholder metadata (`Studio Release`, `N/A`, `0 min`), dump internal ingestion keys (`purchaseHubProductId`, `ownerScope`), or precede titles with uppercase eyebrow labels inside cards. Show only authentic metadata present on the object.

## Layout

- **Desktop Container Rhythm:** All primary feeds, public boards (`/list/[slug]`), `/library`, and `/cinema` cap content at `max-w-6xl` (`1152px`) centered with generous horizontal breathing room (`px-4 sm:px-6 lg:px-8`).
- **Photobook Masonry & Grid Ceiling:** `MasonryLayout` and `GridLayout` cap strictly at 3 columns (`columns-1 sm:columns-2 lg:columns-3 gap-6 sm:gap-8 lg:gap-9`) so physical silhouettes read like exhibition plates rather than cramped spreadsheet cells.
- **Mobile Chrome (`< 768px`):** Auto-hiding single-row `< 48px` (`h-11`, `44px`) sticky navigation bar containing back/title/count, `Filter` bottom sheet trigger, and `Immerse` exhibition deck trigger. Keep sticky focus visible via `:focus-within`.
- **Immersive Exhibition Deck:** Full-viewport `100dvh` native `<dialog>` horizontal CSS scroll-snap track (`scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`) with 1-tap frosted action HUD toggle.

## Elevation & Depth

Curio avoids flat washed-out grids through fine material edges and directional contact shadows.

- **Resting Gallery Card (`--shadow-gallery-rest`):** Top edge catchlight `inset 0 1px 0 rgba(255,255,255,0.9)` paired with `0 1px 2px rgba(28,26,23,0.05), 0 6px 18px -4px rgba(28,26,23,0.06)` and a `1px solid var(--gallery-hairline)` perimeter.
- **Hover Lift (`--shadow-gallery-lift`):** Smooth `translateY(-2.5px)` elevation (`180ms cubic-bezier(0.22, 1, 0.36, 1)`) deepening shadow spread to `0 14px 28px -8px rgba(28,26,23,0.12)`.
- **3D Press Stage:** Unboxed deep plum/charcoal matte backdrop (`#201819` / `#141312`) lit by a centered soft radial scrim and cursor-tracked gold/copper foil specular key light (`foilLight`).

**The Tactile Stock Rule.** Never nest bordered boxes inside bordered cards (`p-6 rounded-3xl` boxes around board headers, or inner card frames around silhouettes). Let white card stock against warm gallery plaster establish boundaries cleanly.

## Shapes

- **Cards & Omnibox (`12px`):** `--radius-gallery` (`0.75rem`) creates a crisp book-plate corner without toy-like `rounded-3xl` bubble geometry.
- **Action Controls & Filter Chips (`9999px`):** Pill silhouettes distinguish interactive filters, wishlist hearts, and `Immerse` triggers from rectangular collection artifacts.
- **Edge-to-Edge Media:** Images bleed flush inside cards with subtle `aspect-ratio` stability; 3D hardcover volumes feature physically overhanging front/back binder boards, recessed cream page blocks, rounded buckram spines, and woven headbands.
- **Hairline Tick-Mark Rulers:** 3D shelf scrubbers use vertical `1px` tick marks (`5px`, `9px`, `15px` active Sienna needle) inside `role="slider"` widgets instead of native browser `<input type="range">` sliders.

## Components

### Gallery Card (`PolymorphicCard` & `.curio-gallery-card`)
- Clean white/obsidian stock with `1px` hairline perimeter, image plate or typographic specimen body, single-line title, authentic creator/year subtitle, and max `2` inline curated Synapse Pills (`+N more` overflow chip; `0` in Compact mode).
- Floating Wishlist & Pair triggers (`curio-hover-chrome`) and Merchant affiliate links (`curio-hover-footer`) fade in on card `:hover`, `:focus-within`, and stay accessible on touch devices (`@media (hover: none)`).

### Swiss Tab Ledger (`ListTabsBar`)
- Flat horizontal rule (`border-b border-border`) with `2px` Cognac Sienna bottom underline on the active board tab and `tabular-nums` item counts.

### Omnibox Capture (`Omnibox`)
- Elevated `rounded-xl` white/obsidian input plate with Focus ring (`2px solid var(--brand)` at `2px` offset) and quiet muted type-hint shortcuts.

### Native Modal Sheet & Exhibition (`BoardFilterSheet` & `BoardExhibitionModal`)
- Built directly on native `<dialog>` + `showModal()` / `close()` with `overscroll-behavior: contain` on `dialog:modal` and `dialog::backdrop`, pointer-down/up backdrop bounds dismissal, and native horizontal scroll-snap slides.

## Do's and Don'ts

### Do:
- **Do** keep `1px` perimeter hairlines (`var(--gallery-hairline)`), top highlight catchlights, and subtle lift transitions on every interactive object card.
- **Do** fold Closet `WORN_ON` and automatic co-wear links into wear counts and collapsed Lightbox drawers, capping visible inline card pills at `2`.
- **Do** use native `<dialog>` (`showModal()`), `100dvh` units, `overscroll-behavior-x: contain`, and clamped `{ passive: true }` scroll listeners for mobile navigation and carousels.
- **Do** render quantitative counts (`tabular-nums`), years, and runtimes in `--font-mono-tech`.

### Don't:
- **Don't** add `role="dialog"`, `aria-modal`, body `overflow: hidden` scroll locks, or synthetic `Esc` traps on native `<dialog>` elements.
- **Don't** expand masonry/grid columns past `lg:columns-3` / `lg:grid-cols-3`, or use `rounded-3xl` bubble containers around stage heroes or board headers.
- **Don't** place `<input type="range">` sliders, gradient rainbow pills, or decorative eyebrow kickers on editorial cards or 3D stages.
- **Don't** call React Hooks (`useMemo`, `useState`, `useEffect`) after conditional `if (...) return` statements in view components.
