import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import {
  createSegmentAt,
  deleteSegment,
  isSegmentComplete,
  moveSegment,
  resizeSegmentEnd,
  resizeSegmentStart,
  updateSegmentLabel,
  updateSegmentText
} from "../lib/segments";
import { formatMs } from "../lib/time";
import { Label, Segment } from "../lib/types";
import TextOverlayEditor from "./TextOverlayEditor";

const LABEL_PADDING = 6;
const LABEL_BADGE_HEIGHT = 18;
const TICK_AREA_HEIGHT = 26;
const TRACK_TOP = TICK_AREA_HEIGHT + LABEL_BADGE_HEIGHT + LABEL_PADDING;
const TRACK_HEIGHT = 44;
const HANDLE_WIDTH = 10;
const TIMELINE_HEIGHT = TRACK_TOP + TRACK_HEIGHT + 32;
const MAX_TIMELINE_WIDTH = 16000;

const TICK_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
const MIN_TICK_PX = 60;

const getTickStep = (pixelsPerSecond: number) => {
  return (
    TICK_STEPS.find((step) => step * pixelsPerSecond >= MIN_TICK_PX) ??
    TICK_STEPS[TICK_STEPS.length - 1]
  );
};

const getMajorEvery = (tickStep: number) => {
  if (tickStep < 0.2) {
    return 10;
  }
  if (tickStep < 0.5) {
    return 5;
  }
  if (tickStep < 2) {
    return 5;
  }
  if (tickStep < 5) {
    return 4;
  }
  if (tickStep < 10) {
    return 3;
  }
  return 2;
};

interface TimelineCanvasProps {
  segments: Segment[];
  durationMs: number;
  currentMs: number;
  stepMs: number;
  labels: Label[] | null;
  canEdit: boolean;
  onSegmentsChange: (segments: Segment[]) => void;
  onPlaySegment: (startMs: number, endMs: number) => void;
  onSeekTo: (ms: number) => void;
  onError: (message: string) => void;
}

type DragState =
  | {
      type: "move";
      id: string;
      offsetMs: number;
      moved: boolean;
    }
  | {
      type: "resize-start" | "resize-end";
      id: string;
      moved: boolean;
    };

interface ContextMenuState {
  x: number;
  y: number;
  id: string;
  view: "root" | "labels";
}

interface EditState {
  id: string;
  rect: { left: number; top: number; width: number; height: number };
}

