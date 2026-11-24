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

describe("dispatcher place namesake guard", () => {
  test("Bar Provincias never resolves to a namesake region", async () => {
    const { enrichCaptureInput } = await import("../../dispatcher");
    const fetchFn = (async (url: any) => {
      const u = String(url);
      if (u.includes("nominatim")) {
        return new Response(JSON.stringify([{ lat: "37.1757", lon: "-3.6003", name: "Bar Provincias", type: "pub", display_name: "Bar Provincias, Granada, España", address: { city: "Granada", country: "España" } }]), { status: 200 });
      }
      if (u.includes("wikidata.org")) {
        return new Response(JSON.stringify({ search: [{ id: "Q1669578", label: "Syria Palaestina", description: "Roman province", concepturi: "http://www.wikidata.org/entity/Q1669578" }] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const r: any = await enrichCaptureInput("Bar Provincias", { fetchFn, skipCache: true });
    expect(r.title).toBe("Bar Provincias");
    expect(String(r.canonicalUrl)).not.toContain("Syria");
  });
});

describe("Phase 2 Place, Maps Shortlink, Cinema P57 & Music Edition Precision", () => {
  test("Mimar Granada ranks hospitality/bar POI over craft=carpenter and threads locationHint", async () => {
    const seenQueries: string[] = [];
    const fetchFn = (async (input: any) => {
      const url = String(input);
      if (url.includes("nominatim")) {
        const q = decodeURIComponent(url.split("q=")[1].split("&")[0]);
        seenQueries.push(q);
        if (q.toLowerCase().includes("mimar granada")) {
          return new Response(
            JSON.stringify([
              {
                lat: "37.1611",
                lon: "-3.6122",
                name: "Carpintería Mimar",
                display_name: "Carpintería Mimar, Zaidín, Granada, España",
                class: "craft",
                type: "carpenter",
                osm_type: "node",
                osm_id: 101,
                address: { city: "Granada", country: "España" },
              },
              {
                lat: "37.1773",
                lon: "-3.5986",
                name: "Mimar",
                display_name: "Mimar, Calle San Matías, Centro, Granada, España",
                class: "amenity",
                type: "bar",
                osm_type: "node",
                osm_id: 202,
                address: { road: "Calle San Matías", suburb: "Centro", city: "Granada", country: "España" },
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("[]", { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const res = await resolvePlace("Mimar", {
      locationHint: "Mimar Granada",
      fetchFn,
    });
    expect(seenQueries[0]).toBe("Mimar Granada");
    expect(res?.title).toBe("Mimar");
    expect(res?.category?.toLowerCase()).toBe("bar");
    expect(res?.coordinates?.latitude).toBeCloseTo(37.1773, 4);
    expect(res?.city).toBe("Granada");
  });

  test("expands maps.app.goo.gl shortlinks via HTTP redirect and extracts @lat,lng coordinates", async () => {
    const { routeKnownDomainUrl } = await import("../../urlRouter");
    const expandedMapsUrl =
      "https://www.google.com/maps/place/Mimar+Granada/@37.1773,-3.5986,17z/data=!3m1!4b1";
    const fetchFn = (async (input: any) => {
      const u = String(input);
      if (u.includes("maps.app.goo.gl")) {
        const r = new Response("", { status: 200 });
        Object.defineProperty(r, "url", { value: expandedMapsUrl });
        return r;
      }
      if (u.includes("nominatim")) {
        return new Response("[]", { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const routed = await routeKnownDomainUrl("https://maps.app.goo.gl/abcXYZ123", { fetchFn });
    expect(routed).not.toBeNull();
    expect(routed?.typePath).toBe("/place");
    expect(routed?.title).toContain("Mimar Granada");
    expect(routed?.canonicalUrl).toBe(expandedMapsUrl);
    expect(routed?.coreStructuredData.latitude).toBeCloseTo(37.1773, 4);
    expect(routed?.coreStructuredData.longitude).toBeCloseTo(-3.5986, 4);
  });

  test("resolves film director via Wikidata P57 and strips music edition noise cleanly", async () => {
    const { resolveFilm } = await import("../cinema");
    const { stripMusicEditionNoise } = await import("../music");

    // Music edition stripping + boundary preservation
    expect(stripMusicEditionNoise("Omega (Edición 20º Aniversario)", "Omega")).toBe("Omega");
    expect(stripMusicEditionNoise("Omega (Edición 20.º Aniversario)", "Omega")).toBe("Omega");
    expect(stripMusicEditionNoise("Blue Train [2024 Remaster]", "Blue Train")).toBe("Blue Train");
    expect(
      stripMusicEditionNoise("Omega (Edición 20º Aniversario)", "Omega Edición Aniversario")
    ).toBe("Omega (Edición 20º Aniversario)");
    expect(stripMusicEditionNoise("Stop Making Sense (Live)", "Stop Making Sense")).toBe(
      "Stop Making Sense (Live)"
    );

    // Wikidata P57 structured director lookup
    const filmFetch = (async (input: any) => {
      const u = String(input);
      if (u.includes("itunes.apple.com/search")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }
      if (u.includes("en.wikipedia.org/api/rest_v1/page/summary/")) {
        return new Response(
          JSON.stringify({
            type: "standard",
            title: "Amores perros",
            description: "2000 Mexican anthology drama film",
            extract: "Amores perros is a 2000 anthology drama film set in Mexico City.",
            wikibase_item: "Q220780",
            content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Amores_perros" } },
          }),
          { status: 200 }
        );
      }
      if (u.includes("wbgetentities") && u.includes("Q220780")) {
        return new Response(
          JSON.stringify({
            entities: {
              Q220780: {
                claims: {
                  P57: [{ mainsnak: { datavalue: { value: { id: "Q55215" } } } }],
                },
              },
            },
          }),
          { status: 200 }
        );
      }
      if (u.includes("wbgetentities") && u.includes("Q55215")) {
        return new Response(
          JSON.stringify({
            entities: {
              Q55215: {
                labels: { en: { value: "Alejandro González Iñárritu" } },
              },
            },
          }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;

    const film = await resolveFilm("Amores perros", { yearHint: 2000, fetchFn: filmFetch });
    expect(film?.director).toBe("Alejandro González Iñárritu");
  });
});
