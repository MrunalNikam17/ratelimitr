import type { Redis } from 'ioredis';
import { RateLimiter } from '../../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule, FailMode } from '../../core/types.js';
import { LuaScriptManager } from './lua-manager.js';
import { Clock, SystemClock } from '../memory/base.js';

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
export class RedisRateLimiter implements RateLimiter {
  private readonly redis: Redis;
  private readonly luaManager: LuaScriptManager;
  private readonly failMode: FailMode;
  private readonly keyPrefix: string;
  private readonly clock: Clock;

  constructor(options: RedisLimiterOptions) {
    this.redis = options.redis;
    this.failMode = options.failMode ?? 'fail_closed';
    this.keyPrefix = options.keyPrefix ?? 'ratelimit:';
    this.clock = options.clock ?? new SystemClock();
    this.luaManager = new LuaScriptManager();
  }

  async init(): Promise<void> {
    try {
      await this.luaManager.loadScripts(this.redis);
    } catch {
      // If redis is not connected yet, scripts will load on first execution fallback
    }
  }

  async check(key: string, rule: RateLimitRule, cost = 1): Promise<RateLimitResult> {
    const nowMs = this.clock.now();
    const redisKey = `${this.keyPrefix}${rule.algorithm}:${key}`;
    const burst = rule.burst !== undefined ? rule.burst : rule.limit;

    try {
      const [allowedNum, remaining, resetMs] = await this.luaManager.execute(
        this.redis,
        rule.algorithm,
        [redisKey],
        [rule.limit, rule.windowSec, cost, nowMs, burst],
      );

      const allowed = allowedNum === 1;
      const resetEpochMs = nowMs + resetMs;

      if (allowed) {
        return {
          allowed: true,
          limit: burst,
          remaining: Math.max(0, remaining),
          resetMs,
          resetEpochMs,
        };
      }

      const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));
      return {
        allowed: false,
        limit: burst,
        remaining: Math.max(0, remaining),
        resetMs,
        resetEpochMs,
        retryAfterSec,
      };
    } catch {
      // Handle Redis failure according to configured failMode
      if (this.failMode === 'fail_open') {
        return {
          allowed: true,
          limit: burst,
          remaining: 1,
          resetMs: 0,
          resetEpochMs: nowMs,
        };
      }

      // fail_closed
      const resetMs = rule.windowSec * 1000;
      return {
        allowed: false,
        limit: burst,
        remaining: 0,
        resetMs,
        resetEpochMs: nowMs + resetMs,
        retryAfterSec: rule.windowSec,
      };
    }
  }

  async reset(key: string): Promise<void> {
    const algorithms = [
      'fixed_window',
      'sliding_window_log',
      'sliding_window_counter',
      'token_bucket',
      'leaky_bucket',
    ];
    const keys = algorithms.map((alg) => `${this.keyPrefix}${alg}:${key}`);
    keys.push(...algorithms.map((alg) => `${this.keyPrefix}${alg}:${key}:seq`));
    await this.redis.del(...keys);
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => {
      this.redis.disconnect();
    });
  }
}
