import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock, SystemClock } from './base.js';

interface TokenBucketState {
  tokens: number;
  lastRefillMs: number;
}

/**
 * Token Bucket rate limiter.
 *
 * Tokens are continuously added to a bucket at a rate of (limit / windowSec) tokens/sec,
 * up to a maximum capacity (burst ?? limit). Each request consumes 1 (or cost) tokens.
 * If enough tokens exist, the request is allowed; otherwise it is rejected.
 */
export class MemoryTokenBucketLimiter extends BaseMemoryLimiter {
  private readonly state = new Map<string, TokenBucketState>();

  constructor(clock: Clock = new SystemClock()) {
    super(clock);
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const now = this.clock.now();
    const capacity = rule.burst !== undefined && rule.burst > 0 ? rule.burst : rule.limit;
    const windowMs = rule.windowSec * 1000;
    const refillRatePerMs = rule.limit / windowMs; // tokens per millisecond

    let entry = this.state.get(key);

    if (!entry) {
      entry = {
        tokens: capacity,
        lastRefillMs: now,
      };
      this.state.set(key, entry);
    } else {
      // Calculate refilled tokens since last check
      const elapsedMs = Math.max(0, now - entry.lastRefillMs);
      const addedTokens = elapsedMs * refillRatePerMs;
      entry.tokens = Math.min(capacity, entry.tokens + addedTokens);
      entry.lastRefillMs = now;
    }

    if (entry.tokens >= cost) {
      entry.tokens -= cost;
      const remaining = Math.floor(entry.tokens);
      // Milliseconds until bucket is fully refilled to capacity
      const timeToFullMs = Math.ceil((capacity - entry.tokens) / refillRatePerMs);

      return {
        allowed: true,
        limit: capacity,
        remaining,
        resetMs: timeToFullMs,
        resetEpochMs: now + timeToFullMs,
      };
    }

    // Not enough tokens
    const deficit = cost - entry.tokens;
    const timeUntilAvailableMs = Math.ceil(deficit / refillRatePerMs);
    const retryAfterSec = Math.max(1, Math.ceil(timeUntilAvailableMs / 1000));
    const remaining = Math.max(0, Math.floor(entry.tokens));

    return {
      allowed: false,
      limit: capacity,
      remaining,
      resetMs: timeUntilAvailableMs,
      resetEpochMs: now + timeUntilAvailableMs,
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
