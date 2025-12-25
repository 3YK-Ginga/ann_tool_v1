import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import VideoControls from "./components/VideoControls";
import TimelineCanvas from "./components/TimelineCanvas";
import StatusBar from "./components/StatusBar";
import { buildSegmentCsv } from "./lib/csv";
import { buildAnnProject, parseAnnFile } from "./lib/ann";
import { parseLabelsXml } from "./lib/labels";
import { getBaseName, getFileName } from "./lib/path";
import { clampMs } from "./lib/time";
import { isSegmentComplete, sortSegments } from "./lib/segments";
import { Label, Role, Segment } from "./lib/types";

const pickSinglePath = (value: string | string[] | null): string | null => {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] ?? null : value;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "不明なエラーが発生しました。";
};

interface StatusMessage {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepMs, setStepMs] = useState(100);
  const [role, setRole] = useState<Role>("A");
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [labelsPath, setLabelsPath] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [toasts, setToasts] = useState<StatusMessage[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const [playbackEndMs, setPlaybackEndMs] = useState<number | null>(null);

  const canUseTimeline = Boolean(videoPath && durationMs > 0);
  const hasIncomplete = segments.some((seg) => !isSegmentComplete(seg));
  const canExport = Boolean(videoFileName && !hasIncomplete);
  const canSaveAnn = Boolean(videoPath && labelsPath);

  const dismissToast = (id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showStatus = (type: StatusMessage["type"], message: string) => {
    const id = `toast_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    const timer = window.setTimeout(() => dismissToast(id), 5000);
    toastTimersRef.current.set(id, timer);
  };

  const showError = (context: string, error: unknown) => {
    showStatus("error", `${context}: ${getErrorMessage(error)}`);
  };

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      showStatus("error", `エラーが発生しました: ${event.message}`);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      showStatus("error", `処理に失敗しました: ${getErrorMessage(event.reason)}`);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (!canUseTimeline) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleSeekByStep(-stepMs);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleSeekByStep(stepMs);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canUseTimeline, stepMs, currentMs, durationMs]);

  const handleOpenVideo = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Video",
            extensions: ["mp4", "mov", "mkv", "webm", "avi"]
          }
        ]
      });
      const filePath = pickSinglePath(selected);
      if (!filePath) {
        return;
      }
      const fileName = getFileName(filePath);
      setVideoPath(filePath);
      setVideoFileName(fileName);
      setVideoSrc(convertFileSrc(filePath));
      setDurationMs(0);
      setCurrentMs(0);
      setPlaybackEndMs(null);
      showStatus("info", `動画を読み込みました: ${fileName}`);
    } catch (error) {
      showError("動画の読み込みに失敗しました", error);
    }
  };

  const handleOpenLabels = async () => {
    let filePath: string | null = null;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Labels", extensions: ["xml"] }]
      });
      filePath = pickSinglePath(selected);
    } catch (error) {
      showError("labels.xmlの選択に失敗しました", error);
      return;
    }
    if (!filePath) {
      return;
    }
    let xmlText: string;
    try {
      xmlText = await readTextFile(filePath);
    } catch (error) {
      showError("labels.xmlの読み込みに失敗しました", error);
      return;
    }
    const result = parseLabelsXml(xmlText);
    if (result.error) {
      showStatus("error", result.error);
      return;
    }
    setLabels(result.labels);
    setLabelsPath(filePath);
    showStatus("info", "labels.xmlを読み込みました。");
  };

  const handleOpenAnn = async () => {
    let filePath: string | null = null;
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Annotation", extensions: ["ann"] }]
      });
      filePath = pickSinglePath(selected);
    } catch (error) {
      showError("annの選択に失敗しました", error);
      return;
    }
    if (!filePath) {
      return;
    }
    let text: string;
    try {
      text = await readTextFile(filePath);
    } catch (error) {
      showError("annの読み込みに失敗しました", error);
      return;
    }
    const result = parseAnnFile(text);
    if (result.error || !result.data) {
      showStatus("error", result.error ?? "annの読み込みに失敗しました。");
      return;
    }

    const ann = result.data;
    setRole(ann.role);
    const loadedSegments = ann.segments.map((seg, index) => ({
      id: `seg_${index}_${Date.now()}`,
      ...seg
    }));
    setSegments(sortSegments(loadedSegments));

    let warned = false;
    const nextVideoFileName = getFileName(ann.video_path);
    if (videoPath && ann.video_path !== videoPath) {
      showStatus(
        "warning",
        "annの動画パスが現在の動画と一致しません。"
      );
      warned = true;
    }

    setVideoPath(ann.video_path);
    setVideoFileName(nextVideoFileName);
    setVideoSrc(convertFileSrc(ann.video_path));
    setDurationMs(0);
    setCurrentMs(0);
    setPlaybackEndMs(null);

    setLabelsPath(ann.labels_path);
    try {
      const labelText = await readTextFile(ann.labels_path);
      const labelResult = parseLabelsXml(labelText);
      if (labelResult.error) {
        setLabels(null);
        showStatus("error", labelResult.error);
      } else {
        setLabels(labelResult.labels);
      }
    } catch {
      setLabels(null);
      showStatus("error", "labels.xmlの読み込みに失敗しました。");
    }

    if (!warned) {
      showStatus("info", "annを読み込みました。");
    }
  };

  const handleSaveAnn = async () => {
    if (!videoPath) {
      showStatus("error", "動画名が未設定のためannを保存できません。");
      return;
    }
    if (!labelsPath) {
      showStatus("error", "labels.xmlが未ロードのためannを保存できません。");
      return;
    }
    const ann = buildAnnProject(videoPath, labelsPath, role, segments);
    const defaultName = `${getBaseName(getFileName(videoPath))}_${role}.ann`;
    let path: string | null = null;
    try {
      const selected = await save({
        defaultPath: defaultName,
        filters: [{ name: "Annotation", extensions: ["ann"] }]
      });
      path = pickSinglePath(selected);
    } catch (error) {
      showError("annの保存先選択に失敗しました", error);
      return;
    }
    if (!path) {
      return;
    }
    try {
      await writeTextFile(path, JSON.stringify(ann, null, 2));
      showStatus("info", `annを保存しました: ${path}`);
    } catch (error) {
      showError("annの保存に失敗しました", error);
    }
  };

  const handleExportCsv = async () => {
    const exportName = videoFileName ?? (videoPath ? getFileName(videoPath) : "");
    if (!exportName) {
      showStatus("error", "動画名が未設定のためCSVを出力できません。");
      return;
    }
    if (hasIncomplete) {
      showStatus("error", "未完了の区間があるためCSVを出力できません。");
      return;
    }
    const sorted = sortSegments(segments);
    const base = `${getBaseName(exportName)}_${role}`;
    const csv = buildSegmentCsv(sorted);

    let csvPath: string | null = null;
    try {
      const selected = await save({
        defaultPath: `${base}.csv`,
        filters: [{ name: "CSV", extensions: ["csv"] }]
      });
      csvPath = pickSinglePath(selected);
    } catch (error) {
      showError("CSVの保存先選択に失敗しました", error);
      return;
    }
    if (!csvPath) {
      return;
    }
    try {
      await writeTextFile(csvPath, csv);
      showStatus("info", "CSVを書き出しました。");
    } catch (error) {
      showError("CSVの書き出しに失敗しました", error);
    }
  };

  const handleTogglePlay = async () => {
    const video = videoRef.current;
    if (!video) {
      showStatus("error", "動画が未選択です。");
      return;
    }
    setPlaybackEndMs(null);
    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (error) {
      showError("再生に失敗しました", error);
    }
  };

  const handleSeekTo = (ms: number) => {
    const video = videoRef.current;
    if (!video) {
      showStatus("error", "動画が未選択です。");
      return;
    }
    const clamped = clampMs(ms, 0, durationMs);
    video.currentTime = clamped / 1000;
    setCurrentMs(clamped);
    setPlaybackEndMs(null);
  };

  const handleSeekByStep = (deltaMs: number) => {
    handleSeekTo(currentMs + deltaMs);
  };

  const handleStepChange = (value: number) => {
    setStepMs(Math.max(50, Math.round(value)));
  };

  const handlePlaySegment = async (startMs: number, endMs: number) => {
    const video = videoRef.current;
    if (!video) {
      showStatus("error", "動画が未選択です。");
      return;
    }
    video.currentTime = startMs / 1000;
    setPlaybackEndMs(endMs);
    try {
      await video.play();
    } catch (error) {
      showError("区間再生に失敗しました", error);
    }
  };

  const syncVideoMetadata = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    let duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      if (video.seekable.length > 0) {
        duration = video.seekable.end(video.seekable.length - 1);
      }
    }
    if (Number.isFinite(duration) && duration > 0) {
      setDurationMs(duration * 1000);
    }
    setCurrentMs(video.currentTime * 1000);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <h1>Annotation Timeline</h1>
          <span>Debate Annotator</span>
        </div>
        <VideoControls
          variant="header"
          videoFileName={videoFileName}
          role={role}
          labelsLoaded={Boolean(labels)}
          stepMs={stepMs}
          currentMs={currentMs}
          durationMs={durationMs}
          isPlaying={isPlaying}
          canUseTimeline={canUseTimeline}
          canExport={canExport}
          canSaveAnn={canSaveAnn}
          onOpenVideo={handleOpenVideo}
          onOpenLabels={handleOpenLabels}
          onOpenAnn={handleOpenAnn}
          onSaveAnn={handleSaveAnn}
          onExportCsv={handleExportCsv}
          onRoleChange={setRole}
          onTogglePlay={handleTogglePlay}
          onSeekByStep={handleSeekByStep}
          onStepChange={handleStepChange}
        />
      </header>
      <StatusBar messages={toasts} onDismiss={dismissToast} />
      <main className="app-main">
        <div className="video-panel">
          {videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              onLoadedMetadata={syncVideoMetadata}
              onLoadedData={syncVideoMetadata}
              onDurationChange={syncVideoMetadata}
              onTimeUpdate={() => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }
                const nowMs = video.currentTime * 1000;
                setCurrentMs(nowMs);
                if (durationMs === 0) {
                  syncVideoMetadata();
                }
                if (playbackEndMs != null && nowMs >= playbackEndMs) {
                  video.pause();
                  video.currentTime = playbackEndMs / 1000;
                  setPlaybackEndMs(null);
                }
              }}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <div className="video-placeholder">動画が未選択です</div>
          )}
        </div>
        <section className="timeline-panel">
          <VideoControls
            variant="playback"
            videoFileName={videoFileName}
            role={role}
            labelsLoaded={Boolean(labels)}
            stepMs={stepMs}
            currentMs={currentMs}
            durationMs={durationMs}
            isPlaying={isPlaying}
            canUseTimeline={canUseTimeline}
            canExport={canExport}
            canSaveAnn={canSaveAnn}
            onOpenVideo={handleOpenVideo}
            onOpenLabels={handleOpenLabels}
            onOpenAnn={handleOpenAnn}
            onSaveAnn={handleSaveAnn}
            onExportCsv={handleExportCsv}
            onRoleChange={setRole}
            onTogglePlay={handleTogglePlay}
            onSeekByStep={handleSeekByStep}
            onStepChange={handleStepChange}
          />
          <TimelineCanvas
            segments={segments}
            durationMs={durationMs}
            currentMs={currentMs}
            stepMs={stepMs}
            labels={labels}
            canEdit={canUseTimeline}
            onSegmentsChange={(next) => setSegments(sortSegments(next))}
            onPlaySegment={handlePlaySegment}
            onSeekTo={handleSeekTo}
            onError={(message) => showStatus("error", message)}
          />
        </section>
      </main>
    </div>
  );
}
