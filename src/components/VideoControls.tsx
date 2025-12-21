import { formatMs } from "../lib/time";
import { Role } from "../lib/types";

interface VideoControlsProps {
  variant?: "header" | "playback" | "all";
  videoFileName: string | null;
  role: Role;
  labelsLoaded: boolean;
  stepMs: number;
  currentMs: number;
  durationMs: number;
  isPlaying: boolean;
  canUseTimeline: boolean;
  canExport: boolean;
  canSaveAnn: boolean;
  onOpenVideo: () => void;
  onOpenLabels: () => void;
  onOpenAnn: () => void;
  onSaveAnn: () => void;
  onExportCsv: () => void;
  onRoleChange: (role: Role) => void;
  onTogglePlay: () => void;
  onSeekByStep: (deltaMs: number) => void;
  onStepChange: (ms: number) => void;
}

const roles: Role[] = ["A", "B", "C", "D"];

export default function VideoControls({
  variant = "all",
  videoFileName,
  role,
  labelsLoaded,
  stepMs,
  currentMs,
  durationMs,
  isPlaying,
  canUseTimeline,
  canExport,
  canSaveAnn,
  onOpenVideo,
  onOpenLabels,
  onOpenAnn,
  onSaveAnn,
  onExportCsv,
  onRoleChange,
  onTogglePlay,
  onSeekByStep,
  onStepChange
}: VideoControlsProps) {
  const showHeader = variant !== "playback";
  const showPlayback = variant !== "header";

  return (
    <section className={`controls controls-${variant}`}>
      {showHeader && (
        <>
          <div className="control-row control-row-header">
            <button type="button" onClick={onOpenVideo} className="btn">
              動画を選択
            </button>
            <div className="control-field">
              <label htmlFor="role-select">役割</label>
              <select
                id="role-select"
                value={role}
                onChange={(event) => onRoleChange(event.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={onOpenLabels} className="btn">
              labels.xmlを選択
            </button>
            <button type="button" onClick={onOpenAnn} className="btn">
              Open .ann
            </button>
            <button
              type="button"
              onClick={onSaveAnn}
              disabled={!canSaveAnn}
              className="btn"
            >
              Save .ann
            </button>
            <button
              type="button"
              onClick={onExportCsv}
              disabled={!canExport}
              className="btn btn-primary"
            >
              CSV出力
            </button>
          </div>
          <div className="control-row control-row-badges">
            <div className="control-field">
              <span className="badge">{videoFileName ?? "動画未選択"}</span>
            </div>
            <div className={`control-field ${labelsLoaded ? "" : "muted"}`}>
              <span className="badge">
                {labelsLoaded ? "labels.xml読込済" : "labels.xml未読込"}
              </span>
            </div>
          </div>
        </>
      )}
      {showPlayback && (
        <div className="control-row control-row-playback">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!canUseTimeline}
            className={`play-button ${isPlaying ? "pause" : "play"}`}
          >
            <span className="play-icon">{isPlaying ? "❚❚" : "▶"}</span>
          </button>
          <button
            type="button"
            onClick={() => onSeekByStep(-stepMs)}
            disabled={!canUseTimeline}
            className="btn seek-button"
          >
            &lt;&lt; {stepMs}ms
          </button>
          <button
            type="button"
            onClick={() => onSeekByStep(stepMs)}
            disabled={!canUseTimeline}
            className="btn seek-button"
          >
            {stepMs}ms &gt;&gt;
          </button>
          <div className="control-field time-display">
            {formatMs(currentMs)} / {formatMs(durationMs || 0)}
          </div>
          <div className="control-field step">
            <label htmlFor="step-range">最小ステップ</label>
            <input
              id="step-range"
              type="range"
              min={50}
              max={1000}
              step={50}
              value={stepMs}
              onChange={(event) => onStepChange(Number(event.target.value))}
            />
            <span className="step-value">{stepMs}ms</span>
          </div>
        </div>
      )}
    </section>
  );
}
