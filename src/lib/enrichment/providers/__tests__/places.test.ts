import { describe, expect, test } from "bun:test";
import { resolvePlace, placeTitleMatches, isAcceptableWikiPlace } from "../places";

function mockFetch(): typeof fetch {
  return (async (input: any) => {
    const url = String(input);
    if (url.includes("nominatim")) {
      const q = decodeURIComponent(url.split("q=")[1].split("&")[0]).toLowerCase();
      if (q.includes("provincias")) {
        return new Response(JSON.stringify([{ lat: "37.1757", lon: "-3.6003", name: "Bar Provincias", display_name: "Bar Provincias, Granada, Andalucía, España", type: "pub", class: "amenity", osm_type: "node", osm_id: 1, address: { city: "Granada", country: "España" } }]));
      }
      if (q.includes("tate")) {
        return new Response(JSON.stringify([{ lat: "51.5076", lon: "-0.0994", name: "Tate Modern", display_name: "Tate Modern, London", type: "museum", class: "tourism", osm_type: "way", osm_id: 2, address: { city: "London", country: "UK" } }]));
      }
      return new Response("[]");
    }
    if (url.includes("wikipedia.org")) {
      if (url.includes("Tate_Modern")) {
        return new Response(JSON.stringify({ type: "standard", title: "Tate Modern", description: "Art museum in London", extract: "x", wikibase_item: "Q1", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Tate_Modern" } } }));
      }
      if (url.includes("Provincias")) {
        return new Response(JSON.stringify({ type: "standard", title: "Syria Palaestina", description: "Roman province", extract: "x" }));
      }
    }
    return new Response("{}", { status: 404 });
  }) as any;
}

describe("place resolution", () => {
  test("name matching", () => {
    expect(placeTitleMatches("Bar Provincias", "Syria Palaestina")).toBe(false);
    expect(placeTitleMatches("Tate Modern", "Tate Modern")).toBe(true);
    expect(isAcceptableWikiPlace("Bar Provincias", { title: "Provincias", description: "Roman province" })).toBe(false);
  });
  for (const q of ["Bar Provincias", "Bar Provincias Granada"]) {
    test(q, async () => {
      const r = await resolvePlace(q, { fetchFn: mockFetch() });
      expect(r?.coordinates?.latitude).toBeCloseTo(37.1757, 3);
      expect(r?.canonicalUrl).not.toContain("Syria");
      expect(r?.city).toBe("Granada");
    });
  }
  test("Tate Modern uses Wikipedia", async () => {
    const r = await resolvePlace("Tate Modern", { fetchFn: mockFetch() });
    expect(r?.canonicalUrl).toContain("wikipedia.org/wiki/Tate_Modern");
  });
});
