import { describe, it, expect } from "bun:test";
import {
  latLonToTile,
  getTileCoordinates,
  getSurroundingTiles,
  getCartoVoyagerUrl,
  getCartoDarkMatterUrl,
  getOsmUrl,
  parseCoordinates,
} from "./slippyMap";

describe("Slippy Map Tile Coordinate Mathematics", () => {
  it("calculates exact tile coordinates for Tate Modern (London)", () => {
    // Tate Modern: ~ 51.5076° N, 0.0994° W (-0.0994)
    const lat = 51.5076;
    const lon = -0.0994;
    const zoom = 15;

    const tile = latLonToTile(lat, lon, zoom);
    expect(tile.zoom).toBe(15);
    expect(tile.x).toBe(16374);
    expect(tile.y).toBe(10896);
    expect(tile.pixelOffsetX).toBeGreaterThanOrEqual(0);
    expect(tile.pixelOffsetX).toBeLessThanOrEqual(256);
    expect(tile.pixelOffsetY).toBeGreaterThanOrEqual(0);
    expect(tile.pixelOffsetY).toBeLessThanOrEqual(256);

    const alias = getTileCoordinates(lat, lon, zoom);
    expect(alias.x).toBe(tile.x);
    expect(alias.y).toBe(tile.y);
  });

  it("calculates exact tile coordinates for Café de Flore (Paris)", () => {
    // Café de Flore: ~ 48.8541° N, 2.3325° E
    const lat = 48.8541;
    const lon = 2.3325;
    const zoom = 15;

    const tile = latLonToTile(lat, lon, zoom);
    expect(tile.zoom).toBe(15);
    expect(tile.x).toBe(16596);
    expect(tile.y).toBe(11273);
  });

  it("generates valid CartoDB Voyager and Dark Matter tile URLs", () => {
    const voyager = getCartoVoyagerUrl(16374, 10896, 15);
    expect(voyager).toMatch(/^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/rastertiles\/voyager\/15\/16374\/10896\.png$/);

    const dark = getCartoDarkMatterUrl(16374, 10896, 15);
    expect(dark).toMatch(/^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/dark_all\/15\/16374\/10896\.png$/);

    const osm = getOsmUrl(16374, 10896, 15);
    expect(osm).toBe("https://tile.openstreetmap.org/15/16374/10896.png");
  });

  it("generates surrounding tiles covering the requested viewport", () => {
    const tiles = getSurroundingTiles(51.5076, -0.0994, 15, 480, 300);
    expect(tiles.length).toBeGreaterThanOrEqual(6); // At least 3x2 grid

    // Ensure center tile is present
    const centerTile = tiles.find((t) => t.x === 16374 && t.y === 10896);
    expect(centerTile).toBeDefined();
    expect(centerTile?.url).toContain("cartocdn.com");
    expect(centerTile?.darkUrl).toContain("dark_all");
    expect(centerTile?.osmUrl).toContain("openstreetmap.org");
  });

  it("parses coordinates from various formats reliably", () => {
    // Object format
    expect(parseCoordinates({ latitude: 51.5, longitude: -0.1 })).toEqual({
      latitude: 51.5,
      longitude: -0.1,
    });
    expect(parseCoordinates({ lat: 48.8, lng: 2.3 })).toEqual({
      latitude: 48.8,
      longitude: 2.3,
    });

    // Array format
    expect(parseCoordinates([35.68, 139.76])).toEqual({
      latitude: 35.68,
      longitude: 139.76,
    });

    // String format (cardinal)
    expect(parseCoordinates("35.6712° N · 139.6891° E")).toEqual({
      latitude: 35.6712,
      longitude: 139.6891,
    });

    // String format (comma separated)
    expect(parseCoordinates("51.5076, -0.0994")).toEqual({
      latitude: 51.5076,
      longitude: -0.0994,
    });

    // Null/invalid
    expect(parseCoordinates(null)).toBeNull();
    expect(parseCoordinates("invalid")).toBeNull();
  });
});
