import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock } from './base.js';
/**
 * Sliding Window Counter (Weighted Approximation) rate limiter.
 *
 * Approximates a sliding window by weighting the count from the previous
 * fixed window based on how far we are into the current fixed window:
 *   estimated = prevCount * (1 - (now % windowMs) / windowMs) + currentCount
 *
 * Provides smooth rate limiting without O(N) memory overhead (O(1) state).
 */
export declare class MemorySlidingWindowCounterLimiter extends BaseMemoryLimiter {
    private readonly state;
    constructor(clock?: Clock);
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=sliding-window-counter.d.ts.map