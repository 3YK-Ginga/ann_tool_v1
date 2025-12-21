import { describe, expect, it } from "vitest";
import {
  createSegmentAt,
  isOverlap,
  moveSegment,
  resizeSegmentEnd,
  resizeSegmentStart,
  MIN_SEGMENT_MS
} from "../segments";
import { Segment } from "../types";

const makeSeg = (id: string, start: number, end: number): Segment => ({
  id,
  start_ms: start,
  end_ms: end,
  text: "",
  label_id: null
});

describe("segments", () => {
  it("treats adjacency as non-overlap", () => {
    expect(isOverlap(0, 100, 100, 200)).toBe(false);
    expect(isOverlap(0, 100, 99, 200)).toBe(true);
  });

  it("creates a segment with snap on both sides", () => {
    const segments = [makeSeg("a", 0, 1000), makeSeg("b", 2000, 3000)];
    const result = createSegmentAt(segments, 900, 5000);
    expect(result.error).toBeUndefined();
    const created = result.segments.find((seg) => seg.id !== "a" && seg.id !== "b");
    expect(created?.start_ms).toBe(1000);
    expect(created?.end_ms).toBe(2000);
  });

  it("rejects creation if snapped length is too short", () => {
    const segments = [makeSeg("a", 0, 1000), makeSeg("b", 1030, 2000)];
    const result = createSegmentAt(segments, 900, 5000);
    expect(result.error).toBeDefined();
  });

  it("snaps resize start to previous end", () => {
    const segments = [makeSeg("a", 0, 1000), makeSeg("b", 1500, 2000)];
    const updated = resizeSegmentStart(segments, "b", 900, 5000);
    const target = updated.find((seg) => seg.id === "b");
    expect(target?.start_ms).toBe(1000);
  });

  it("snaps resize end to next start", () => {
    const segments = [makeSeg("a", 0, 1000), makeSeg("b", 1500, 2000)];
    const updated = resizeSegmentEnd(segments, "a", 1600, 5000);
    const target = updated.find((seg) => seg.id === "a");
    expect(target?.end_ms).toBe(1500);
  });

  it("clamps resize end to minimum length", () => {
    const segments = [makeSeg("a", 0, 1000)];
    const updated = resizeSegmentEnd(segments, "a", 10, 5000);
    const target = updated.find((seg) => seg.id === "a");
    expect(target?.end_ms).toBe(0 + MIN_SEGMENT_MS);
  });

  it("clamps move within neighbors", () => {
    const segments = [makeSeg("a", 0, 1000), makeSeg("b", 1500, 2000)];
    const moved = moveSegment(segments, "b", 900, 5000);
    const target = moved.find((seg) => seg.id === "b");
    expect(target?.start_ms).toBe(1000);
    expect(target?.end_ms).toBe(1500);
  });
});