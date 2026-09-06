export type DisasterType = "flood" | "cyclone" | "earthquake" | "landslide";
export type Severity = "Low" | "Moderate" | "High" | "Extreme";

export const DISASTER_LABEL: Record<DisasterType, string> = {
  flood: "Flood",
  cyclone: "Cyclone",
  earthquake: "Earthquake",
  landslide: "Landslide",
};

export const SEVERITY_VAR: Record<Severity, string> = {
  Low: "var(--sev-low)",
  Moderate: "var(--sev-moderate)",
  High: "var(--sev-high)",
  Extreme: "var(--sev-extreme)",
};

export interface Reading {
  label: string;
  value: string;
  unit?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: "system" | "operator" | "model";
  decisionSource: "rule-engine" | "ML" | "DDPI";
  details: string;
}

export interface Zone {
  id: string;
  name: string;
  district: string;
  type: DisasterType;
  coords: [number, number];
  detectedAt: string;
  severity: Severity;
  score: number; // 0-1 normalised severity
  confidence: number; // 0-1
  affected: number;
  ddpi: number; // 0-100 priority
  source: string;
  mode: "LIVE" | "SIMULATION";
  readings: Reading[];
  demand: { food: number; water: number; medicine: number; shelter: number };
  insight: string;
  insightSource: "rule-engine" | "ML" | "DDPI";
  audit: AuditEntry[];
}

export interface Warehouse {
  id: string;
  name: string;
  coords: [number, number];
  status: "operational" | "constrained" | "offline";
  capacity: number;
  inventory: { food: number; water: number; medicine: number; shelter: number };
  vehicles: number;
  lastUpdated: string;
}

export interface HazardZone {
  id: string;
  disasterType: DisasterType;
  name: string;
  historicalRiskScore: number;
  source: string;
  lastValidated: string;
  geometry: [number, number][];
}

export interface Allocation {
  id: string;
  zoneId: string;
  zone: string;
  warehouseId: string;
  warehouse: string;
  resources: { food: number; water: number; medicine: number; shelter: number };
  priority: number;
  distanceKm: number;
  etaMin: number;
  route: [number, number][];
  vehicle: string;
}

