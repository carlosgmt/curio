import { describe, expect, it } from "bun:test";
import { extractStructuredCardData } from "./extraction";

describe("Card Fill-in & Token Extraction Engine", () => {
  it("extracts ratings across various notations (stars, ★, /10, /5)", () => {
    const res1 = extractStructuredCardData({ input: "Past Lives 5 stars masterpiece" });
    expect(res1.rating).toBe(5);
    expect(res1.subjectiveValues.rating).toBe(5);

    const res2 = extractStructuredCardData({ input: "Dune Part Two 4.5★ visual spectacle" });
    expect(res2.rating).toBe(4.5);
    expect(res2.subjectiveValues.rating).toBe(4.5);

    const res3 = extractStructuredCardData({ input: "Barolo 9/10 rating" });
    expect(res3.rating).toBe(4.5);

    const res4 = extractStructuredCardData({ input: "Ferrante novel 5/5 brilliant" });
    expect(res4.rating).toBe(5);
  });

  it("extracts relative dates (today, yesterday) and ISO dates", () => {
    const today = new Date().toISOString().slice(0, 10);
    const resToday = extractStructuredCardData({ input: "Met chef today at sourdough workshop" });
    expect(resToday.date).toBe(today);

    const resIso = extractStructuredCardData({ input: "Purchased on 2026-10-15 in Milan" });
    expect(resIso.date).toBe("2026-10-15");
  });

  it("extracts multi-currency prices and converts to integer cents", () => {
    const resUsd = extractStructuredCardData({ input: "Vinyl album $29.99 at Amoeba" });
    expect(resUsd.price).toEqual({
      amount: 29.99,
      currency: "USD",
      cents: 2999,
    });

    const resEur = extractStructuredCardData({ input: "Natural wine bottle €45.00" });
    expect(resEur.price).toEqual({
      amount: 45,
      currency: "EUR",
      cents: 4500,
    });
  });

  it("extracts hashtags cleanly", () => {
    const res = extractStructuredCardData({ input: "Radikon Jakot 2019 #naturalwine #orange #friuli" });
    expect(res.tags).toEqual(["#naturalwine", "#orange", "#friuli"]);
  });

  it("extracts schema-directed fields for wine (ABV, vintage)", () => {
    const res = extractStructuredCardData({
      input: "Chateau Simone Rouge 2018 vintage 13.5% ABV",
      typePath: "/product/beverage/wine",
    });
    expect(res.objectiveAttributes.abv).toBe(13.5);
    expect(res.objectiveAttributes.vintage).toBe("2018");
  });

  it("extracts custom archetype domain fields (kiln temp, slip rating) with strict partitioning", () => {
    const res = extractStructuredCardData({
      input: "Zellige Handcrafted Tile kiln temp: 1220C slip rating: R11 finish: glazed 5 stars #ceramics",
      typePath: "/product/home_materials/ceramic_tile",
      uiFieldConfig: [
        { key: "kilnTemperature", label: "Kiln Temp", primitive: "integer", isPublicObjective: true },
        { key: "slipRating", label: "Slip Rating", primitive: "string", isPublicObjective: true },
        { key: "finish", label: "Finish", primitive: "string", isPublicObjective: true },
      ],
    });

    // Objective attributes (eligible for global promotion)
    expect(res.objectiveAttributes.kilnTemperature).toBe(1220);
    expect(res.objectiveAttributes.slipRating).toBe("R11");
    expect(res.objectiveAttributes.finish).toBe("glazed");

    // Subjective attributes (isolated to user save)
    expect(res.rating).toBe(5);
    expect(res.subjectiveValues.rating).toBe(5);
    expect(res.tags).toContain("#ceramics");
  });

  it("extracts recipe culinary fields (prep time)", () => {
    const res = extractStructuredCardData({
      input: "Cacio e Pepe prep time: 15 mins cook time: 10 mins yieldServings: 2",
      typePath: "/culinary/recipe",
    });
    expect(res.objectiveAttributes.prepTimeMinutes).toBe(15);
  });
});
