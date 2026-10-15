import { RateLimiter } from '../../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule } from '../../core/types.js';

export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/**
 * Base abstract class for in-memory rate limiting algorithms.
 * Supports clock injection for precise testing of time windows,
 * burst conditions, and clock drift.
 */
export abstract class BaseMemoryLimiter implements RateLimiter {
  protected readonly clock: Clock;

  constructor(clock: Clock = new SystemClock()) {
    this.clock = clock;
  }

  abstract check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;

  abstract reset(key: string): Promise<void>;

  async close(): Promise<void> {
    // In-memory limiters by default have no persistent network handles
    return Promise.resolve();
  }
}
