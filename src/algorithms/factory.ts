import { RateLimiter } from '../core/limiter.interface.js';
import { AlgorithmType, RateLimitResult, RateLimitRule } from '../core/types.js';
import { UnsupportedAlgorithmError } from '../core/errors.js';
import { Clock, SystemClock } from './memory/base.js';
import { MemoryFixedWindowLimiter } from './memory/fixed-window.js';
import { MemoryTokenBucketLimiter } from './memory/token-bucket.js';
import { MemorySlidingWindowLogLimiter } from './memory/sliding-window-log.js';
import { MemorySlidingWindowCounterLimiter } from './memory/sliding-window-counter.js';
import { MemoryLeakyBucketLimiter } from './memory/leaky-bucket.js';

/**
 * Composite in-memory rate limiter using the Strategy Pattern.
 * Automatically delegates to the appropriate algorithm implementation
 * based on the rule configuration.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly strategies: Map<AlgorithmType, RateLimiter>;

  constructor(clock: Clock = new SystemClock()) {
    this.strategies = new Map<AlgorithmType, RateLimiter>([
      ['fixed_window', new MemoryFixedWindowLimiter(clock)],
      ['token_bucket', new MemoryTokenBucketLimiter(clock)],
      ['sliding_window_log', new MemorySlidingWindowLogLimiter(clock)],
      ['sliding_window_counter', new MemorySlidingWindowCounterLimiter(clock)],
      ['leaky_bucket', new MemoryLeakyBucketLimiter(clock)],
    ]);
  }

  getStrategy(algorithm: AlgorithmType): RateLimiter {
    const strategy = this.strategies.get(algorithm);
    if (!strategy) {
      throw new UnsupportedAlgorithmError(algorithm);
    }
    return strategy;
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const strategy = this.getStrategy(rule.algorithm);
    return strategy.check(key, rule, cost);
  }

  async reset(key: string): Promise<void> {
    for (const strategy of this.strategies.values()) {
      await strategy.reset(key);
    }
  }

  async close(): Promise<void> {
    for (const strategy of this.strategies.values()) {
      await strategy.close();
    }
  }
}
