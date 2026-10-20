/**
 * AT Protocol (Bluesky) Syndication Engine
 * Conforms to app.curio.curation lexicon and serializes curated items into
 * rich Bluesky posts with UTF-8 byte-indexed facets and external embed cards.
 */

export const CURIO_CURATION_LEXICON = "app.curio.curation" as const;

export interface CurioCurationRecord {
  $type: typeof CURIO_CURATION_LEXICON;
  title: string;
  url: string;
  description?: string | null;
  tags?: string[];
  curatorHandle?: string;
  heroImageUrl?: string | null;
  createdAt?: string;
}

export interface BlueskyFacetFeature {
  $type: "app.bsky.richtext.facet#link" | "app.bsky.richtext.facet#tag";
  uri?: string;
  tag?: string;
}

export interface BlueskyFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: BlueskyFacetFeature[];
}

export interface BlueskyPostPayload {
  $type: "app.bsky.feed.post";
  text: string;
  facets: BlueskyFacet[];
  embed?: {
    $type: "app.bsky.embed.external";
    external: {
      uri: string;
      title: string;
      description: string;
    };
  };
  createdAt: string;
}

/**
 * Serializes a Curio curation into an AT Protocol Bluesky post with valid byte offsets.
 */
export function buildBlueskyCurationPost(
  curation: CurioCurationRecord,
  curioBaseUrl: string = "https://curio.app"
): BlueskyPostPayload {
  const encoder = new TextEncoder();
  const createdAt = curation.createdAt || new Date().toISOString();

  // 1. Compose status text
  const cleanBase = curioBaseUrl.replace(/\/+$/, "");
  const destinationUrl = curation.url.startsWith("http")
    ? curation.url
    : `${cleanBase}${curation.url}`;

  let statusText = `Curated on @curio: ${curation.title}`;
  if (curation.description) {
    statusText += `\n\n"${curation.description.trim()}"`;
  }

  // 2. Add tags
  const validTags = (curation.tags || [])
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  const tagStrings = validTags.map((t) => `#${t}`);
  if (tagStrings.length > 0) {
    statusText += `\n\n${tagStrings.join(" ")}`;
  }

  // 3. Compute byte-indexed facets for mentions, links, and hashtags
  const facets: BlueskyFacet[] = [];

  // Match hashtags
  const hashtagRegex = /#([a-zA-Z0-9_-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = hashtagRegex.exec(statusText)) !== null) {
    const rawTag = match[0];
    const cleanTag = match[1];
    const charIndex = match.index;

    // Calculate byte indices using TextEncoder
    const preMatchBytes = encoder.encode(statusText.slice(0, charIndex)).length;
    const matchBytes = encoder.encode(rawTag).length;

    facets.push({
      index: {
        byteStart: preMatchBytes,
        byteEnd: preMatchBytes + matchBytes,
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#tag",
          tag: cleanTag,
        },
      ],
    });
  }

  // 4. Construct external embed card
  const embed = {
    $type: "app.bsky.embed.external" as const,
    external: {
      uri: destinationUrl,
      title: curation.title,
      description: curation.description || `Curated artifact on Curio`,
    },
  };

  return {
    $type: "app.bsky.feed.post",
    text: statusText,
    facets,
    embed,
    createdAt,
  };
}