export const zones: Zone[] = [
  {
    id: "ZN-114",
    name: "Kendrapara East Belt",
    district: "Kendrapara, Odisha",
    type: "flood",
    coords: [20.5, 86.42],
    detectedAt: "2026-09-06T04:10:00Z",
    severity: "Extreme",
    score: 0.93,
    confidence: 0.91,
    affected: 148200,
    ddpi: 96,
    source: "IMD gauge network / CWC river telemetry",
    mode: "LIVE",
    readings: [
      { label: "Rainfall (24h)", value: "318.4", unit: "mm" },
      { label: "River level", value: "9.62", unit: "m" },
      { label: "Danger mark", value: "8.40", unit: "m" },
      { label: "Flooded area", value: "412.7", unit: "km²" },
      { label: "Mean elevation", value: "6", unit: "m" },
      { label: "Distance to river", value: "1.2", unit: "km" },
    ],
    demand: { food: 44460, water: 148200, medicine: 14820, shelter: 29640 },
    insight:
      "Divert stock from Cuttack Central before Bhadrak — Bhadrak's approach road is submerged and adds 71 minutes to every run. Shelter kits are the binding shortage, not food.",
    insightSource: "DDPI",
    audit: [
      {
        timestamp: "2026-09-06T04:10:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "River level crossed danger mark at Jajpur gauge (+1.22 m).",
      },
      {
        timestamp: "2026-09-06T04:12:40Z",
        action: "Severity predicted",
        actor: "model",
        decisionSource: "ML",
        details: "XGBoost flood model → Extreme (score 0.93, confidence 0.91), 41 ms inference.",
      },
      {
        timestamp: "2026-09-06T04:13:02Z",
        action: "Demand forecast",
        actor: "model",
        decisionSource: "ML",
        details: "Affected population 148,200 → 44,460 food / 148,200 water units.",
      },
      {
        timestamp: "2026-09-06T04:13:20Z",
        action: "Priority assigned",
        actor: "model",
        decisionSource: "DDPI",
        details: "DDPI 96 / 100 — rank 1 of 6 active zones.",
      },
      {
        timestamp: "2026-09-06T04:19:55Z",
        action: "Allocation confirmed",
        actor: "operator",
        decisionSource: "rule-engine",
        details: "Operator A. Rane accepted OR-Tools plan ALC-2201 without modification.",
      },
    ],
  },
  {
    id: "ZN-107",
    name: "Balasore Coastal Strip",
    district: "Balasore, Odisha",
    type: "cyclone",
    coords: [21.49, 86.94],
    detectedAt: "2026-09-06T02:35:00Z",
    severity: "High",
    score: 0.78,
    confidence: 0.86,
    affected: 92400,
    ddpi: 84,
    source: "IMD cyclone bulletin / scatterometer",
    mode: "LIVE",
    readings: [
      { label: "Max wind", value: "142", unit: "km/h" },
      { label: "Central pressure", value: "968", unit: "hPa" },
      { label: "Category", value: "Severe cyclonic storm" },
      { label: "Rainfall (24h)", value: "196.0", unit: "mm" },
      { label: "Distance to coast", value: "4.8", unit: "km" },
    ],
    demand: { food: 27720, water: 92400, medicine: 9240, shelter: 23100 },
    insight:
      "Pre-position shelter kits now: landfall window is 6–9 h out and the coastal road closes at sustained winds above 90 km/h.",
    insightSource: "ML",
    audit: [
      {
        timestamp: "2026-09-06T02:35:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "IMD bulletin upgrade to severe cyclonic storm.",
      },
      {
        timestamp: "2026-09-06T02:37:11Z",
        action: "Severity predicted",
        actor: "model",
        decisionSource: "ML",
        details: "LightGBM cyclone model → High (score 0.78, confidence 0.86).",
      },
      {
        timestamp: "2026-09-06T02:40:02Z",
        action: "Priority assigned",
        actor: "model",
        decisionSource: "DDPI",
        details: "DDPI 84 / 100 — rank 2 of 6 active zones.",
      },
    ],
  },
  {
    id: "ZN-131",
    name: "Chamoli Upper Slopes",
    district: "Chamoli, Uttarakhand",
    type: "landslide",
    coords: [30.41, 79.32],
    detectedAt: "2026-09-06T06:02:00Z",
    severity: "High",
    score: 0.71,
    confidence: 0.79,
    affected: 18600,
    ddpi: 77,
    source: "GSI slope network / rain gauges",
    mode: "LIVE",
    readings: [
      { label: "Rainfall (72h)", value: "244.0", unit: "mm" },
      { label: "Slope", value: "38", unit: "°" },
      { label: "Elevation", value: "1,840", unit: "m" },
      { label: "Soil saturation", value: "0.88", unit: "idx" },
      { label: "Road proximity", value: "0.4", unit: "km" },
    ],
    demand: { food: 5580, water: 18600, medicine: 2790, shelter: 4650 },
    insight:
      "Access is the constraint, not stock. Only NH-7 remains passable — route all vehicles via Rishikesh depot and expect single-lane convoy timing.",
    insightSource: "DDPI",
    audit: [
      {
        timestamp: "2026-09-06T06:02:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "72-hour rainfall threshold exceeded on saturated slope class.",
      },
      {
        timestamp: "2026-09-06T06:04:31Z",
        action: "Severity predicted",
        actor: "model",
        decisionSource: "ML",
        details: "Random Forest landslide model → High (score 0.71, confidence 0.79).",
      },
    ],
  },
  {
    id: "ZN-088",
    name: "Bhuj Fault Margin",
    district: "Kutch, Gujarat",
    type: "earthquake",
    coords: [23.24, 69.67],
    detectedAt: "2026-09-05T21:48:00Z",
    severity: "Moderate",
    score: 0.52,
    confidence: 0.74,
    affected: 41300,
    ddpi: 61,
    source: "NCS seismograph array",
    mode: "LIVE",
    readings: [
      { label: "Magnitude", value: "5.4", unit: "Mw" },
      { label: "Depth", value: "12.0", unit: "km" },
      { label: "Epicentre", value: "23.24 N, 69.67 E" },
      { label: "Building vulnerability", value: "0.61", unit: "idx" },
      { label: "Aftershocks (6h)", value: "7" },
    ],
    demand: { food: 12390, water: 41300, medicine: 6195, shelter: 8260 },
    insight:
      "Medicine demand is disproportionate to population here — masonry stock in this belt drives crush-injury rates above the regional mean.",
    insightSource: "ML",
    audit: [
      {
        timestamp: "2026-09-05T21:48:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "NCS automatic solution Mw 5.4 at 12 km depth.",
      },
      {
        timestamp: "2026-09-05T21:49:12Z",
        action: "Severity predicted",
        actor: "model",
        decisionSource: "ML",
        details: "XGBoost seismic model → Moderate (score 0.52, confidence 0.74).",
      },
    ],
  },
  {
    id: "ZN-142",
    name: "Sundarbans Delta Fringe",
    district: "South 24 Parganas, West Bengal",
    type: "flood",
    coords: [21.94, 88.72],
    detectedAt: "2026-09-06T05:20:00Z",
    severity: "Moderate",
    score: 0.48,
    confidence: 0.81,
    affected: 33700,
    ddpi: 58,
    source: "CWC tidal gauge",
    mode: "LIVE",
    readings: [
      { label: "Rainfall (24h)", value: "121.5", unit: "mm" },
      { label: "Tidal surge", value: "1.9", unit: "m" },
      { label: "Flooded area", value: "88.2", unit: "km²" },
      { label: "Mean elevation", value: "3", unit: "m" },
    ],
    demand: { food: 10110, water: 33700, medicine: 3370, shelter: 6740 },
    insight:
      "Hold allocation for one cycle — surge is receding and Kolkata depot stock is better spent on Kendrapara this shift.",
    insightSource: "DDPI",
    audit: [
      {
        timestamp: "2026-09-06T05:20:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "Tidal surge above seasonal threshold at Canning gauge.",
      },
    ],
  },
  {
    id: "ZN-095",
    name: "Wayanad Ghats",
    district: "Wayanad, Kerala",
    type: "landslide",
    coords: [11.68, 76.13],
    detectedAt: "2026-09-06T03:05:00Z",
    severity: "Low",
    score: 0.24,
    confidence: 0.69,
    affected: 6400,
    ddpi: 32,
    source: "State rain gauge network",
    mode: "LIVE",
    readings: [
      { label: "Rainfall (72h)", value: "96.4", unit: "mm" },
      { label: "Slope", value: "27", unit: "°" },
      { label: "Soil saturation", value: "0.44", unit: "idx" },
    ],
    demand: { food: 1920, water: 6400, medicine: 960, shelter: 1280 },
    insight: "Monitoring only. No allocation recommended at current DDPI rank.",
    insightSource: "rule-engine",
    audit: [
      {
        timestamp: "2026-09-06T03:05:00Z",
        action: "Event detected",
        actor: "system",
        decisionSource: "rule-engine",
        details: "Watch-level rainfall on moderate slope class.",
      },
    ],
  },
];

