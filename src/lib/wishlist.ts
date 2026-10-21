/** Type-aware label for the wishlist ("Wish") toggle. */
export function wishLabel(typePath?: string | null, coreType?: string | null): string {
  const p = (typePath || "").toLowerCase();
  const c = (coreType || "").toUpperCase();
  if (p.includes("place") || c === "PLACE" || p.includes("travel")) return "Want to visit";
  if (p.includes("film") || p.includes("movie") || p.includes("series") || p.includes("tv") || c === "MEDIA") return "Want to watch";
  if (p.includes("music") || p.includes("album") || p.includes("song") || p.includes("vinyl")) return "Want to listen";
  if (p.includes("book") || p.includes("article") || p.includes("quote")) return "Want to read";
  if (p.includes("product") || p.includes("watch") || p.includes("garment") || p.includes("wine") || c === "PRODUCT") return "Want to buy";
  return "Wish";
}
