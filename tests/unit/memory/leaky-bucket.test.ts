import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLeakyBucketLimiter } from '../../../src/algorithms/memory/leaky-bucket.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('MemoryLeakyBucketLimiter', () => {
  let clock: MockClock;
  let limiter: MemoryLeakyBucketLimiter;

  // 10 units per 10 seconds = 1 unit/sec leak rate. Capacity = 10.
  const rule: RateLimitRule = {
    algorithm: 'leaky_bucket',
    limit: 10,
    windowSec: 10,
  };

  beforeEach(() => {
    clock = new MockClock(500_000);
    limiter = new MemoryLeakyBucketLimiter(clock);
  });

  it('should accept requests until bucket capacity is full', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await limiter.check('user-1', rule);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(10 - (i + 1));
    }

    // 11th request overflows bucket
    const overflow = await limiter.check('user-1', rule);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
    expect(overflow.resetMs).toBe(1000);
    expect(overflow.retryAfterSec).toBe(1);
  });

  it('should leak water at a constant rate over time', async () => {
    // Fill completely
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', rule);
    }

    // Overflow
    expect((await limiter.check('user-1', rule)).allowed).toBe(false);

    // Advance 4,000 ms => 4 units leaked
    clock.advance(4000);

    const r1 = await limiter.check('user-1', rule);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(3); // was 4 leaked, consumed 1 => 3 remaining

    const r2 = await limiter.check('user-1', rule);
    expect(r2.allowed).toBe(true);
  });

  it('should support custom burst capacity', async () => {
    const burstRule: RateLimitRule = {
      algorithm: 'leaky_bucket',
      limit: 10,
      windowSec: 10,
      burst: 15,
    };

    for (let i = 0; i < 15; i++) {
      const res = await limiter.check('user-burst', burstRule);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(15);
    }

    const blocked = await limiter.check('user-burst', burstRule);
    expect(blocked.allowed).toBe(false);
  });

  it('should handle multi-cost input', async () => {
    const r1 = await limiter.check('user-1', rule, 6);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(4);

    // 5 exceeds remaining 4
    const r2 = await limiter.check('user-1', rule, 5);
    expect(r2.allowed).toBe(false);
    expect(r2.remaining).toBe(4);
  });

  it('should support reset and clear', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', rule);
    }
    expect((await limiter.check('user-1', rule)).allowed).toBe(false);

    await limiter.reset('user-1');
    const fresh = await limiter.check('user-1', rule);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(9);

    await limiter.clear();
  });
});
