import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock, SystemClock } from './base.js';

interface LeakyBucketState {
  waterLevel: number;
  lastLeakMs: number;
}

/**
 * Leaky Bucket rate limiter (Traffic Shaping).
 *
 * Models a bucket that leaks at a constant rate of (limit / windowSec).
 * Incoming requests add 'water' (cost). If the added water causes the bucket
 * to exceed capacity (burst ?? limit), the request overflows and is rejected.
 */
export class MemoryLeakyBucketLimiter extends BaseMemoryLimiter {
  private readonly state = new Map<string, LeakyBucketState>();

  constructor(clock: Clock = new SystemClock()) {
    super(clock);
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const now = this.clock.now();
    const capacity = rule.burst !== undefined && rule.burst > 0 ? rule.burst : rule.limit;
    const windowMs = rule.windowSec * 1000;
    const leakRatePerMs = rule.limit / windowMs;

    let entry = this.state.get(key);

    if (!entry) {
      entry = { waterLevel: 0, lastLeakMs: now };
      this.state.set(key, entry);
    } else {
      const elapsedMs = Math.max(0, now - entry.lastLeakMs);
      const leaked = elapsedMs * leakRatePerMs;
      entry.waterLevel = Math.max(0, entry.waterLevel - leaked);
      entry.lastLeakMs = now;
    }

    if (entry.waterLevel + cost <= capacity) {
      entry.waterLevel += cost;
      const remaining = Math.max(0, Math.floor(capacity - entry.waterLevel));
      const timeToDrainMs = Math.ceil(entry.waterLevel / leakRatePerMs);

      return {
        allowed: true,
        limit: capacity,
        remaining,
        resetMs: timeToDrainMs,
        resetEpochMs: now + timeToDrainMs,
      };
    }

    // Bucket overflows
    const deficit = entry.waterLevel + cost - capacity;
    const timeUntilSlotMs = Math.ceil(deficit / leakRatePerMs);
    const retryAfterSec = Math.max(1, Math.ceil(timeUntilSlotMs / 1000));
    const remaining = Math.max(0, Math.floor(capacity - entry.waterLevel));

    return {
      allowed: false,
      limit: capacity,
      remaining,
      resetMs: timeUntilSlotMs,
      resetEpochMs: now + timeUntilSlotMs,
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