export const warehouses: Warehouse[] = [
  {
    id: "WH-01",
    name: "Cuttack Central Depot",
    coords: [20.46, 85.88],
    status: "operational",
    capacity: 120000,
    inventory: { food: 38200, water: 96500, medicine: 11400, shelter: 15200 },
    vehicles: 24,
    lastUpdated: "2026-09-06T09:40:00Z",
  },
  {
    id: "WH-02",
    name: "Bhadrak Forward Store",
    coords: [21.06, 86.5],
    status: "constrained",
    capacity: 48000,
    inventory: { food: 9100, water: 21000, medicine: 2300, shelter: 3100 },
    vehicles: 8,
    lastUpdated: "2026-09-06T09:12:00Z",
  },
  {
    id: "WH-03",
    name: "Kolkata Regional Hub",
    coords: [22.57, 88.36],
    status: "operational",
    capacity: 160000,
    inventory: { food: 51800, water: 132000, medicine: 18600, shelter: 22400 },
    vehicles: 31,
    lastUpdated: "2026-09-06T09:55:00Z",
  },
  {
    id: "WH-04",
    name: "Rishikesh Hill Depot",
    coords: [30.09, 78.27],
    status: "operational",
    capacity: 36000,
    inventory: { food: 8600, water: 19400, medicine: 3900, shelter: 4200 },
    vehicles: 11,
    lastUpdated: "2026-09-06T08:30:00Z",
  },
  {
    id: "WH-05",
    name: "Gandhidham Store",
    coords: [23.08, 70.13],
    status: "offline",
    capacity: 52000,
    inventory: { food: 12300, water: 28800, medicine: 4100, shelter: 5600 },
    vehicles: 0,
    lastUpdated: "2026-09-06T01:05:00Z",
  },
];

