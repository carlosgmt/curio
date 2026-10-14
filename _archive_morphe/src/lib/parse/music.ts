import type { CardBlock } from "@/components/blocks/types";

export interface ParsedMusic {
  title: string;
  artist?: string;
  album?: string;
  genre?: string;
  summary: string;
  blocks: CardBlock[];
}

export function parseMusic(text: string): ParsedMusic {
  const clean = text.replace(/^(music:?|song:?|listen:?|track:?)\s*/i, "");

  const artistMatch = clean.match(/(?:by|artist:?)\s*([^,;.\n]+)/i);
  const artist = artistMatch ? artistMatch[1].trim() : undefined;

  const albumMatch = clean.match(/(?:from|album:?)\s*([^,;.\n]+)/i);
  const album = albumMatch ? albumMatch[1].trim() : undefined;

  let title = clean.split(/[,;\n]|(?:\s+by\s+)/i)[0].trim();
  title = title.replace(/^["']|["']$/g, "");

  const summary = `${title}${artist ? ` - ${artist}` : ""}`;

  const blocks: CardBlock[] = [
    {
      kind: "header",
      title,
      subtitle: artist ? `by ${artist}` : "Music",
      badge: album,
    },
    {
      kind: "properties",
      items: [
        ...(artist ? [{ label: "Artist", value: artist }] : []),
        ...(album ? [{ label: "Album", value: album }] : []),
      ],
    },
    {
      kind: "actions",
      links: [
        {
          label: "Spotify Search",
          url: `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist || ""}`)}`,
          iconName: "music",
        },
      ],
    },
  ];

  return {
    title,
    artist,
    album,
    summary,
    blocks,
  };
}
