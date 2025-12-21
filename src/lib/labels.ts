import { Label } from "./types";

export interface LabelsParseResult {
  labels: Label[];
  error?: string;
}

export function parseLabelsXml(xmlText: string): LabelsParseResult {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch {
    return { labels: [], error: "XMLの解析に失敗しました。" };
  }

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    return { labels: [], error: "XMLの解析に失敗しました。" };
  }

  const root = doc.querySelector("labels");
  if (!root) {
    return { labels: [], error: "labels要素が見つかりません。" };
  }

  const version = root.getAttribute("version");
  if (!version) {
    return { labels: [], error: "labelsのversion属性が必須です。" };
  }

  const labels: Label[] = [];
  const seen = new Set<number>();
  const nodes = Array.from(root.getElementsByTagName("label"));

  for (const node of nodes) {
    const idAttr = node.getAttribute("id");
    const display = node.getAttribute("display");
    if (idAttr == null || display == null) {
      return { labels: [], error: "labelのid/display属性が必須です。" };
    }
    const id = Number.parseInt(idAttr, 10);
    if (!Number.isFinite(id)) {
      return { labels: [], error: "labelのidが数値ではありません。" };
    }
    if (seen.has(id)) {
      return { labels: [], error: "labelのidが重複しています。" };
    }
    seen.add(id);
    labels.push({ id, display });
  }

  return { labels };
}