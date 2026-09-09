import type { Zone } from "@/data/mock";

/**
 * A zone originated from the live NDMA SACHET / Government of India alert feed
 * when its `source` was set by the live-feed mapper (`useLiveFeed.toZone`),
 * which writes the literal "NDMA public alert stream". Mock zones carry their
 * own source strings (IMD/CWC/NCS/GSI), so this check isolates live-API data.
 */
export function isNDMALiveSource(source: string): boolean {
  return /NDMA public alert stream/i.test(source);
}

/**
 * Small professional badge marking a disaster card / popup as sourced from the
 * live Government of India feed. Renders nothing for mock or simulated zones,
 * so it only appears next to active-API data.
 */
export function SourceBadge({ zone }: { zone: Zone }) {
  if (!isNDMALiveSource(zone.source)) return null;
  return (
    <span className="data inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded border border-blue-200 bg-blue-50 text-blue-700">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
      Source: NDMA SACHET (Live)
    </span>
  );
}
