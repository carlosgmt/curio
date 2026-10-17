import { describe, expect, it } from "bun:test";
import { parseGoogleKeepTakeout, parseGoogleMapsSavedPlaces } from "./takeout";

describe("Google Takeout Importers (Keep & Maps)", () => {
  describe("Google Keep Takeout Parser & Step-0 Privacy Invariant", () => {
    it("strictly marks notes without URLs as isPrivateMemo=true and LOCAL_ONLY", () => {
      const files = [
        {
          name: "Coffee Notes.json",
          content: JSON.stringify({
            title: "Favorite Pour-over Ratios",
            textContent: "15g coffee to 250g water at 93C. Use V60 with Cafec Abaca filters.",
            labels: [{ name: "Coffee" }, { name: "Recipes" }],
            isPinned: true,
            userEditedTimestampUsec: 1710000000000000,
          }),
        },
        {
          name: "Checklist Note.json",
          content: JSON.stringify({
            title: "Packing List",
            listContent: [
              { text: "Passport", isChecked: true },
              { text: "Sony A7IV", isChecked: false },
            ],
            labels: [{ name: "Travel" }],
            isPinned: false,
          }),
        },
      ];

      const notes = parseGoogleKeepTakeout(files);
      expect(notes.length).toBe(2);

      // Verify Privacy Invariants on both notes
      for (const note of notes) {
        expect(note.isPrivateMemo).toBe(true);
        expect(note.enrichmentStatus).toBe("LOCAL_ONLY");
        expect(note.externalUrl).toBeUndefined();
        expect(note.coreType).toBe("PRIVATE_MEMO");
        expect(note.typePath).toBe("/memo");
      }

      expect(notes[0].title).toBe("Favorite Pour-over Ratios");
      expect(notes[0].tags).toContain("coffee");
      expect(notes[0].tags).toContain("recipes");
      expect(notes[0].tags).toContain("memo");

      expect(notes[1].textContent).toContain("- [x] Passport");
      expect(notes[1].textContent).toContain("- [ ] Sony A7IV");
    });

    it("identifies notes containing external URLs as candidate entity saves", () => {
      const files = [
        {
          name: "Article Link.json",
          content: JSON.stringify({
            title: "Fuglen Coffee Tokyo",
            textContent: "Amazing vintage mid-century Norwegian cafe in Shibuya. Check out https://fuglen.com/tokyo for hours.",
            labels: [{ name: "Tokyo" }],
            isPinned: false,
          }),
        },
      ];

      const notes = parseGoogleKeepTakeout(files);
      expect(notes.length).toBe(1);

      const note = notes[0];
      expect(note.isPrivateMemo).toBe(false);
      expect(note.enrichmentStatus).toBe("OPTIMISTIC");
      expect(note.externalUrl).toBe("https://fuglen.com/tokyo");
      expect(note.coreType).toBe("ARTICLE");
    });
  });

  describe("Google Maps Saved Places Parser", () => {
    it("parses GeoJSON Saved Places into /place structured entities", () => {
      const geojson = JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [139.70055, 35.65912],
            },
            properties: {
              Title: "Bar Trench",
              "Location.Address": "1-5-8 Ebisu-nishi, Shibuya-ku, Tokyo 150-0021, Japan",
              "Google Maps URL": "https://maps.google.com/?cid=1234567890",
              Comment: "Legendary herbal cocktail bar in Ebisu.",
            },
          },
        ],
      });

      const places = parseGoogleMapsSavedPlaces(geojson, "geojson");
      expect(places.length).toBe(1);

      const place = places[0];
      expect(place.title).toBe("Bar Trench");
      expect(place.lat).toBeCloseTo(35.65912, 4);
      expect(place.lng).toBeCloseTo(139.70055, 4);
      expect(place.typePath).toBe("/place");
      expect(place.coreType).toBe("PLACE");
      expect(place.canonicalExternalId).toContain("place:maps:bar-trench");
      expect(place.coreStructuredData.address).toContain("Shibuya-ku");
      expect(place.comment).toBe("Legendary herbal cocktail bar in Ebisu.");
      expect(place.tags).toContain("maps");
      expect(place.tags).toContain("travel");
    });

    it("parses CSV Saved Places exports", () => {
      const csv = `Title,Address,URL,Comment
"Kissa You","4-13-17 Ginza, Chuo-ku, Tokyo","https://maps.google.com/@35.6698,139.7684,17z","Famous for fluffy omurice."`;

      const places = parseGoogleMapsSavedPlaces(csv, "csv");
      expect(places.length).toBe(1);

      const place = places[0];
      expect(place.title).toBe("Kissa You");
      expect(place.lat).toBeCloseTo(35.6698, 3);
      expect(place.lng).toBeCloseTo(139.7684, 3);
      expect(place.typePath).toBe("/place");
      expect(place.coreType).toBe("PLACE");
      expect(place.comment).toBe("Famous for fluffy omurice.");
    });
  });
});
