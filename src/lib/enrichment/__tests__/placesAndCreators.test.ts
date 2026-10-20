import { describe, it, expect } from "bun:test";
import { discoverUniversalEntities } from "../universalDiscovery";
import { resolvePlace } from "../providers/places";
import { resolveCreator } from "../providers/creators";
import { parseTransitPass } from "../providers/travel";
import { enrichCaptureInput } from "../dispatcher";

describe("Places, Creators, and Transit Enrichment Engine", () => {
  it("resolves Tate Modern as a Place venue with coordinates, defeating art paintings", async () => {
    const candidates = await discoverUniversalEntities("Tate Modern");
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.title).toBe("Tate Modern");
    expect(top.typePath).toBe("/place");
    expect(top.coreType).toBe("PLACE");

    const place = await resolvePlace("Tate Modern");
    expect(place).not.toBeNull();
    expect(place?.title).toBe("Tate Modern");
    expect(place?.typePath).toBe("/place");
    expect(place?.coordinates).toBeDefined();
    expect(place?.coordinates?.latitude).toBeCloseTo(51.5078, 1);
    expect(place?.googleMapsUrl).toContain("maps");
  });

  it("resolves Café de Flore as a Place venue with coordinates and Parisian neighborhood", async () => {
    const candidates = await discoverUniversalEntities("Café de Flore");
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.title).toBe("Café de Flore");
    expect(top.typePath).toBe("/place");

    const place = await resolvePlace("Café de Flore");
    expect(place).not.toBeNull();
    expect(place?.title).toBe("Café de Flore");
    expect(place?.coordinates).toBeDefined();
    expect(place?.coordinates?.latitude).toBeCloseTo(48.8541, 1);
  });

  it("resolves Virginia Woolf as an Author creator profile", async () => {
    const candidates = await discoverUniversalEntities("Virginia Woolf");
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.title).toBe("Virginia Woolf");
    expect(top.typePath).toBe("/person/author");
    expect(top.badgeLabel).toBe("AUTHOR");

    const creator = await resolveCreator("Virginia Woolf");
    expect(creator).not.toBeNull();
    expect(creator?.name).toBe("Virginia Woolf");
    expect(creator?.role).toBe("AUTHOR");
    expect(creator?.birthYear).toBe(1882);
    expect(creator?.deathYear).toBe(1941);
    expect(creator?.nationality).toBe("English");
    expect(creator?.portraitUrl).toBeTruthy();
  });

  it("resolves Stanley Kubrick as a Film Director creator profile", async () => {
    const candidates = await discoverUniversalEntities("Stanley Kubrick");
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.title).toBe("Stanley Kubrick");
    expect(top.typePath).toBe("/person/director");
    expect(top.badgeLabel).toBe("DIRECTOR");

    const creator = await resolveCreator("Stanley Kubrick");
    expect(creator).not.toBeNull();
    expect(creator?.name).toBe("Stanley Kubrick");
    expect(creator?.role).toBe("DIRECTOR");
    expect(creator?.birthYear).toBe(1928);
    expect(creator?.deathYear).toBe(1999);
    expect(creator?.portraitUrl).toBeTruthy();
  });

  it("parses airline boarding passes and high-speed rail tickets into structured transit pass", () => {
    const flight = parseTransitPass("Flight IB3166 MAD -> BCN seat 14B gate B22 terminal T4 PNR: XY789Z");
    expect(flight).not.toBeNull();
    expect(flight?.code).toBe("IB 3166");
    expect(flight?.operator).toBe("Iberia");
    expect(flight?.origin).toBe("MAD");
    expect(flight?.destination).toBe("BCN");
    expect(flight?.seat).toBe("14B");
    expect(flight?.gate).toBe("B22");
    expect(flight?.terminal).toBe("T4");
    expect(flight?.bookingRef).toBe("XY789Z");
    expect(flight?.mode).toBe("flight");

    const train = parseTransitPass("Train AVE 2142 Madrid -> Barcelona seat 05A");
    expect(train).not.toBeNull();
    expect(train?.code).toBe("AVE 2142");
    expect(train?.operator).toBe("AVE");
    expect(train?.origin).toBe("MADRID");
    expect(train?.destination).toBe("BARCELONA");
    expect(train?.seat).toBe("05A");
    expect(train?.mode).toBe("train");
  });

  it("dispatcher hydrates place, creator, travel, and checklist inputs cleanly", async () => {
    const placePayload = await enrichCaptureInput("Tate Modern");
    expect(placePayload.coreType).toBe("PLACE");
    expect(placePayload.typePath).toBe("/place");

    const creatorPayload = await enrichCaptureInput("Virginia Woolf");
    expect(creatorPayload.coreType).toBe("CREATOR");
    expect(creatorPayload.typePath).toBe("/person/author");

    const flightPayload = await enrichCaptureInput("IB3166 MAD to BCN");
    expect(flightPayload.coreType).toBe("TRAVEL");
    expect(flightPayload.typePath).toBe("/travel/transit");
    expect(flightPayload.coreStructuredData.code).toBe("IB 3166");

    const listPayload = await enrichCaptureInput("- [ ] Buy sourdough bread\n- [x] Pick up vinyl\n- [ ] Book dinner");
    expect(listPayload.typePath).toBe("/memo/list");
    expect(listPayload.coreStructuredData.items.length).toBe(3);
    expect(listPayload.coreStructuredData.items[1].completed).toBe(true);
  });
});
