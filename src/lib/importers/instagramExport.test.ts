import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db, globalEntities, smartLists, users, userSaves } from "@/db";
import {
  decodeMetaMojibake,
  importInstagramExport,
  parseInstagramExportJson,
} from "./instagramExport";

describe("Instagram Data Export JSON Importer", () => {
  it("decodes Meta Latin-1 UTF-8 mojibake while leaving clean UTF-8 intact", () => {
    const mojibake = "Caf\u00c3\u00a9 en Madrid \u00f0\u009f\u0094\u00a5";
    expect(decodeMetaMojibake(mojibake)).toBe("Café en Madrid 🔥");
    expect(decodeMetaMojibake("Already clean Café ☕")).toBe("Already clean Café ☕");
  });

  it("parses and merges saved_posts.json and saved_collections.json", () => {
    const combined = {
      saved_posts: {
        saved_saved_media: [
          {
            title: "https://www.instagram.com/p/ABC123/",
            string_map_data: {
              "Saved on": {
                href: "https://www.instagram.com/p/ABC123/",
                timestamp: 1760000000,
              },
              Author: {
                value: "studio_uno",
              },
            },
          },
          {
            title: "https://www.instagram.com/reel/REEL999/",
            string_map_data: {
              "Saved on": {
                href: "https://www.instagram.com/reel/REEL999/",
                timestamp: 1760001000,
              },
            },
          },
        ],
      },
      saved_collections_json: {
        saved_collections: [
          {
            name: "Dise\u00c3\u00b1o Interior",
            media_list: [
              {
                title: "https://www.instagram.com/p/ABC123/",
                string_map_data: {
                  "Saved on": {
                    href: "https://www.instagram.com/p/ABC123/",
                    timestamp: 1760000000,
                  },
                },
              },
            ],
          },
        ],
      },
    };

    const parsed = parseInstagramExportJson(combined);
    expect(parsed).toHaveLength(2);
    const post = parsed.find((p) => p.shortcode === "ABC123");
    expect(post).toBeDefined();
    expect(post?.authorUsername).toBe("studio_uno");
    expect(post?.collections.map((c) => c.name)).toEqual(["Diseño Interior"]);

    const reel = parsed.find((p) => p.shortcode === "REEL999");
    expect(reel?.mediaType).toBe("video");
    expect(reel?.permalink).toBe("https://www.instagram.com/reel/REEL999/");
  });

  it("imports parsed export into Curio Instagram Saves board & collection sub-boards", async () => {
    const ts = Date.now();
    const [user] = await db
      .insert(users)
      .values({ email: `ig-exp-${ts}@curio.local`, username: `ig_exp_${ts}` })
      .returning();

    const payload = {
      saved_collections: [
        {
          name: `Architecture ${ts}`,
          media_list: [
            {
              title: `https://www.instagram.com/p/ARCH_${ts}/`,
              string_map_data: {
                "Saved on": {
                  href: `https://www.instagram.com/p/ARCH_${ts}/`,
                  timestamp: 1760002000,
                },
                Author: { value: "arch_daily" },
              },
            },
          ],
        },
      ],
    };

    const res = await importInstagramExport(user.id, payload, {
      skipMediaArchive: true,
    });
    expect(res.parsedCount).toBe(1);
    expect(res.createdSaves).toBe(1);

    const [entity] = await db
      .select()
      .from(globalEntities)
      .where(eq(globalEntities.entityKey, `instagram:ARCH_${ts}`));
    expect(entity).toBeDefined();

    const saves = await db
      .select()
      .from(userSaves)
      .where(eq(userSaves.userId, user.id));
    expect(saves).toHaveLength(1);

    const lists = await db
      .select()
      .from(smartLists)
      .where(eq(smartLists.userId, user.id));
    expect(lists.some((l) => !l.parentId && l.title === "Instagram Saves")).toBe(true);
    expect(lists.some((l) => l.title === `Architecture ${ts}`)).toBe(true);
  });
});
