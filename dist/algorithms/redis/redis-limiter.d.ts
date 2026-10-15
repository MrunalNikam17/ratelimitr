import type { Redis } from 'ioredis';
import { RateLimiter } from '../../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule, FailMode } from '../../core/types.js';
import { Clock } from '../memory/base.js';
export interface RedisLimiterOptions {
    redis: Redis;
    failMode?: FailMode;
    keyPrefix?: string;
    clock?: Clock;
}
/**
 * Distributed Redis Rate Limiter.
 *
 * Executes atomic Lua scripts via EVALSHA across Redis instances.
 * Guarantees zero race conditions under high concurrency and provides
 * configurable fail-open / fail-closed resiliency when Redis is unreachable.
 */
export declare class RedisRateLimiter implements RateLimiter {
    private readonly redis;
    private readonly luaManager;
    private readonly failMode;
    private readonly keyPrefix;
    private readonly clock;
    constructor(options: RedisLimiterOptions);
    init(): Promise<void>;
    check(key: string, rule: RateLimitRule, cost?: number): Promise<RateLimitResult>;
    reset(key: string): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=redis-limiter.d.ts.map