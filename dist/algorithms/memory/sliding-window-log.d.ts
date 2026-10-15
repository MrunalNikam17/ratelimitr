import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock } from './base.js';
/**
 * Sliding Window Log rate limiter.
 *
 * Keeps a timestamp log for each request. Discards timestamps older than
 * (now - windowSec). Provides 100% boundary accuracy at the cost of O(N) memory.
 */
export declare class MemorySlidingWindowLogLimiter extends BaseMemoryLimiter {
    private readonly state;
    constructor(clock?: Clock);
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=sliding-window-log.d.ts.map