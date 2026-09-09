/**
 * Server-only helpers for the NDMA / Sachet public alert stream.
 * Parsing, keyword filtering, district+state extraction, geocoding,
 * Haversine distance and hazard-specific supply deduction rules.
 */

export const HAZARD_KEYWORDS = [
  "Flood",
  "Cyclone",
  "Earthquake",
  "Landslide",
  "Cloudburst",
  "Heavy Rain",
] as const;

export type HazardKeyword = (typeof HAZARD_KEYWORDS)[number];

export const FEED_URLS = [
  "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml",
  "https://ndma.gov.in/rss.xml",
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface RawItem {
  title: string;
  description: string;
  pubDate: string;
}

export interface ParsedAlert extends RawItem {
  hazard: HazardKeyword;
  district: string | null;
  state: string | null;
}

export interface GeocodedAlert extends ParsedAlert {
  lat: number | null;
  lng: number | null;
  geocodeSource: "nominatim" | "state-capital" | "unresolved";
  severity: "Low" | "Moderate" | "High" | "Extreme";
  hash: string;
}

/* ------------------------------------------------------------------ fetch */

export async function fetchFeedXml(timeoutMs = 12000): Promise<string> {
  let lastError: unknown;
  for (const url of FEED_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new Error(`Feed ${url} responded ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (text.includes("<item")) return text;
      lastError = new Error(`Feed ${url} returned no items`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("NDMA feed unreachable");
}

/* ------------------------------------------------------------------ parse */

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1] ?? "") : "";
}

export function parseItems(xml: string): RawItem[] {
  const items: RawItem[] = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1] ?? "";
    const title = tag(block, "title");
    if (!title) continue;
    items.push({
      title,
      description: tag(block, "description"),
      pubDate: tag(block, "pubDate") || tag(block, "updated") || tag(block, "dc:date"),
    });
  }
  return items;
}

/* -------------------------------------------------- keywords & locations */

export function matchHazard(text: string): HazardKeyword | null {
  const haystack = text.toLowerCase();
  for (const keyword of HAZARD_KEYWORDS) {
    if (haystack.includes(keyword.toLowerCase())) return keyword;
  }
  return null;
}

export const INDIAN_STATES: Record<string, [number, number]> = {
  "Andhra Pradesh": [16.5062, 80.648],
  "Arunachal Pradesh": [27.0844, 93.6053],
  Assam: [26.1445, 91.7362],
  Bihar: [25.5941, 85.1376],
  Chhattisgarh: [21.2514, 81.6296],
  Goa: [15.4909, 73.8278],
  Gujarat: [23.2156, 72.6369],
  Haryana: [30.7333, 76.7794],
  "Himachal Pradesh": [31.1048, 77.1734],
  Jharkhand: [23.3441, 85.3096],
  Karnataka: [12.9716, 77.5946],
  Kerala: [8.5241, 76.9366],
  "Madhya Pradesh": [23.2599, 77.4126],
  Maharashtra: [19.076, 72.8777],
  Manipur: [24.817, 93.9368],
  Meghalaya: [25.5788, 91.8933],
  Mizoram: [23.7271, 92.7176],
  Nagaland: [25.6751, 94.1086],
  Odisha: [20.2961, 85.8245],
  Punjab: [30.7333, 76.7794],
  Rajasthan: [26.9124, 75.7873],
  Sikkim: [27.533, 88.5122],
  "Tamil Nadu": [13.0827, 80.2707],
  Telangana: [17.385, 78.4867],
  Tripura: [23.8315, 91.2868],
  "Uttar Pradesh": [26.8467, 80.9462],
  Uttarakhand: [30.3165, 78.0322],
  "West Bengal": [22.5726, 88.3639],
  Delhi: [28.6139, 77.209],
  "Jammu and Kashmir": [34.0837, 74.7973],
  Ladakh: [34.1526, 77.5771],
  Puducherry: [11.9416, 79.8083],
  Chandigarh: [30.7333, 76.7794],
  "Andaman and Nicobar Islands": [11.6234, 92.7265],
};

const STATE_NAMES = Object.keys(INDIAN_STATES);

/**
 * Pulls "[District], [State]" out of the alert headline. Handles the common
 * NDMA/Sachet phrasings: "issued for X, Y", "for X district of Y",
 * "warning in X (Y)" and bare "..., State" suffixes.
 */
export function extractLocation(title: string): { district: string | null; state: string | null } {
  const cleaned = title.replace(/\s+/g, " ").trim();

  const patterns: RegExp[] = [
    /(?:issued\s+for|warning\s+for|alert\s+for|advisory\s+for|for)\s+([A-Za-z][A-Za-z .'-]{2,40}?)\s*,\s*([A-Za-z][A-Za-z .'-]{2,40})/i,
    /([A-Za-z][A-Za-z .'-]{2,40}?)\s+district\s+(?:of|in)\s+([A-Za-z][A-Za-z .'-]{2,40})/i,
    /(?:in|at|over)\s+([A-Za-z][A-Za-z .'-]{2,40}?)\s*\(\s*([A-Za-z][A-Za-z .'-]{2,40})\s*\)/i,
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m) {
      const district = lastPlaceName(m[1]);
      const state = resolveState(tidy(m[2]));
      if (district && state) return { district, state };
    }
  }

  // Fall back to any state name mentioned anywhere in the headline.
  const state = STATE_NAMES.find((s) => new RegExp(`\\b${s}\\b`, "i").test(cleaned)) ?? null;
  if (state) {
    const before = cleaned.split(new RegExp(`\\b${state}\\b`, "i"))[0] ?? "";
    const districtMatch = before.match(/([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+)?)\s+district\b/);
    if (districtMatch) return { district: tidy(districtMatch[1]), state };
    const tailMatch = before.match(/([A-Za-z][A-Za-z .'-]{2,30})[,\s]+$/);
    return { district: lastPlaceName(tailMatch?.[1] ?? null), state };
  }


  return { district: null, state: null };
}

function tidy(value: string | undefined): string | null {
  if (!value) return null;
  const out = value
    .replace(/\b(district|districts|region|area|areas|state)\b/gi, "")
    .replace(/[^A-Za-z .'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return out.length >= 3 ? out : null;
}

function resolveState(candidate: string | null): string | null {
  if (!candidate) return null;
  return STATE_NAMES.find((s) => s.toLowerCase() === candidate.toLowerCase()) ?? null;
}

/* -------------------------------------------------------------- geocoding */

export async function geocode(
  district: string | null,
  state: string | null,
): Promise<{ lat: number; lng: number; source: "nominatim" | "state-capital" } | null> {
  const query = [district, state, "India"].filter(Boolean).join(", ");
  if (district && state) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
        const first = rows[0];
        if (first) {
          const lat = Number(first.lat);
          const lng = Number(first.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng, source: "nominatim" };
          }
        }
      }
    } catch {
      // fall through to the state-capital centroid
    }
  }

  const stateKey = resolveState(state);
  if (stateKey) {
    const [lat, lng] = INDIAN_STATES[stateKey]!;
    return { lat, lng, source: "state-capital" };
  }
  return null;
}

/* -------------------------------------------------------------- severity */

export function severityFor(hazard: HazardKeyword, text: string): "Low" | "Moderate" | "High" | "Extreme" {
  const t = text.toLowerCase();
  if (/\b(red alert|extreme|severe|very heavy|exceptionally heavy)\b/.test(t)) return "Extreme";
  if (/\b(orange alert|high|warning)\b/.test(t)) return "High";
  if (/\b(yellow alert|watch|moderate)\b/.test(t)) return "Moderate";
  return hazard === "Heavy Rain" ? "Moderate" : "High";
}

/* -------------------------------------------------------------- hashing */

export async function makeHash(pubDate: string, title: string): Promise<string> {
  const data = new TextEncoder().encode(`${pubDate}::${title}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ------------------------------------------------------------- distance */

export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export interface WarehouseRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  food: number;
  water: number;
  medicine: number;
  shelter: number;
  boats: number;
  purification_tablets: number;
}

export function nearestOperational(
  point: [number, number],
  warehouses: WarehouseRow[],
): { warehouse: WarehouseRow; distanceKm: number } | null {
  const candidates = warehouses.filter((w) => w.status !== "offline");
  let best: { warehouse: WarehouseRow; distanceKm: number } | null = null;
  for (const w of candidates) {
    const distanceKm = haversineKm(point, [w.lat, w.lng]);
    if (!best || distanceKm < best.distanceKm) best = { warehouse: w, distanceKm };
  }
  return best;
}

/* ------------------------------------------------ supply deduction rules */

export type SupplyItem = "food" | "water" | "medicine" | "shelter" | "boats" | "purification_tablets";

const SEVERITY_FACTOR: Record<string, number> = { Low: 0.4, Moderate: 0.7, High: 1, Extreme: 1.6 };

const BASE_DEDUCTION: Record<HazardKeyword, Partial<Record<SupplyItem, number>>> = {
  Flood: { boats: 6, purification_tablets: 4000, food: 1500, water: 5000, shelter: 800 },
  Cyclone: { shelter: 1200, food: 1800, water: 6000, medicine: 400 },
  Earthquake: { medicine: 900, shelter: 1000, food: 1200, water: 4000 },
  Landslide: { medicine: 500, food: 800, water: 2500, shelter: 400 },
  Cloudburst: { boats: 3, purification_tablets: 2500, water: 3000, food: 700 },
  "Heavy Rain": { purification_tablets: 1500, water: 2000, food: 400 },
};

export function deductionPayload(
  hazard: HazardKeyword,
  severity: string,
): Array<{ item: SupplyItem; quantity: number }> {
  const factor = SEVERITY_FACTOR[severity] ?? 1;
  return Object.entries(BASE_DEDUCTION[hazard]).map(([item, qty]) => ({
    item: item as SupplyItem,
    quantity: Math.max(1, Math.round((qty as number) * factor)),
  }));
}
