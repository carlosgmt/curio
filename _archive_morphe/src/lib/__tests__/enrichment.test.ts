import { describe, it, expect } from "bun:test";
import { autoEnrich, enrichBook, enrichMedia, enrichPlace } from "../enrichment";

describe("autoEnrich service", () => {
  it("enriches books with cover and author", async () => {
    const res = await enrichBook("Norwegian Wood");
    expect(res).not.toBeNull();
    expect(res?.coverUrl).toBeDefined();
    expect(res?.coverUrl).toContain("covers.openlibrary.org");
  });

  it("enriches media with poster artwork", async () => {
    const res = await enrichMedia("Interstellar");
    expect(res).not.toBeNull();
    expect(res?.artworkUrl).toBeDefined();
    expect(res?.artworkUrl).toContain("mzstatic.com");
  });

  it("enriches places with coordinates and map url", async () => {
    const res = await enrichPlace("Kyoto");
    expect(res).not.toBeNull();
    expect(res?.lat).toBeDefined();
    expect(res?.lon).toBeDefined();
    expect(res?.mapUrl).toContain("openstreetmap.org");
  });

  it("autoEnrich routes by intent", async () => {
    const bookRes = await autoEnrich("book", "Norwegian Wood", "Reading Norwegian Wood");
    expect(bookRes?.coverUrl).toBeDefined();

    const travelRes = await autoEnrich("travel", "Flight to Kyoto", "Trip to Kyoto");
    expect(travelRes?.lat).toBeDefined();
  });
});
