import { describe, expect, it } from "vitest";
import { formatMs } from "../time";

describe("time", () => {
  it("formats with rounding to 0.1s", () => {
    expect(formatMs(0)).toBe("00:00.0");
    expect(formatMs(949)).toBe("00:00.9");
    expect(formatMs(950)).toBe("00:01.0");
    expect(formatMs(999)).toBe("00:01.0");
  });

  it("handles minute carry", () => {
    expect(formatMs(59999)).toBe("01:00.0");
    expect(formatMs(61000)).toBe("01:01.0");
  });
});