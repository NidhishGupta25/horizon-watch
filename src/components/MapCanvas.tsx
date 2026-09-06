import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMap, Tooltip } from "react-leaflet";
import {
  allocations as allAllocations,
  hazardZones as allHazard,
  warehouses as allWarehouses,
  zones as allZones,
  DISASTER_LABEL,
  fmt,
  type DisasterType,
  type Zone,
} from "@/data/mock";

const SEV_HEX: Record<string, string> = {
  Low: "#4B6043",
  Moderate: "#C9A227",
  High: "#C1440E",
  Extreme: "#7A1F1F",
};

const HAZARD_HEX: Record<DisasterType, string> = {
  flood: "#1B4B43",
  cyclone: "#5F6154",
  earthquake: "#7A1F1F",
  landslide: "#4B6043",
};

function zoneIcon(zone: Zone, selected: boolean) {
  const color = SEV_HEX[zone.severity];
  const size = 14 + Math.round(zone.score * 16);
  const dur = (3.2 - zone.score * 2).toFixed(2);
  const scale = (1.7 + zone.score * 2.1).toFixed(2);
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="sev-pulse" style="width:${size}px;height:${size}px;color:${color};--pulse-dur:${dur}s;--pulse-scale:${scale}">
      <div style="width:100%;height:100%;border-radius:9999px;background:${color};border:${selected ? 3 : 2}px solid #EDE8D9;box-shadow:0 0 0 ${selected ? 2 : 1}px ${color}"></div>
    </div>`,
  });
}

const warehouseIcon = (status: string) =>
  L.divIcon({
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `<div style="width:14px;height:14px;background:${status === "offline" ? "#B9B29B" : status === "constrained" ? "#C9A227" : "#1B4B43"};border:2px solid #EDE8D9;transform:rotate(45deg)"></div>`,
  });

const vehicleIcon = L.divIcon({
  className: "",
  iconSize: [10, 10],
  iconAnchor: [5, 5],
  html: `<div style="width:10px;height:10px;background:#C1440E;border:2px solid #F4F0E4;border-radius:2px"></div>`,
});

function lerpRoute(route: [number, number][], t: number): [number, number] {
  const segs = route.length - 1;
  const pos = Math.min(Math.max(t, 0), 0.9999) * segs;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = route[i];
  const b = route[i + 1] ?? route[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Vehicle interpolates along the real polyline using the allocation ETA. */
function Vehicle({ route, etaMin, label }: { route: [number, number][]; etaMin: number; label: string }) {
  const [pos, setPos] = useState<[number, number]>(route[0]);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPos(lerpRoute(route, 0.4));
      return;
    }
    // 1 real second ≈ 3 minutes of ETA, so faster ETA = faster icon.
    const durationMs = (etaMin / 3) * 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const t = ((now - start) % durationMs) / durationMs;
      setPos(lerpRoute(route, t));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [route, etaMin]);

  return (
    <Marker position={pos} icon={vehicleIcon}>
      <Tooltip direction="top" offset={[0, -6]}>
        <span className="data text-[11px]">{label}</span>
      </Tooltip>
    </Marker>
  );
}

function FlyTo({ zone }: { zone?: Zone }) {
  const map = useMap();
  useEffect(() => {
    if (zone) map.flyTo(zone.coords, Math.max(map.getZoom(), 7), { duration: 0.9 });
  }, [zone, map]);
  return null;
}

export interface MapCanvasProps {
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  showHazard?: boolean;
  showActive?: boolean;
  hazardTypes?: DisasterType[];
  zones?: Zone[];
  showRoutes?: boolean;
  center?: [number, number];
  zoom?: number;
}

export default function MapCanvas({
  selectedZoneId,
  onSelectZone,
  showHazard = true,
  showActive = true,
  hazardTypes = ["flood", "cyclone", "earthquake", "landslide"],
  zones = allZones,
  showRoutes = true,
  center = [22.4, 81.5],
  zoom = 5,
}: MapCanvasProps) {
  const selected = useMemo(() => zones.find((z) => z.id === selectedZoneId), [zones, selectedZoneId]);
  const visibleHazard = allHazard.filter((h) => hazardTypes.includes(h.disasterType));

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full" zoomControl={false} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Baseline hazard layer — standing, muted, static */}
      {showHazard &&
        visibleHazard.map((h) => (
          <Polygon
            key={h.id}
            positions={h.geometry}
            pathOptions={{
              color: HAZARD_HEX[h.disasterType],
              weight: 1,
              dashArray: "4 4",
              fillColor: HAZARD_HEX[h.disasterType],
              fillOpacity: 0.1 + h.historicalRiskScore * 0.12,
            }}
          >
            <Tooltip sticky>
              <div className="text-[11px]">
                <div className="font-semibold">{h.name}</div>
                <div className="data">
                  Historical risk {h.historicalRiskScore.toFixed(2)} · {DISASTER_LABEL[h.disasterType]}
                </div>
                <div className="text-[10px]">{h.source}</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}

      {showActive && (
        <>
          {showRoutes &&
            allAllocations
              .filter((a) => zones.some((z) => z.id === a.zoneId))
              .map((a) => (
                <Polyline
                  key={a.id}
                  positions={a.route}
                  pathOptions={{ color: "#C1440E", weight: 2, opacity: 0.85 }}
                />
              ))}

          {showRoutes &&
            allAllocations
              .filter((a) => zones.some((z) => z.id === a.zoneId))
              .map((a) => (
                <Vehicle key={`v-${a.id}`} route={a.route} etaMin={a.etaMin} label={`${a.vehicle} · ETA ${a.etaMin}m`} />
              ))}

          {allWarehouses.map((w) => (
            <Marker key={w.id} position={w.coords} icon={warehouseIcon(w.status)}>
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-[11px]">
                  <div className="font-semibold">{w.name}</div>
                  <div className="data">
                    {w.status} · capacity {fmt(w.capacity)}
                  </div>
                  <div className="data">
                    food {fmt(w.inventory.food)} · water {fmt(w.inventory.water)}
                  </div>
                  <div className="data">
                    medicine {fmt(w.inventory.medicine)} · shelter {fmt(w.inventory.shelter)}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {zones.map((z) => (
            <Marker
              key={z.id}
              position={z.coords}
              icon={zoneIcon(z, z.id === selectedZoneId)}
              eventHandlers={{ click: () => onSelectZone?.(z.id) }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <div className="text-[11px]">
                  <div className="font-semibold">{z.name}</div>
                  <div className="data">
                    {z.severity} · {fmt(z.affected)} affected
                  </div>
                </div>
              </Tooltip>
            </Marker>
          ))}
        </>
      )}

      <FlyTo zone={selected} />
    </MapContainer>
  );
}
