import { Segment } from "./types";
import { formatMs } from "./time";

export function escapeCsvField(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) {
    return value;
  }
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

export function buildSegmentCsv(segments: Segment[]): string {
  const lines = ["start,end,label,text"];
  for (const segment of segments) {
    const start = formatMs(segment.start_ms);
    const end = formatMs(segment.end_ms);
    const label = segment.label_id == null ? "" : `${segment.label_id}`;
    const text = escapeCsvField(segment.text);
    lines.push(`${start},${end},${label},${text}`);
  }
  return lines.join("\n");
}
