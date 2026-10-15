import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock, SystemClock } from './base.js';

interface FixedWindowState {
  windowStart: number;
  count: number;
}

/**
 * Fixed Window Counter rate limiter.
 *
 * Divides time into fixed discrete windows (e.g., 60 seconds).
 * Tracks count of requests within current window. Resets to 0 when
 * a new window begins.
 */
export class MemoryFixedWindowLimiter extends BaseMemoryLimiter {
  private readonly state = new Map<string, FixedWindowState>();

  constructor(clock: Clock = new SystemClock()) {
    super(clock);
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const now = this.clock.now();
    const windowMs = rule.windowSec * 1000;
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const resetEpochMs = currentWindowStart + windowMs;
    const resetMs = Math.max(0, resetEpochMs - now);

    let entry = this.state.get(key);

    if (!entry || entry.windowStart < currentWindowStart) {
      entry = { windowStart: currentWindowStart, count: 0 };
      this.state.set(key, entry);
    }

    if (entry.count + cost <= rule.limit) {
      entry.count += cost;
      const remaining = rule.limit - entry.count;
      return {
        allowed: true,
        limit: rule.limit,
        remaining,
        resetMs,
        resetEpochMs,
      };
    }

    const remaining = Math.max(0, rule.limit - entry.count);
    const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));

    return {
      allowed: false,
      limit: rule.limit,
      remaining,
      resetMs,
      resetEpochMs,
      retryAfterSec,
    };
  }

  async reset(key: string): Promise<void> {
    this.state.delete(key);
  }

  async clear(): Promise<void> {
    this.state.clear();
  }
}
