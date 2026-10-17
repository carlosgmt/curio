/**
 * ActivityPub / W3C ActivityStreams 2.0 Feed Generator
 * Serializes public curated boards into OrderedCollection feeds for federation.
 */

export interface ActivityPubListInput {
  id?: string;
  title: string;
  slug?: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityPubItemInput {
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

export interface ActivityPubOwnerInput {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Generates a W3C ActivityStreams 2.0 OrderedCollection representation of a curated list.
 */
export function generateActivityPubCollection(
  list: ActivityPubListInput,
  items: ActivityPubItemInput[] = [],
  baseUrl: string = "https://curio.app",
  owner?: ActivityPubOwnerInput | null
): Record<string, any> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const collectionId = `${cleanBase}/api/v1/federation/lists/${list.slug || list.id}`;
  const actor = owner
    ? `${cleanBase}/@${owner.username}`
    : `${cleanBase}`;

  // Strictly filter out private memos
  const publicItems = items.filter((item) => {
    if (item.save?.isPrivateMemo) return false;
    if (item.entity?.isPrivateMemo) return false;
    if (item.entity?.coreType === "PRIVATE_MEMO") return false;
    return true;
  });

  const orderedItems = publicItems.map((item, index) => {
    const cardId = item.save?.id || item.entity?.id || `item-${index + 1}`;
    const cardUrl = `${cleanBase}/card/${cardId}`;
    const published =
      item.listItem?.addedAt ||
      item.save?.createdAt ||
      item.entity?.createdAt ||
      list.createdAt ||
      new Date().toISOString();

    const title = item.entity?.title || item.save?.privateTitle || `Curated Item ${index + 1}`;
    const noteText = item.listItem?.curatorNote || item.entity?.summary || title;

    const attachment = item.entity?.heroImageUrl
      ? [
          {
            type: "Image",
            url: item.entity.heroImageUrl,
            mediaType: "image/jpeg",
          },
        ]
      : undefined;

    return {
      id: `${cardUrl}#activity`,
      type: "Create",
      actor,
      published,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
      object: {
        id: cardUrl,
        type: "Note",
        name: title,
        summary: item.listItem?.curatorNote || undefined,
        content: `<p>${escapeHtml(noteText)}</p>`,
        url: cardUrl,
        published,
        attributedTo: actor,
        ...(attachment ? { attachment } : {}),
      },
    };
  });

  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: collectionId,
    type: "OrderedCollection",
    name: list.title,
    summary: list.description || undefined,
    totalItems: orderedItems.length,
    orderedItems,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