export const hazardZones: HazardZone[] = [
  {
    id: "HZ-FL-01",
    disasterType: "flood",
    name: "Mahanadi delta flood belt",
    historicalRiskScore: 0.87,
    source: "CWC 1978–2024 inundation records",
    lastValidated: "2026-06-30",
    geometry: [
      [20.12, 85.6],
      [20.95, 85.72],
      [21.15, 86.85],
      [20.35, 87.05],
      [19.95, 86.2],
    ],
  },
  {
    id: "HZ-FL-02",
    disasterType: "flood",
    name: "Lower Ganga–Sundarbans flood belt",
    historicalRiskScore: 0.74,
    source: "CWC / state revenue records",
    lastValidated: "2026-05-18",
    geometry: [
      [21.6, 88.1],
      [22.5, 88.25],
      [22.4, 89.1],
      [21.55, 89.05],
    ],
  },
  {
    id: "HZ-CY-01",
    disasterType: "cyclone",
    name: "Bay of Bengal cyclone-prone coastline",
    historicalRiskScore: 0.91,
    source: "IMD cyclone e-atlas 1891–2024",
    lastValidated: "2026-07-12",
    geometry: [
      [19.6, 85.4],
      [22.2, 87.6],
      [22.1, 88.9],
      [19.2, 86.4],
    ],
  },
  {
    id: "HZ-EQ-01",
    disasterType: "earthquake",
    name: "Kutch seismic zone V",
    historicalRiskScore: 0.83,
    source: "BIS seismic zonation / NCS catalogue",
    lastValidated: "2026-04-02",
    geometry: [
      [22.7, 68.9],
      [23.9, 69.1],
      [23.8, 70.9],
      [22.6, 70.6],
    ],
  },
  {
    id: "HZ-LS-01",
    disasterType: "landslide",
    name: "Garhwal Himalaya landslide belt",
    historicalRiskScore: 0.79,
    source: "GSI landslide inventory",
    lastValidated: "2026-06-08",
    geometry: [
      [30.0, 78.6],
      [30.8, 79.0],
      [30.6, 80.0],
      [29.9, 79.5],
    ],
  },
  {
    id: "HZ-LS-02",
    disasterType: "landslide",
    name: "Western Ghats slope belt",
    historicalRiskScore: 0.66,
    source: "GSI landslide inventory",
    lastValidated: "2026-03-21",
    geometry: [
      [11.2, 75.9],
      [12.1, 76.0],
      [12.0, 76.6],
      [11.15, 76.5],
    ],
  },
];

