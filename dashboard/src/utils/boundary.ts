/**
 * Calculates epoch-aligned window boundaries for fixed_window and sliding_window_counter.
 * These algorithms compute windows based on (nowMs % windowMs).
 */
export function computeNextEpochBoundary(windowSec: number, nowMs = Date.now()): {
  boundaryEpochMs: number;
  timeUntilBoundaryMs: number;
} {
  const windowMs = windowSec * 1000;
  if (windowMs <= 0) {
    return { boundaryEpochMs: nowMs, timeUntilBoundaryMs: 0 };
  }
  const timeIntoWindow = nowMs % windowMs;
  const timeUntilBoundaryMs = windowMs - timeIntoWindow;
  const boundaryEpochMs = nowMs + timeUntilBoundaryMs;

  return {
    boundaryEpochMs,
    timeUntilBoundaryMs,
  };
}

