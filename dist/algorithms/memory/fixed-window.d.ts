import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock } from './base.js';
/**
 * Fixed Window Counter rate limiter.
 *
 * Divides time into fixed discrete windows (e.g., 60 seconds).
 * Tracks count of requests within current window. Resets to 0 when
 * a new window begins.
 */
export declare class MemoryFixedWindowLimiter extends BaseMemoryLimiter {
    private readonly state;
    constructor(clock?: Clock);
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=fixed-window.d.ts.map