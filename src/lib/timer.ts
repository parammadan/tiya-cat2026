// Wall-clock timer helpers. The deadline is stored with the attempt, so refreshing or reopening never extends it.
export const EXAM_MS = 40 * 60 * 1000;
export const WARNING_MS = 5 * 60 * 1000;

export function makeDeadline(startedAt: number, durationMs = EXAM_MS): number {
  return startedAt + durationMs;
}

export function remainingMs(now: number, deadline: number): number {
  return Math.max(0, deadline - now);
}

export function isExpired(now: number, deadline: number): boolean {
  return now >= deadline;
}

export function inWarning(now: number, deadline: number): boolean {
  const r = remainingMs(now, deadline);
  return r > 0 && r <= WARNING_MS;
}

/** mm:ss, rounding up so the display reads 40:00 at the start and 00:00 only at expiry. */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}