export default function TimelineCanvas({
  segments,
  durationMs,
  currentMs,
  stepMs,
  labels,
  canEdit,
  onSegmentsChange,
  onPlaySegment,
  onSeekTo,
  onError
}: TimelineCanvasProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(800);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [editing, setEditing] = useState<EditState | null>(null);
  const [labelMenuPos, setLabelMenuPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const labelMenuRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const scrubRef = useRef(false);
  const pendingClickRef = useRef<number | null>(null);
  const pendingClickIdRef = useRef<string | null>(null);

  const desiredPixelsPerSecond = Math.max(8, Math.min(200, (1000 / stepMs) * 6));
  const desiredTimelineWidth =
    durationMs > 0 ? (durationMs / 1000) * desiredPixelsPerSecond : viewportWidth;
  const widthScale =
    durationMs > 0 && desiredTimelineWidth > MAX_TIMELINE_WIDTH
      ? MAX_TIMELINE_WIDTH / desiredTimelineWidth
      : 1;
  const pixelsPerSecond = desiredPixelsPerSecond * widthScale;
  const timelineWidth = Math.max(
    viewportWidth,
    durationMs > 0 ? (durationMs / 1000) * pixelsPerSecond : viewportWidth
  );
  const snapThresholdMs = Math.max(50, (10 / pixelsPerSecond) * 1000);

  const timeToX = (ms: number) => {
    if (durationMs <= 0) {
      return 0;
    }
    return (ms / durationMs) * timelineWidth;
  };

  const xToTime = (x: number) => {
    if (durationMs <= 0) {
      return 0;
    }
    const clamped = Math.max(0, Math.min(timelineWidth, x));
    return (clamped / timelineWidth) * durationMs;
  };

  useLayoutEffect(() => {
    if (!scrollRef.current) {
      return;
    }
    const update = () => {
      setViewportWidth(scrollRef.current?.clientWidth ?? 800);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = timelineWidth;
    canvas.height = TIMELINE_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, timelineWidth, TIMELINE_HEIGHT);
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, timelineWidth, TIMELINE_HEIGHT);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TRACK_TOP + TRACK_HEIGHT + 10);
    ctx.lineTo(timelineWidth, TRACK_TOP + TRACK_HEIGHT + 10);
    ctx.stroke();

    const labelMap = new Map<number, string>();
    if (labels) {
      for (const label of labels) {
        labelMap.set(label.id, label.display);
      }
    }

    if (durationMs > 0) {
      const totalSeconds = durationMs / 1000;
      const tickStep = getTickStep(pixelsPerSecond);
      const majorEvery = getMajorEvery(tickStep);
      const tickCount = Math.ceil(totalSeconds / tickStep);
      const tickBase = TICK_AREA_HEIGHT;
      for (let i = 0; i <= tickCount; i += 1) {
        const seconds = i * tickStep;
        if (seconds > totalSeconds + 0.0001) {
          break;
        }
        const x = timeToX(seconds * 1000);
        const isMajor = i % majorEvery === 0;
        ctx.strokeStyle = isMajor ? "#475569" : "#1f2937";
        ctx.beginPath();
        ctx.moveTo(x, tickBase - (isMajor ? 10 : 6));
        ctx.lineTo(x, tickBase);
        ctx.stroke();

        if (isMajor) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "12px 'BIZ UDPGothic', 'Yu Gothic UI', sans-serif";
          ctx.fillText(formatMs(seconds * 1000), x + 4, tickBase - 12);
        }
      }
    }

    for (const seg of segments) {
      const startX = timeToX(seg.start_ms);
      const endX = Math.max(startX + 1, timeToX(seg.end_ms));
      const width = endX - startX;

      ctx.fillStyle = isSegmentComplete(seg)
        ? "rgba(34, 197, 94, 0.4)"
        : "rgba(59, 130, 246, 0.45)";
      ctx.fillRect(startX, TRACK_TOP, width, TRACK_HEIGHT);

      ctx.strokeStyle = isSegmentComplete(seg) ? "#22c55e" : "#60a5fa";
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, TRACK_TOP, width, TRACK_HEIGHT);

      ctx.fillStyle = "#111827";
      ctx.fillRect(startX, TRACK_TOP, HANDLE_WIDTH, TRACK_HEIGHT);
      ctx.fillRect(endX - HANDLE_WIDTH, TRACK_TOP, HANDLE_WIDTH, TRACK_HEIGHT);

      const text = seg.text.trim();
      if (text) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          startX + HANDLE_WIDTH + 4,
          TRACK_TOP,
          Math.max(0, width - HANDLE_WIDTH * 2 - 8),
          TRACK_HEIGHT
        );
        ctx.clip();
        ctx.fillStyle = "#f8fafc";
        ctx.font = "13px 'BIZ UDPGothic', 'Yu Gothic UI', sans-serif";
        ctx.fillText(text, startX + HANDLE_WIDTH + 6, TRACK_TOP + 26);
        ctx.restore();
      }

      if (seg.label_id != null) {
        const labelText =
          labelMap.get(seg.label_id) ?? `ID:${seg.label_id.toString()}`;
        ctx.font = "11px 'BIZ UDPGothic', 'Yu Gothic UI', sans-serif";
        const maxWidth = Math.max(0, timelineWidth - startX - 12);
        if (maxWidth > 16) {
          const labelX = startX + 2;
          const labelY = TRACK_TOP - LABEL_BADGE_HEIGHT - LABEL_PADDING;
          ctx.fillStyle = "#c7d2fe";
          ctx.fillText(labelText, labelX, labelY + 13, maxWidth);
        }
      }
    }

    if (durationMs > 0) {
      const playX = timeToX(currentMs);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, TIMELINE_HEIGHT);
      ctx.stroke();
    }
  }, [segments, durationMs, currentMs, timelineWidth, labels, pixelsPerSecond]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      setLabelMenuPos(null);
      setContextMenuPos(null);
      return;
    }
    if (contextMenu.view !== "labels") {
      setLabelMenuPos(null);
    }
  }, [contextMenu]);

  useLayoutEffect(() => {
    if (!contextMenu || contextMenu.view !== "labels" || !labelMenuRef.current) {
      return;
    }
    const rect = labelMenuRef.current.getBoundingClientRect();
    const margin = 12;
    let x = labelMenuPos?.x ?? contextMenu.x + 200;
    let y = labelMenuPos?.y ?? contextMenu.y;

    if (rect.right > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - margin - rect.width);
    }
    if (rect.left < margin) {
      x = margin;
    }
    if (rect.bottom > window.innerHeight - margin) {
      y = Math.max(margin, y - (rect.bottom - (window.innerHeight - margin)));
    }
    if (rect.top < margin) {
      y = margin;
    }

    if (!labelMenuPos || labelMenuPos.x !== x || labelMenuPos.y !== y) {
      setLabelMenuPos({ x, y });
    }
  }, [contextMenu, labelMenuPos]);

  useLayoutEffect(() => {
    if (!contextMenu || contextMenu.view !== "root" || !contextMenuRef.current) {
      return;
    }
    const rect = contextMenuRef.current.getBoundingClientRect();
    const margin = 12;
    let x = contextMenuPos?.x ?? contextMenu.x;
    let y = contextMenuPos?.y ?? contextMenu.y;

    if (rect.right > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - margin - rect.width);
    }
    if (rect.left < margin) {
      x = margin;
    }
    if (rect.bottom > window.innerHeight - margin) {
      y = Math.max(margin, y - (rect.bottom - (window.innerHeight - margin)));
    }
    if (rect.top < margin) {
      y = margin;
    }

    if (!contextMenuPos || contextMenuPos.x !== x || contextMenuPos.y !== y) {
      setContextMenuPos({ x, y });
    }
  }, [contextMenu, contextMenuPos]);

  const clearPendingClick = () => {
    if (pendingClickRef.current != null) {
      window.clearTimeout(pendingClickRef.current);
      pendingClickRef.current = null;
      pendingClickIdRef.current = null;
    }
  };

  const getSegmentAt = (x: number, y: number) => {
    if (y < TRACK_TOP || y > TRACK_TOP + TRACK_HEIGHT) {
      return null;
    }

    for (const seg of segments) {
      const startX = timeToX(seg.start_ms);
      const endX = timeToX(seg.end_ms);
      if (x < startX || x > endX) {
        continue;
      }
      if (x - startX <= HANDLE_WIDTH) {
        return { segment: seg, handle: "left" as const };
      }
      if (endX - x <= HANDLE_WIDTH) {
        return { segment: seg, handle: "right" as const };
      }
      return { segment: seg, handle: "body" as const };
    }

    return null;
  };

  const updateCursor = (
    canvas: HTMLCanvasElement,
    x: number,
    y: number
  ) => {
    if (!canEdit || durationMs <= 0) {
      canvas.style.cursor = "not-allowed";
      return;
    }
    if (y < TRACK_TOP) {
      canvas.style.cursor = "ew-resize";
      return;
    }
    const hit = getSegmentAt(x, y);
    if (!hit) {
      canvas.style.cursor = "crosshair";
      return;
    }
    if (hit.handle === "left" || hit.handle === "right") {
      canvas.style.cursor = "ew-resize";
      return;
    }
    canvas.style.cursor = "pointer";
  };

  const startEditing = (id: string) => {
    const segment = segments.find((seg) => seg.id === id);
    if (!segment) {
      return;
    }
    const startX = timeToX(segment.start_ms);
    const endX = Math.max(startX + 1, timeToX(segment.end_ms));
    setEditing({
      id,
      rect: {
        left: startX,
        top: TRACK_TOP,
        width: endX - startX,
        height: TRACK_HEIGHT
      }
    });
    setContextMenu(null);
    clearPendingClick();
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (!canEdit || durationMs <= 0) {
      onError("動画が未選択のためタイムライン操作ができません。");
      return;
    }
    setContextMenu(null);

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    updateCursor(event.currentTarget, x, y);

    if (y < TRACK_TOP) {
      scrubRef.current = true;
      onSeekTo(xToTime(x));
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    const hit = getSegmentAt(x, y);

    if (!hit) {
      if (y > TRACK_TOP + TRACK_HEIGHT) {
        return;
      }
      clearPendingClick();
      const result = createSegmentAt(segments, xToTime(x), durationMs);
      if (result.error) {
        onError(result.error);
      } else {
        onSegmentsChange(result.segments);
      }
      return;
    }

    const { segment, handle } = hit;
    if (handle === "left") {
      dragRef.current = { type: "resize-start", id: segment.id, moved: false };
    } else if (handle === "right") {
      dragRef.current = { type: "resize-end", id: segment.id, moved: false };
    } else {
      const offsetMs = xToTime(x) - segment.start_ms;
      dragRef.current = { type: "move", id: segment.id, offsetMs, moved: false };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    updateCursor(event.currentTarget, x, y);

    if (scrubRef.current) {
      onSeekTo(xToTime(x));
      return;
    }

    if (!dragRef.current) {
      return;
    }
    const time = xToTime(x);
    dragRef.current.moved = true;
    clearPendingClick();

    if (dragRef.current.type === "move") {
      const targetSeg = segments.find((seg) => seg.id === dragRef.current?.id);
      if (!targetSeg) {
        return;
      }
      const length = targetSeg.end_ms - targetSeg.start_ms;
      const nextSegments = moveSegment(
        segments,
        dragRef.current.id,
        (() => {
          const proposedStart = time - dragRef.current.offsetMs;
          const startDiff = Math.abs(proposedStart - currentMs);
          const endDiff = Math.abs(proposedStart + length - currentMs);
          if (Math.min(startDiff, endDiff) <= snapThresholdMs) {
            return startDiff <= endDiff ? currentMs : currentMs - length;
          }
          return proposedStart;
        })(),
        durationMs
      );
      onSegmentsChange(nextSegments);
      return;
    }

    if (dragRef.current.type === "resize-start") {
      const nextSegments = resizeSegmentStart(
        segments,
        dragRef.current.id,
        Math.abs(time - currentMs) <= snapThresholdMs ? currentMs : time,
        durationMs
      );
      onSegmentsChange(nextSegments);
      return;
    }

    const nextSegments = resizeSegmentEnd(
      segments,
      dragRef.current.id,
      Math.abs(time - currentMs) <= snapThresholdMs ? currentMs : time,
      durationMs
    );
    onSegmentsChange(nextSegments);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const dragState = dragRef.current;
    const wasScrub = scrubRef.current;
    dragRef.current = null;
    scrubRef.current = false;
    if (dragState || wasScrub) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasScrub) {
      return;
    }
    if (!dragState || dragState.moved) {
      return;
    }

    if (dragState.type === "move") {
      const id = dragState.id;
      if (pendingClickRef.current && pendingClickIdRef.current === id) {
        clearPendingClick();
        startEditing(id);
        return;
      }

      clearPendingClick();
      pendingClickIdRef.current = id;
      pendingClickRef.current = window.setTimeout(() => {
        pendingClickRef.current = null;
        pendingClickIdRef.current = null;
        const seg = segments.find((segment) => segment.id === id);
        if (seg) {
          onPlaySegment(seg.start_ms, seg.end_ms);
        }
      }, 250);
    }
  };

  const handleContextMenu = (event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (!canEdit || durationMs <= 0) {
      onError("動画が未選択のためタイムライン操作ができません。");
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = getSegmentAt(x, y);
    if (!hit) {
      setContextMenu(null);
      return;
    }
    setContextMenuPos(null);
    setLabelMenuPos(null);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      id: hit.segment.id,
      view: "root"
    });
  };

  const handleLabelSelect = (segmentId: string, labelId: number) => {
    onSegmentsChange(updateSegmentLabel(segments, segmentId, labelId));
    setContextMenu(null);
  };

  const handleDelete = (segmentId: string) => {
    onSegmentsChange(deleteSegment(segments, segmentId));
    setContextMenu(null);
  };

  const activeEditing = editing
    ? segments.find((seg) => seg.id === editing.id)
    : null;

  return (
    <section className="timeline">
      <div className="timeline-scroll" ref={scrollRef}>
        <div
          className="timeline-surface"
          style={{ width: timelineWidth, height: TIMELINE_HEIGHT }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={handleContextMenu}
          />
          {editing && activeEditing && (
            <TextOverlayEditor
              rect={editing.rect}
              initialText={activeEditing.text}
              onCommit={(value) => {
                onSegmentsChange(updateSegmentText(segments, editing.id, value));
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
          {contextMenu && (
            <>
              <div
                className="context-backdrop"
                onPointerDown={() => setContextMenu(null)}
              />
              <div
                ref={contextMenuRef}
                className="context-menu"
                style={{
                  left: contextMenuPos?.x ?? contextMenu.x,
                  top: contextMenuPos?.y ?? contextMenu.y
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() =>
                    labels && labels.length > 0
                      ? (setContextMenu({ ...contextMenu, view: "labels" }),
                        setLabelMenuPos({
                          x: (contextMenuPos?.x ?? contextMenu.x) + 200,
                          y: contextMenuPos?.y ?? contextMenu.y
                        }))
                      : undefined
                  }
                  disabled={!labels || labels.length === 0}
                  className="context-label-entry"
                >
                  ラベル &gt;
                </button>
                {!labels || labels.length === 0 ? (
                  <div className="context-disabled">ラベルXML未ロード</div>
                ) : null}
                <div className="context-sep" />
                <button
                  type="button"
                  onClick={() => startEditing(contextMenu.id)}
                >
                  文字起こしを入力
                </button>
                <button type="button" onClick={() => handleDelete(contextMenu.id)}>
                  削除
                </button>
              </div>
              {contextMenu.view === "labels" && labels && labels.length > 0 && (
                <div
                  ref={labelMenuRef}
                  className="context-menu context-submenu"
                  style={{
                    left: labelMenuPos?.x ?? contextMenu.x + 200,
                    top: labelMenuPos?.y ?? contextMenu.y
                  }}
                >
                  <div className="context-title">ラベルを選択</div>
                  <div className="context-list">
                    {labels.map((label) => (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => handleLabelSelect(contextMenu.id, label.id)}
                      >
                        {label.display} ({label.id})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {!canEdit && (
        <div className="timeline-hint">動画未選択のため操作不可です。</div>
      )}
    </section>
  );
}
