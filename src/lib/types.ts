export type Role = "A" | "B" | "C" | "D";

export interface Label {
  id: number;
  display: string;
}

export interface Segment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  label_id: number | null;
}

export interface AnnProject {
  version: number;
  video_path: string;
  labels_path: string;
  role: Role;
  segments: Array<Omit<Segment, "id">>;
}
