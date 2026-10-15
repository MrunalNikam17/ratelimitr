import { RateLimiter } from '../../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule } from '../../core/types.js';
export interface Clock {
    now(): number;
}
export declare class SystemClock implements Clock {
    now(): number;
}
/**
 * Base abstract class for in-memory rate limiting algorithms.
 * Supports clock injection for precise testing of time windows,
 * burst conditions, and clock drift.
 */
export declare abstract class BaseMemoryLimiter implements RateLimiter {
    protected readonly clock: Clock;
    constructor(clock?: Clock);
    abstract check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    abstract reset(key: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map