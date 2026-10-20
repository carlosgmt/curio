/**
 * Slippy Map Tile Coordinate Mathematics & Open Tile Provider URLs
 * Zero-API-key, zero-cost static map rendering for cultural places & venues.
 */

export interface TileCoord {
  x: number;
  y: number;
  exactX: number;
  exactY: number;
  pixelOffsetX: number;
  pixelOffsetY: number;
  zoom: number;
}

export interface SurroundingTile {
  key: string;
  x: number;
  y: number;
  zoom: number;
  url: string;
  darkUrl: string;
  osmUrl: string;
  left: number;
  top: number;
  offsetFromCenterX: number;
  offsetFromCenterY: number;
}

/**
 * Clamps latitude to Web Mercator projection bounds (~ -85.0511 to 85.0511 degrees).
 */
export function clampLat(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

/**
 * Normalizes longitude to [-180, 180).
 */
export function normalizeLon(lon: number): number {
  let l = lon % 360;
  if (l >= 180) l -= 360;
  if (l < -180) l += 360;
  return l;
}

/**
 * Calculates slippy map tile coordinates for a given (latitude, longitude) at a zoom level.
 */
export function latLonToTile(lat: number, lon: number, zoom: number): TileCoord {
  const cLat = clampLat(lat);
  const cLon = normalizeLon(lon);
  const n = Math.pow(2, zoom);

  const exactX = ((cLon + 180) / 360) * n;
  const latRad = (cLat * Math.PI) / 180;
  const exactY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(exactX);
  const y = Math.floor(exactY);
  const pixelOffsetX = Math.round((exactX - x) * 256);
  const pixelOffsetY = Math.round((exactY - y) * 256);

  return {
    x,
    y,
    exactX,
    exactY,
    pixelOffsetX,
    pixelOffsetY,
    zoom,
  };
}

/**
 * Alias for latLonToTile
 */
export const getTileCoordinates = latLonToTile;

/**
 * CartoDB Voyager raster tile URL (Light Mode editorial styling)
 */
export function getCartoVoyagerUrl(
  x: number,
  y: number,
  zoom: number,
  retina = false
): string {
  const sub = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
  return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}${retina ? "@2x" : ""}.png`;
}

/**
 * CartoDB Dark Matter raster tile URL (Dark Mode high-contrast styling)
 */
export function getCartoDarkMatterUrl(
  x: number,
  y: number,
  zoom: number,
  retina = false
): string {
  const sub = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
  return `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}${retina ? "@2x" : ""}.png`;
}

/**
 * OpenStreetMap public raster tile fallback
 */
export function getOsmUrl(x: number, y: number, zoom: number): string {
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

/**
 * Returns surrounding tile descriptors to fill a viewport centered on (lat, lon).
 * Container dimensions default to 480x300 (standard 16:10 place card preview).
 */
export function getSurroundingTiles(
  lat: number,
  lon: number,
  zoom: number = 15,
  width: number = 480,
  height: number = 300
): SurroundingTile[] {
  const coord = latLonToTile(lat, lon, zoom);
  const worldCenterX = coord.exactX * 256;
  const worldCenterY = coord.exactY * 256;

  const halfW = width / 2;
  const halfH = height / 2;

  // Add a 32px safety margin so edges are seamlessly covered during responsive scaling
  const margin = 32;
  const minTileX = Math.floor((worldCenterX - halfW - margin) / 256);
  const maxTileX = Math.floor((worldCenterX + halfW + margin) / 256);
  const minTileY = Math.floor((worldCenterY - halfH - margin) / 256);
  const maxTileY = Math.floor((worldCenterY + halfH + margin) / 256);

  const tiles: SurroundingTile[] = [];

  for (let y = minTileY; y <= maxTileY; y++) {
    for (let x = minTileX; x <= maxTileX; x++) {
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        x,
        y,
        zoom,
        url: getCartoVoyagerUrl(x, y, zoom),
        darkUrl: getCartoDarkMatterUrl(x, y, zoom),
        osmUrl: getOsmUrl(x, y, zoom),
        left: Math.round(x * 256 - (worldCenterX - halfW)),
        top: Math.round(y * 256 - (worldCenterY - halfH)),
        offsetFromCenterX: Math.round((x - coord.exactX) * 256),
        offsetFromCenterY: Math.round((y - coord.exactY) * 256),
      });
    }
  }

  return tiles;
}

/**
 * Robustly parses latitude and longitude from diverse formats:
 * - { latitude, longitude } or { lat, lon / lng }
 * - [lat, lon]
 * - "51.5078, -0.0994"
 * - "35.6712° N · 139.6891° E"
 */
export function parseCoordinates(
  input: unknown
): { latitude: number; longitude: number } | null {
  if (!input) return null;

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const lat =
      typeof obj.latitude === "number"
        ? obj.latitude
        : typeof obj.lat === "number"
        ? obj.lat
        : null;
    const lon =
      typeof obj.longitude === "number"
        ? obj.longitude
        : typeof obj.lon === "number"
        ? obj.lon
        : typeof obj.lng === "number"
        ? obj.lng
        : null;

    if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }

  if (Array.isArray(input) && input.length >= 2) {
    const lat = Number(input[0]);
    const lon = Number(input[1]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }

  if (typeof input === "string") {
    // Check for "35.6712° N · 139.6891° E" format
    const cardinalMatch = input.match(
      /([0-9.]+)\s*°?\s*([NSns])\s*[·,]\s*([0-9.]+)\s*°?\s*([EWew])/
    );
    if (cardinalMatch) {
      let lat = parseFloat(cardinalMatch[1]);
      if (cardinalMatch[2].toUpperCase() === "S") lat = -lat;
      let lon = parseFloat(cardinalMatch[3]);
      if (cardinalMatch[4].toUpperCase() === "W") lon = -lon;
      return { latitude: lat, longitude: lon };
    }

    // Check for comma separated "51.5078, -0.0994"
    const parts = input.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { latitude: parts[0], longitude: parts[1] };
    }
  }

  return null;
}
