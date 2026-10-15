import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock, SystemClock } from './base.js';

/**
 * Sliding Window Log rate limiter.
 *
 * Keeps a timestamp log for each request. Discards timestamps older than
 * (now - windowSec). Provides 100% boundary accuracy at the cost of O(N) memory.
 */
export class MemorySlidingWindowLogLimiter extends BaseMemoryLimiter {
  private readonly state = new Map<string, number[]>();

  constructor(clock: Clock = new SystemClock()) {
    super(clock);
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const now = this.clock.now();
    const windowMs = rule.windowSec * 1000;
    const windowStart = now - windowMs;

    let timestamps = this.state.get(key);
    if (!timestamps) {
      timestamps = [];
      this.state.set(key, timestamps);
    } else {
      // Remove timestamps outside of the sliding window
      let validIndex = 0;
      while (validIndex < timestamps.length && timestamps[validIndex]! <= windowStart) {
        validIndex++;
      }
      if (validIndex > 0) {
        timestamps.splice(0, validIndex);
      }
    }

    const currentCount = timestamps.length;
    const oldestTimestamp = timestamps[0] ?? now;
    const timeToResetOldest = Math.max(0, oldestTimestamp + windowMs - now);

    if (currentCount + cost <= rule.limit) {
      for (let i = 0; i < cost; i++) {
        timestamps.push(now);
      }
      const remaining = rule.limit - timestamps.length;
      const resetMs = Math.max(0, (timestamps[0] ?? now) + windowMs - now);

      return {
        allowed: true,
        limit: rule.limit,
        remaining,
        resetMs,
        resetEpochMs: now + resetMs,
      };
    }

    // Over limit
    const remaining = Math.max(0, rule.limit - currentCount);
    const retryAfterSec = Math.max(1, Math.ceil(timeToResetOldest / 1000));

    return {
      allowed: false,
      limit: rule.limit,
      remaining,
      resetMs: timeToResetOldest,
      resetEpochMs: now + timeToResetOldest,
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
