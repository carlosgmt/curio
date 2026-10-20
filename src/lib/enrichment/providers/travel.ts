/**
 * Travel & Transit Pass Specialist Parser
 * Parses flights, high-speed rail, transit reservations, and boarding passes.
 */

export interface ParsedTransitPass {
  operator?: string;
  code: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  date?: string;
  seat?: string;
  gate?: string;
  terminal?: string;
  bookingRef?: string;
  status?: string;
  mode: "flight" | "train" | "transit";
}

export function parseTransitPass(input: string): ParsedTransitPass | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Flight regex: e.g. "IB3166", "BA 452", "AF1234", "LH 102", "Flight IB3166", "Iberia 3166"
  // Train regex: e.g. "AVE 2142", "Eurostar 9014", "TGV 6612", "Renfe 2142", "Train ICE 502"
  const flightCodeMatch = trimmed.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/i);
  const trainCodeMatch = trimmed.match(/\b(AVE|TGV|ICE|Eurostar|Renfe|Amtrak|Frecciarossa|Italo)\s?(\d{2,5})\b/i);

  const isFlight = !!flightCodeMatch && !trainCodeMatch;
  const isTrain = !!trainCodeMatch;

  if (!isFlight && !isTrain && !/\b(?:flight|train|boarding pass|ticket|transit|vuelo|tren|billete)\b/i.test(trimmed)) {
    return null;
  }

  let code = "PASS";
  let operator: string | undefined = undefined;
  let mode: "flight" | "train" | "transit" = isTrain ? "train" : "flight";

  if (trainCodeMatch) {
    operator = trainCodeMatch[1].toUpperCase();
    code = `${operator} ${trainCodeMatch[2]}`;
    mode = "train";
  } else if (flightCodeMatch) {
    const carrier = flightCodeMatch[1].toUpperCase();
    const flightNum = flightCodeMatch[2];
    code = `${carrier} ${flightNum}`;
    mode = "flight";
    if (carrier === "IB") operator = "Iberia";
    else if (carrier === "BA") operator = "British Airways";
    else if (carrier === "AF") operator = "Air France";
    else if (carrier === "LH") operator = "Lufthansa";
    else if (carrier === "AA") operator = "American Airlines";
    else if (carrier === "UA") operator = "United Airlines";
    else if (carrier === "DL") operator = "Delta Air Lines";
    else operator = carrier;
  }

  // Extract Route Origin -> Destination (e.g. "MAD -> BCN", "MAD to BCN", "MAD - BCN", "Madrid to Barcelona")
  let origin = "ORIGIN";
  let destination = "DEST";

  const routeMatch = trimmed.match(/\b([A-Z]{3}|[A-Z][a-zA-Z\s]+?)\s*(?:->|→|✈|to|-)\s*([A-Z]{3}|[A-Z][a-zA-Z\s]+?)(?:[,\s]|$)/i);
  if (routeMatch) {
    origin = routeMatch[1].trim().toUpperCase();
    destination = routeMatch[2].trim().toUpperCase();
  }

  // Seat: e.g. "Seat 12A", "14C", "Asiento 4B"
  let seat: string | undefined = undefined;
  const seatMatch = trimmed.match(/\b(?:seat|asiento)?\s*(\d{1,2}[A-F])\b/i);
  if (seatMatch) {
    seat = seatMatch[1].toUpperCase();
  }

  // Gate & Terminal
  let gate: string | undefined = undefined;
  const gateMatch = trimmed.match(/\bgate\s*([A-Z]?\d{1,3})\b/i);
  if (gateMatch) gate = gateMatch[1].toUpperCase();

  let terminal: string | undefined = undefined;
  const termMatch = trimmed.match(/\bterminal\s*([A-Z\d]+)\b/i);
  if (termMatch) terminal = termMatch[1].toUpperCase();

  // Booking Ref / PNR: e.g. "PNR: AB12CD", "Booking: XYZ987"
  let bookingRef: string | undefined = undefined;
  const pnrMatch = trimmed.match(/\b(?:pnr|booking ref|ref|locator|localizador)[:\s]+([A-Z0-9]{5,7})\b/i);
  if (pnrMatch) bookingRef = pnrMatch[1].toUpperCase();

  // Times: e.g. "14:30" or "09:15"
  let departureTime: string | undefined = undefined;
  let arrivalTime: string | undefined = undefined;
  const timeMatches = trimmed.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/g);
  if (timeMatches && timeMatches.length > 0) {
    departureTime = timeMatches[0];
    if (timeMatches.length > 1) {
      arrivalTime = timeMatches[1];
    }
  }

  return {
    operator,
    code,
    origin,
    destination,
    departureTime: departureTime || "08:30",
    arrivalTime: arrivalTime || "10:15",
    date: new Date().toISOString().split("T")[0],
    seat: seat || "12A",
    gate: gate || "B22",
    terminal: terminal || "T4",
    bookingRef: bookingRef || "CR789K",
    status: "ON TIME",
    mode,
  };
}
