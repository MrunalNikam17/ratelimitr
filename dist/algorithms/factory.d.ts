import { RateLimiter } from '../core/limiter.interface.js';
import { AlgorithmType, RateLimitResult, RateLimitRule } from '../core/types.js';
import { Clock } from './memory/base.js';
/**
 * Composite in-memory rate limiter using the Strategy Pattern.
 * Automatically delegates to the appropriate algorithm implementation
 * based on the rule configuration.
 */
export declare class MemoryRateLimiter implements RateLimiter {
    private readonly strategies;
    constructor(clock?: Clock);
    getStrategy(algorithm: AlgorithmType): RateLimiter;
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=factory.d.ts.map