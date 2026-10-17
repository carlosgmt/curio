/**
 * RSS 2.0 Feed Generator for Curio Curated Boards
 * Formats XML feed with channel metadata, publication dates, and image enclosures.
 */

export interface RssListInput {
  id?: string;
  title: string;
  slug?: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RssItemInput {
  save?: {
    id: string;
    isPrivateMemo?: boolean;
    privateTitle?: string | null;
    createdAt?: string;
    [key: string]: any;
  };
  entity?: {
    id?: string;
    title: string;
    summary?: string | null;
    heroImageUrl?: string | null;
    canonicalUrl?: string | null;
    coreType?: string | null;
    typePath?: string | null;
    isPrivateMemo?: boolean;
    createdAt?: string;
    [key: string]: any;
  } | null;
  listItem?: {
    id?: string;
    curatorNote?: string | null;
    sectionHeader?: string | null;
    addedAt?: string;
    [key: string]: any;
  };
}

export interface RssOwnerInput {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc822Date(dateStr?: string): string {
  if (!dateStr) return new Date().toUTCString();
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

/**
 * Generates an RSS 2.0 XML feed for a curated list.
 */
export function generateRssFeed(
  list: RssListInput,
  items: RssItemInput[] = [],
  baseUrl: string = "https://curio.app",
  owner?: RssOwnerInput | null
): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const listSlug = list.slug || list.id || "board";
  const boardUrl = `${cleanBase}/list/${listSlug}`;
  const feedUrl = `${cleanBase}/api/v1/lists/${listSlug}/feed.rss`;
  const lastBuildDate = formatRfc822Date(list.updatedAt || list.createdAt);

  // Strictly filter out private memos
  const publicItems = items.filter((item) => {
    if (item.save?.isPrivateMemo) return false;
    if (item.entity?.isPrivateMemo) return false;
    if (item.entity?.coreType === "PRIVATE_MEMO") return false;
    return true;
  });

  const xmlItems = publicItems.map((item, index) => {
    const cardId = item.save?.id || item.entity?.id || `item-${index + 1}`;
    const cardUrl = `${cleanBase}/card/${cardId}`;
    const title = item.entity?.title || item.save?.privateTitle || `Item ${index + 1}`;
    const descText = item.listItem?.curatorNote || item.entity?.summary || title;
    const pubDate = formatRfc822Date(item.listItem?.addedAt || item.save?.createdAt || item.entity?.createdAt || list.createdAt);

    let enclosureTag = "";
    let mediaTag = "";
    if (item.entity?.heroImageUrl) {
      const imgUrl = escapeXml(item.entity.heroImageUrl);
      enclosureTag = `\n      <enclosure url="${imgUrl}" type="image/jpeg" length="0" />`;
      mediaTag = `\n      <media:content url="${imgUrl}" medium="image" />`;
    }

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(cardUrl)}</link>
      <guid isPermaLink="true">${escapeXml(cardUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${descText}]]></description>${enclosureTag}${mediaTag}
    </item>`;
  });

  const authorTag = owner
    ? `\n    <managingEditor>${escapeXml(owner.username)}@curio.app (${escapeXml(owner.displayName || owner.username)})</managingEditor>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(list.title)}</title>
    <link>${escapeXml(boardUrl)}</link>
    <description>${escapeXml(list.description || list.title)}</description>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>${authorTag}
${xmlItems.join("\n")}
  </channel>
</rss>`;
}
