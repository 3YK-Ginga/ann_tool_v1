import { clampMs } from "./time";
import { Segment } from "./types";

export const MIN_SEGMENT_MS = 50;
export const DEFAULT_SEGMENT_MS = 2000;

export function isOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number
): boolean {
  return startA < endB && endA > startB;
}

export function sortSegments(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => {
    if (a.start_ms !== b.start_ms) {
      return a.start_ms - b.start_ms;
    }
    return a.end_ms - b.end_ms;
  });
}

function getNeighborsByIndex(segments: Segment[], index: number): {
  prevEnd: number | null;
  nextStart: number | null;
} {
  const prevEnd = index > 0 ? segments[index - 1].end_ms : null;
  const nextStart = index < segments.length - 1 ? segments[index + 1].start_ms : null;
  return { prevEnd, nextStart };
}

function getNeighborsForInsert(segments: Segment[], startMs: number): {
  prevEnd: number | null;
  nextStart: number | null;
} {
  let prevEnd: number | null = null;
  let nextStart: number | null = null;
  for (const seg of segments) {
    if (seg.end_ms <= startMs) {
      prevEnd = seg.end_ms;
      continue;
    }
    nextStart = seg.start_ms;
    break;
  }
  return { prevEnd, nextStart };
}

function newSegmentId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `seg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function createSegmentAt(
  segments: Segment[],
  startMs: number,
  durationMs: number
): { segments: Segment[]; error?: string } {
  const sorted = sortSegments(segments);
  let start = clampMs(startMs, 0, durationMs);
  let end = Math.min(start + DEFAULT_SEGMENT_MS, durationMs);

  const { prevEnd, nextStart } = getNeighborsForInsert(sorted, start);

  if (prevEnd != null && start < prevEnd) {
    start = prevEnd;
  }
  if (nextStart != null && end > nextStart) {
    end = nextStart;
  }

  if (end - start < MIN_SEGMENT_MS) {
    return {
      segments,
      error: "区間の空きが50ms未満のため作成できません。"
    };
  }

  for (const seg of sorted) {
    if (isOverlap(start, end, seg.start_ms, seg.end_ms)) {
      return {
        segments,
        error: "既存区間と重なるため作成できません。"
      };
    }
  }

  const newSeg: Segment = {
    id: newSegmentId(),
    start_ms: start,
    end_ms: end,
    text: "",
    label_id: null
  };

  return { segments: sortSegments([...sorted, newSeg]) };
}

export function moveSegment(
  segments: Segment[],
  id: string,
  proposedStart: number,
  durationMs: number
): Segment[] {
  const sorted = sortSegments(segments);
  const index = sorted.findIndex((seg) => seg.id === id);
  if (index === -1) {
    return segments;
  }
  const seg = sorted[index];
  const length = seg.end_ms - seg.start_ms;
  const { prevEnd, nextStart } = getNeighborsByIndex(sorted, index);
  const minStart = Math.max(prevEnd ?? 0, 0);
  const maxStart = Math.min(
    (nextStart ?? durationMs) - length,
    durationMs - length
  );

  if (minStart > maxStart) {
    return segments;
  }

  const start = clampMs(proposedStart, minStart, maxStart);
  const updated = { ...seg, start_ms: start, end_ms: start + length };
  const nextSegments = [...sorted];
  nextSegments[index] = updated;
  return sortSegments(nextSegments);
}

export function resizeSegmentStart(
  segments: Segment[],
  id: string,
  proposedStart: number,
  _durationMs: number
): Segment[] {
  const sorted = sortSegments(segments);
  const index = sorted.findIndex((seg) => seg.id === id);
  if (index === -1) {
    return segments;
  }
  const seg = sorted[index];
  const { prevEnd } = getNeighborsByIndex(sorted, index);
  const minStart = Math.max(prevEnd ?? 0, 0);
  const maxStart = seg.end_ms - MIN_SEGMENT_MS;

  if (minStart > maxStart) {
    return segments;
  }

  const start = clampMs(proposedStart, minStart, maxStart);
  const updated = { ...seg, start_ms: start };
  const nextSegments = [...sorted];
  nextSegments[index] = updated;
  return sortSegments(nextSegments);
}

export function resizeSegmentEnd(
  segments: Segment[],
  id: string,
  proposedEnd: number,
  durationMs: number
): Segment[] {
  const sorted = sortSegments(segments);
  const index = sorted.findIndex((seg) => seg.id === id);
  if (index === -1) {
    return segments;
  }
  const seg = sorted[index];
  const { nextStart } = getNeighborsByIndex(sorted, index);
  const minEnd = seg.start_ms + MIN_SEGMENT_MS;
  const maxEnd = Math.min(nextStart ?? durationMs, durationMs);

  if (minEnd > maxEnd) {
    return segments;
  }

  const end = clampMs(proposedEnd, minEnd, maxEnd);
  const updated = { ...seg, end_ms: end };
  const nextSegments = [...sorted];
  nextSegments[index] = updated;
  return sortSegments(nextSegments);
}

export function updateSegmentText(
  segments: Segment[],
  id: string,
  text: string
): Segment[] {
  return segments.map((seg) =>
    seg.id === id ? { ...seg, text } : seg
  );
}

export function updateSegmentLabel(
  segments: Segment[],
  id: string,
  labelId: number
): Segment[] {
  return segments.map((seg) =>
    seg.id === id ? { ...seg, label_id: labelId } : seg
  );
}

export function deleteSegment(segments: Segment[], id: string): Segment[] {
  return segments.filter((seg) => seg.id !== id);
}

export function isSegmentComplete(segment: Segment): boolean {
  return segment.text.trim() !== "" && segment.label_id != null;
}
