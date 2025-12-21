import { describe, expect, it } from "vitest";
import { parseLabelsXml } from "../labels";

describe("labels", () => {
  it("parses valid xml", () => {
    const xml = `<?xml version="1.0"?>
<labels version="1.0">
  <label id="0" key="confident" display="確信" />
  <label id="1" key="neutral" display="中立" />
</labels>`;
    const result = parseLabelsXml(xml);
    expect(result.error).toBeUndefined();
    expect(result.labels).toHaveLength(2);
    expect(result.labels[0].display).toBe("確信");
  });

  it("rejects duplicate ids", () => {
    const xml = `<?xml version="1.0"?>
<labels version="1.0">
  <label id="0" display="A" />
  <label id="0" display="B" />
</labels>`;
    const result = parseLabelsXml(xml);
    expect(result.error).toBeDefined();
  });

  it("rejects missing display", () => {
    const xml = `<?xml version="1.0"?>
<labels version="1.0">
  <label id="0" />
</labels>`;
    const result = parseLabelsXml(xml);
    expect(result.error).toBeDefined();
  });

  it("rejects missing version", () => {
    const xml = `<?xml version="1.0"?>
<labels>
  <label id="0" display="A" />
</labels>`;
    const result = parseLabelsXml(xml);
    expect(result.error).toBeDefined();
  });
});