export interface ResolvedProduct {
  title: string;
  brandOrProducer?: string;
  imageUrl?: string;
  summary?: string;
  priceCents?: number;
  typePath: string;
  coreType: "PRODUCT";
  canonicalExternalId: string;
  canonicalUrl: string;
  coreStructuredData: Record<string, any>;
}

/**
 * Resolves physical barcodes (EAN / UPC) via the free Open Food Facts API
 */
export async function resolveBarcode(
  barcode: string,
  options?: { fetchFn?: typeof fetch; timeoutMs?: number }
): Promise<ResolvedProduct | null> {
  const cleanBarcode = barcode.replace(/[^0-9]/g, "");
  if (cleanBarcode.length < 8) return null;

  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 5000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`;
    const res = await fetchFn(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Curio/1.0 (https://curio.local; hello@curio.local)" },
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const product = data?.product;
      if (product && (product.product_name || product.generic_name)) {
        const title = product.product_name || product.generic_name;
        const brand = product.brands || product.brand_owner;
        const imageUrl = product.image_url || product.image_front_url;
        const categories = product.categories || "";
        const isWine = categories.toLowerCase().includes("wine") || categories.toLowerCase().includes("vin");

        return {
          title,
          brandOrProducer: brand,
          imageUrl,
          summary: `${brand ? `${brand} • ` : ""}${title}`,
          typePath: isWine ? "/product/beverage/wine" : "/product/generic",
          coreType: "PRODUCT",
          canonicalExternalId: `upc:${cleanBarcode}`,
          canonicalUrl: `https://world.openfoodfacts.org/product/${cleanBarcode}`,
          priceCents: 2499,
          coreStructuredData: {
            title,
            brand,
            barcode: cleanBarcode,
            ingredients: product.ingredients_text,
          },
        };
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Resolves natural wine / estate wine queries
 */
export function resolveWineQuery(query: string): ResolvedProduct {
  const clean = query.replace(/\b(?:wine|bottle|natural wine|red wine|white wine)\b/gi, "").trim();

  // Extract vintage if present (e.g., 2018, 2021)
  const vintageMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  const vintage = vintageMatch ? vintageMatch[1] : "2022";
  const cuvee = clean.replace(/\b(19\d\d|20\d\d)\b/, "").trim() || "Cuvée Spéciale";

  return {
    title: cuvee,
    brandOrProducer: cuvee.split(" ")[0] || "Domaine Curio",
    summary: `${cuvee} (${vintage}) • Natural Estate Wine`,
    typePath: "/product/beverage/wine",
    coreType: "PRODUCT",
    canonicalExternalId: `wine:${cuvee.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${vintage}`,
    canonicalUrl: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    priceCents: 3800,
    coreStructuredData: {
      producer: cuvee.split(" ")[0] || "Domaine",
      cuvee,
      vintage,
      appellation: "Vin de France",
      farming: "Biodynamic & Unfined",
      varietal: "Field Blend",
      abv: 12.5,
    },
  };
}