export const allocations: Allocation[] = [
  {
    id: "ALC-2201",
    zoneId: "ZN-114",
    zone: "Kendrapara East Belt",
    warehouseId: "WH-01",
    warehouse: "Cuttack Central Depot",
    resources: { food: 21000, water: 68000, medicine: 6800, shelter: 12400 },
    priority: 96,
    distanceKm: 71.4,
    etaMin: 118,
    vehicle: "VH-1104 · 12 t",
    route: [
      [20.46, 85.88],
      [20.48, 86.05],
      [20.52, 86.24],
      [20.5, 86.42],
    ],
  },
  {
    id: "ALC-2202",
    zoneId: "ZN-107",
    zone: "Balasore Coastal Strip",
    warehouseId: "WH-02",
    warehouse: "Bhadrak Forward Store",
    resources: { food: 9100, water: 21000, medicine: 2300, shelter: 3100 },
    priority: 84,
    distanceKm: 62.9,
    etaMin: 96,
    vehicle: "VH-2071 · 8 t",
    route: [
      [21.06, 86.5],
      [21.22, 86.66],
      [21.38, 86.82],
      [21.49, 86.94],
    ],
  },
  {
    id: "ALC-2203",
    zoneId: "ZN-131",
    zone: "Chamoli Upper Slopes",
    warehouseId: "WH-04",
    warehouse: "Rishikesh Hill Depot",
    resources: { food: 5580, water: 18600, medicine: 2790, shelter: 4650 },
    priority: 77,
    distanceKm: 144.2,
    etaMin: 271,
    vehicle: "VH-3312 · 6 t",
    route: [
      [30.09, 78.27],
      [30.18, 78.62],
      [30.29, 78.95],
      [30.41, 79.32],
    ],
  },
  {
    id: "ALC-2204",
    zoneId: "ZN-088",
    zone: "Bhuj Fault Margin",
    warehouseId: "WH-03",
    warehouse: "Kolkata Regional Hub",
    resources: { food: 12390, water: 41300, medicine: 6195, shelter: 8260 },
    priority: 61,
    distanceKm: 1892.0,
    etaMin: 2140,
    vehicle: "VH-4405 · rail transfer",
    route: [
      [22.57, 88.36],
      [23.0, 82.0],
      [23.3, 75.0],
      [23.24, 69.67],
    ],
  },
];

export const PIPELINE_STAGES = [
  "Detection",
  "Data",
  "Prediction",
  "Impact",
  "Demand",
  "Priority",
  "Allocation",
  "Routes",
] as const;

export const rainfallSeries = {
  "6h": [
    { t: "04:00", value: 22 },
    { t: "05:00", value: 31 },
    { t: "06:00", value: 44 },
    { t: "07:00", value: 39 },
    { t: "08:00", value: 52 },
    { t: "09:00", value: 61 },
  ],
  "24h": [
    { t: "10:00", value: 8 },
    { t: "14:00", value: 26 },
    { t: "18:00", value: 47 },
    { t: "22:00", value: 66 },
    { t: "02:00", value: 88 },
    { t: "06:00", value: 71 },
    { t: "09:00", value: 61 },
  ],
  "7d": [
    { t: "Aug 31", value: 14 },
    { t: "Sep 1", value: 33 },
    { t: "Sep 2", value: 61 },
    { t: "Sep 3", value: 92 },
    { t: "Sep 4", value: 145 },
    { t: "Sep 5", value: 244 },
    { t: "Sep 6", value: 318 },
  ],
};

export function severityOf(score: number): Severity {
  if (score >= 0.85) return "Extreme";
  if (score >= 0.6) return "High";
  if (score >= 0.35) return "Moderate";
  return "Low";
}

export function fmt(n: number) {
  return n.toLocaleString("en-IN");
}
