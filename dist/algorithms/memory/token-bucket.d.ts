import { RateLimitResult, RateLimitRule } from '../../core/types.js';
import { BaseMemoryLimiter, Clock } from './base.js';
/**
 * Token Bucket rate limiter.
 *
 * Tokens are continuously added to a bucket at a rate of (limit / windowSec) tokens/sec,
 * up to a maximum capacity (burst ?? limit). Each request consumes 1 (or cost) tokens.
 * If enough tokens exist, the request is allowed; otherwise it is rejected.
 */
export declare class MemoryTokenBucketLimiter extends BaseMemoryLimiter {
    private readonly state;
    constructor(clock?: Clock);
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=token-bucket.d.ts.map