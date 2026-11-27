<!-- impeccable:product-schema 1 -->
# Curio

Platform: web
Kind: Personal taste graph, archival capture system, and polymorphic curation workspace

## Product Truth
- Curio lets one owner capture links, books, films, wardrobe garments, outfits, products, recipes, places, music, travel passes, and encrypted private memos at low friction and browse them through artifact-authentic silhouettes and quiet boards.
- Supports local-first private collections alongside intentionally shared read-only editorial boards (`/curio/list/[slug]`) with UCP commerce links and synaptic memory connections (`PAIRED_WITH`, `WORN_ON`).
- Dedicated 3D physical archives exist for books (`Library` / `ShelfLayout` / `VirtualBookshelf3D`) and cinema (`Cinema` / `PosterWallLayout` / `VirtualPosterWall3D`).
- Sync pipelines (`src/lib/sync/*`) populate wardrobe/outfits, Purchase Hub gear, Goodreads/hardcover books, Letterboxd/FilmAffinity films, and Chef UI recipes.

## Aesthetic & Craft Constraints
- Aesthetic direction: **Clean Gallery Elevation** paired with **Stripe Press Dark Bindery** 3D shelves (`iA Writer`, `The Sartorialist`, `~2009 Tumblr`, `Stripe Press`, `Things 3`, `Vitsoe 606`).
- Palette: Warm gallery ground (`#F2EFE9`) + crisp `#FFFFFF` elevated stock + Cognac Sienna (`#8C5A3C`); Dark Obsidian ground (`#121110`) + `#1C1A17` lifted stock + Warm Foil (`#C89572`). No paper grain noise, no neon rainbow pill confetti.
- Density & chrome: Desktop capped at 2–3 wide photobook columns; resting cards show zero floating buttons or pill walls (revealed on hover / `:focus-within` or inside inspector/exhibition sheets).
- Mobile (`< 768px`): Single auto-hiding `< 48px` (`< 12%` viewport height) sticky board bar with a `<dialog>` filter bottom sheet and a full-screen `100dvh` horizontal `scroll-snap` Exhibition Deck.
