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

export function buildTextCsv(segments: Segment[]): string {
  const lines = ["start,end,text"];
  for (const segment of segments) {
    const start = formatMs(segment.start_ms);
    const end = formatMs(segment.end_ms);
    const text = escapeCsvField(segment.text);
    lines.push(`${start},${end},${text}`);
  }
  return lines.join("\n");
}

export function buildLabelCsv(segments: Segment[]): string {
  const lines = ["start,end,label"];
  for (const segment of segments) {
    const start = formatMs(segment.start_ms);
    const end = formatMs(segment.end_ms);
    const label = segment.label_id == null ? "" : `${segment.label_id}`;
    lines.push(`${start},${end},${label}`);
  }
  return lines.join("\n");
}