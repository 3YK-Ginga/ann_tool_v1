export function clampMs(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.round(ms / 100) / 10;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds - minutes * 60;
  if (seconds >= 60) {
    minutes += 1;
    seconds -= 60;
  }
  const minStr = minutes.toString().padStart(2, "0");
  const secStr = seconds.toFixed(1).padStart(4, "0");
  return `${minStr}:${secStr}`;
}