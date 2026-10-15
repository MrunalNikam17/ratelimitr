import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock } from './base.js';
/**
 * Leaky Bucket rate limiter (Traffic Shaping).
 *
 * Models a bucket that leaks at a constant rate of (limit / windowSec).
 * Incoming requests add 'water' (cost). If the added water causes the bucket
 * to exceed capacity (burst ?? limit), the request overflows and is rejected.
 */
export declare class MemoryLeakyBucketLimiter extends BaseMemoryLimiter {
    private readonly state;
    constructor(clock?: Clock);
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=leaky-bucket.d.ts.map