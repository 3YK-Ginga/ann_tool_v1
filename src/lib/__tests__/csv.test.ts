import { describe, expect, it } from "vitest";
import { escapeCsvField } from "../csv";

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
});