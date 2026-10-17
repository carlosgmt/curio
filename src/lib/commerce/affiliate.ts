export interface UserAffiliateTags {
  amazon?: string;
  bookshop?: string;
  ltk?: string;
  skimlinks?: string;
  customRef?: string;
}

export const PLATFORM_AFFILIATE_DEFAULTS = {
  amazon: "curio-20",
  bookshop: "curio",
  discogs: "curio_curate",
  customRef: "curio",
} as const;

/**
 * Injects creator or platform affiliate tracking parameters into outbound merchant URLs
 */
export function buildAffiliateUrl(
  url: string,
  sellerName?: string,
  affiliateTemplate?: string | null,
  creatorTags?: UserAffiliateTags | null
): string {
  if (affiliateTemplate) {
    let templated = affiliateTemplate.replace("{url}", encodeURIComponent(url));
    if (creatorTags?.amazon) {
      templated = templated.replace("{tag}", encodeURIComponent(creatorTags.amazon));
    }
    if (creatorTags?.customRef) {
      templated = templated.replace("{ref}", encodeURIComponent(creatorTags.customRef));
    }
    return templated;
  }

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const seller = sellerName?.toLowerCase() || "";

    // 1. Amazon Associates
    if (domain.includes("amazon.") || seller === "amazon") {
      const amazonTag = creatorTags?.amazon || PLATFORM_AFFILIATE_DEFAULTS.amazon;
      parsed.searchParams.set("tag", amazonTag);
      return parsed.toString();
    }

    // 2. Bookshop.org
    if (domain.includes("bookshop.org") || seller === "bookshop.org") {
      const bookshopAid = creatorTags?.bookshop || PLATFORM_AFFILIATE_DEFAULTS.bookshop;
      parsed.searchParams.set("aid", bookshopAid);
      return parsed.toString();
    }

    // 3. Discogs Marketplace
    if (domain.includes("discogs.com") || seller === "discogs") {
      const discogsTag = creatorTags?.customRef || PLATFORM_AFFILIATE_DEFAULTS.discogs;
      parsed.searchParams.set("ev", discogsTag);
      return parsed.toString();
    }

    // 4. Default parameter injection for direct links
    const refTag = creatorTags?.customRef || PLATFORM_AFFILIATE_DEFAULTS.customRef;
    if (creatorTags?.customRef) {
      parsed.searchParams.set("ref", refTag);
    } else if (!parsed.searchParams.has("ref")) {
      parsed.searchParams.set("ref", refTag);
    }

    const modifiedUrl = parsed.toString();

    // 5. Skimlinks Redirect Wrapper
    if (creatorTags?.skimlinks) {
      if (creatorTags.skimlinks.startsWith("http://") || creatorTags.skimlinks.startsWith("https://")) {
        const skimUrl = new URL(creatorTags.skimlinks);
        skimUrl.searchParams.set("url", modifiedUrl);
        return skimUrl.toString();
      }
      return `https://go.skimresources.com/?id=${encodeURIComponent(creatorTags.skimlinks)}&url=${encodeURIComponent(modifiedUrl)}`;
    }

    // 6. LTK (rewardStyle) Redirect Wrapper
    if (creatorTags?.ltk) {
      if (creatorTags.ltk.startsWith("http://") || creatorTags.ltk.startsWith("https://")) {
        const ltkUrl = new URL(creatorTags.ltk);
        ltkUrl.searchParams.set("url", modifiedUrl);
        return ltkUrl.toString();
      }
      return `https://liketk.it/open?creator=${encodeURIComponent(creatorTags.ltk)}&url=${encodeURIComponent(modifiedUrl)}`;
    }

    return modifiedUrl;
  } catch {
    return url;
  }
}
