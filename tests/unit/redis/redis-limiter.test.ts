import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Redis } from 'ioredis';
import { RedisRateLimiter } from '../../../src/algorithms/redis/redis-limiter.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('RedisRateLimiter', () => {
  let mockRedis: Redis;
  let clock: MockClock;

  const rule: RateLimitRule = {
    algorithm: 'token_bucket',
    limit: 10,
    windowSec: 60,
  };

  beforeEach(() => {
    clock = new MockClock(100_000);
    mockRedis = {
      evalsha: vi.fn(),
      script: vi.fn().mockResolvedValue('loaded_sha'),
      del: vi.fn().mockResolvedValue(1),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    } as unknown as Redis;
  });

  it('should return allowed response when Lua script returns allowed=1', async () => {
    vi.spyOn(mockRedis, 'evalsha').mockResolvedValueOnce([1, 9, 60000]);

    const limiter = new RedisRateLimiter({
      redis: mockRedis,
      clock,
    });

    const result = await limiter.check('client-1', rule);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetMs).toBe(60000);
    expect(result.resetEpochMs).toBe(160000);
    expect(result.retryAfterSec).toBeUndefined();
  });

  it('should return rejected response with Retry-After when allowed=0', async () => {
    vi.spyOn(mockRedis, 'evalsha').mockResolvedValueOnce([0, 0, 15000]);

    const limiter = new RedisRateLimiter({
      redis: mockRedis,
      clock,
    });

    const result = await limiter.check('client-1', rule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBe(15000);
    expect(result.resetEpochMs).toBe(115000);
    expect(result.retryAfterSec).toBe(15);
  });

  it('should handle fail-open when Redis throws', async () => {
    vi.spyOn(mockRedis, 'evalsha').mockRejectedValue(new Error('Connection lost'));

    const limiter = new RedisRateLimiter({
      redis: mockRedis,
      failMode: 'fail_open',
      clock,
    });

    const result = await limiter.check('client-failopen', rule);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.resetMs).toBe(0);
  });

  it('should handle fail-closed when Redis throws', async () => {
    vi.spyOn(mockRedis, 'evalsha').mockRejectedValue(new Error('Connection lost'));

    const limiter = new RedisRateLimiter({
      redis: mockRedis,
      failMode: 'fail_closed',
      clock,
    });

    const result = await limiter.check('client-failclosed', rule);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterSec).toBe(60);
  });

  it('should delete all algorithm keys upon reset()', async () => {
    const limiter = new RedisRateLimiter({
      redis: mockRedis,
      keyPrefix: 'test_rl:',
    });

    await limiter.reset('user-to-reset');
    expect(mockRedis.del).toHaveBeenCalled();
    const calledArgs = (mockRedis.del as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] ?? [];
    expect(calledArgs).toContain('test_rl:token_bucket:user-to-reset');
    expect(calledArgs).toContain('test_rl:fixed_window:user-to-reset');
  });

  it('should handle init() and close() lifecycle', async () => {
    const limiter = new RedisRateLimiter({ redis: mockRedis });
    await limiter.init();
    expect(mockRedis.script).toHaveBeenCalled();

    await limiter.close();
    expect(mockRedis.quit).toHaveBeenCalled();
  });
});
