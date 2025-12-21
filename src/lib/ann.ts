import { sortSegments } from "./segments";
import { AnnProject, Role, Segment } from "./types";

function isRole(value: unknown): value is Role {
  return value === "A" || value === "B" || value === "C" || value === "D";
}

export function parseAnnFile(text: string): { data?: AnnProject; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: "annファイルのJSON解析に失敗しました。" };
  }

  if (typeof raw !== "object" || raw === null) {
    return { error: "annファイルの形式が不正です。" };
  }

  const data = raw as AnnProject;

  if (typeof data.version !== "number") {
    return { error: "annのversionが不正です。" };
  }
  if (typeof data.video_path !== "string") {
    return { error: "annのvideo_pathが不正です。" };
  }
  if (typeof data.labels_path !== "string") {
    return { error: "annのlabels_pathが不正です。" };
  }
  if (!isRole(data.role)) {
    return { error: "annのroleが不正です。" };
  }

  if (!Array.isArray(data.segments)) {
    return { error: "annのsegmentsが不正です。" };
  }

  const segments: Segment[] = data.segments.map((seg, index) => {
    const start = typeof seg.start_ms === "number" ? seg.start_ms : NaN;
    const end = typeof seg.end_ms === "number" ? seg.end_ms : NaN;
    const text = typeof seg.text === "string" ? seg.text : "";
    const labelId =
      typeof seg.label_id === "number" || seg.label_id === null
        ? seg.label_id
        : null;
    return {
      id: `ann_${index}_${Math.floor(Math.random() * 100000)}`,
      start_ms: start,
      end_ms: end,
      text,
      label_id: labelId
    };
  });

  for (const seg of segments) {
    if (!Number.isFinite(seg.start_ms) || !Number.isFinite(seg.end_ms)) {
      return { error: "annのsegmentsが不正です。" };
    }
    if (seg.start_ms >= seg.end_ms) {
      return { error: "annのsegmentsが不正です。" };
    }
  }

  const sorted = sortSegments(segments);

  return {
    data: {
      version: data.version,
      video_path: data.video_path,
      labels_path: data.labels_path,
      role: data.role,
      segments: sorted.map(({ id, ...rest }) => rest)
    }
  };
}

export function buildAnnProject(
  videoPath: string,
  labelsPath: string,
  role: Role,
  segments: Segment[]
): AnnProject {
  return {
    version: 1,
    video_path: videoPath,
    labels_path: labelsPath,
    role,
    segments: sortSegments(segments).map(({ id, ...rest }) => rest)
  };
}