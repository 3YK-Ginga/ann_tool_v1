import { describe, expect, it } from "vitest";
import { buildSegmentCsv, escapeCsvField } from "../csv";
import { Segment } from "../types";

describe("csv", () => {
  it("escapes commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("escapes newlines", () => {
    expect(escapeCsvField("a\nb")).toBe('"a\nb"');
  });

  it("escapes double quotes", () => {
    expect(escapeCsvField('a"b')).toBe('"a""b"');
  });

  it("builds combined csv rows", () => {
    const segments: Segment[] = [
      {
        id: "seg-1",
        start_ms: 0,
        end_ms: 1000,
        label_id: 3,
        text: "a,b"
      }
    ];
    expect(buildSegmentCsv(segments)).toBe(
      "start,end,label,text\n00:00.0,00:01.0,3,\"a,b\""
    );
  });
});
