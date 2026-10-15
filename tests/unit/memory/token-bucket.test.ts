import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryTokenBucketLimiter } from '../../../src/algorithms/memory/token-bucket.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('MemoryTokenBucketLimiter', () => {
  let clock: MockClock;
  let limiter: MemoryTokenBucketLimiter;

  // 10 tokens per 10 seconds => 1 token per 1,000 ms (0.001 token/ms)
  const standardRule: RateLimitRule = {
    algorithm: 'token_bucket',
    limit: 10,
    windowSec: 10,
  };

  beforeEach(() => {
    clock = new MockClock(1_000_000);
    limiter = new MemoryTokenBucketLimiter(clock);
  });

  it('should initialize with full capacity and allow burst up to limit', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await limiter.check('user-1', standardRule);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(10 - (i + 1));
      expect(res.limit).toBe(10);
    }

    // 11th request immediately rejected
    const blocked = await limiter.check('user-1', standardRule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // Deficit is 1 token. At 1 token / 1000ms, reset is in 1000ms
    expect(blocked.resetMs).toBe(1000);
    expect(blocked.retryAfterSec).toBe(1);
  });

  it('should refill tokens accurately over time', async () => {
    // Consume all 10 tokens
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', standardRule);
    }

    // Now empty
    expect((await limiter.check('user-1', standardRule)).allowed).toBe(false);

    // Advance 3,000 ms => 3 tokens should have refilled
    clock.advance(3000);

    const res1 = await limiter.check('user-1', standardRule);
    expect(res1.allowed).toBe(true);
    // Was 3, consumed 1 => 2 remaining
    expect(res1.remaining).toBe(2);

    const res2 = await limiter.check('user-1', standardRule);
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await limiter.check('user-1', standardRule);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);

    // Now 0 remaining, blocked again
    const res4 = await limiter.check('user-1', standardRule);
    expect(res4.allowed).toBe(false);
  });

  it('should not accumulate tokens beyond maximum capacity', async () => {
    // Key starts full at 10 tokens
    // Wait for 100 seconds (10x window)
    clock.advance(100_000);

    // Should only be able to consume 10 tokens, not 100
    for (let i = 0; i < 10; i++) {
      const res = await limiter.check('user-1', standardRule);
      expect(res.allowed).toBe(true);
    }

    const blocked = await limiter.check('user-1', standardRule);
    expect(blocked.allowed).toBe(false);
  });

  it('should honor custom burst parameter when specified', async () => {
    const burstRule: RateLimitRule = {
      algorithm: 'token_bucket',
      limit: 10, // 10 tokens per 10s = 1 token/sec refill
      windowSec: 10,
      burst: 15, // initial bucket holds 15 tokens
    };

    // Can immediately consume 15 tokens
    for (let i = 0; i < 15; i++) {
      const res = await limiter.check('user-burst', burstRule);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(15);
      expect(res.remaining).toBe(15 - (i + 1));
    }

    // 16th blocked
    const blocked = await limiter.check('user-burst', burstRule);
    expect(blocked.allowed).toBe(false);
  });

  it('should handle fractional token refills with high precision', async () => {
    // Empty the bucket
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', standardRule);
    }

    // Advance 500ms => 0.5 tokens. Not enough for cost = 1
    clock.advance(500);
    const blocked = await limiter.check('user-1', standardRule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0); // Math.floor(0.5)

    // Advance another 500ms => now 1.0 token total
    clock.advance(500);
    const allowed = await limiter.check('user-1', standardRule);
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(0);
  });

  it('should handle clock drift or backward time jumps gracefully', async () => {
    await limiter.check('user-1', standardRule); // 9 remaining

    // Clock steps backwards by 5,000 ms
    clock.advance(-5000);

    // Should not crash or produce negative/corrupted tokens
    const res = await limiter.check('user-1', standardRule);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(8);
  });

  it('should support varying request costs', async () => {
    // Consume 6 tokens at once
    const res1 = await limiter.check('user-1', standardRule, 6);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(4);

    // Trying to consume 5 tokens when only 4 exist
    const res2 = await limiter.check('user-1', standardRule, 5);
    expect(res2.allowed).toBe(false);
    expect(res2.remaining).toBe(4); // remaining quota intact

    // Deficit is 5 - 4 = 1 token => 1,000ms until available
    expect(res2.resetMs).toBe(1000);

    // Consume the remaining 4 tokens
    const res3 = await limiter.check('user-1', standardRule, 4);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('should reset bucket state upon reset()', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', standardRule);
    }
    expect((await limiter.check('user-1', standardRule)).allowed).toBe(false);

    await limiter.reset('user-1');

    const fresh = await limiter.check('user-1', standardRule);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(9);
  });
});
