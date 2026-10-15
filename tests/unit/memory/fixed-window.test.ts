import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryFixedWindowLimiter } from '../../../src/algorithms/memory/fixed-window.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('MemoryFixedWindowLimiter', () => {
  let clock: MockClock;
  let limiter: MemoryFixedWindowLimiter;
  const standardRule: RateLimitRule = {
    algorithm: 'fixed_window',
    limit: 5,
    windowSec: 10,
  };

  beforeEach(() => {
    // Start at a known alignment: 100,000 ms
    clock = new MockClock(100_000);
    limiter = new MemoryFixedWindowLimiter(clock);
  });

  it('should allow requests within the limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await limiter.check('client-1', standardRule);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(5 - (i + 1));
      expect(res.limit).toBe(5);
      expect(res.resetMs).toBe(10_000); // 100_000 + 10_000 - 100_000
    }
  });

  it('should reject requests exceeding the limit with accurate Retry-After', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.check('client-1', standardRule);
    }

    // Advance 3 seconds into the 10-second window
    clock.advance(3000); // now = 103,000. Reset is at 110,000 (7,000 ms remaining)

    const blocked = await limiter.check('client-1', standardRule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBe(7000);
    expect(blocked.retryAfterSec).toBe(7);
  });

  it('should reset quota when advancing to the next window', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.check('client-1', standardRule);
    }

    // Exceeded
    const blocked = await limiter.check('client-1', standardRule);
    expect(blocked.allowed).toBe(false);

    // Advance past the window (10 seconds)
    clock.advance(10_000);

    const fresh = await limiter.check('client-1', standardRule);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(4);
  });

  it('should handle exact window boundary transitions', async () => {
    // Current window: [100_000, 110_000)
    for (let i = 0; i < 5; i++) {
      await limiter.check('client-1', standardRule);
    }

    // Exactly 1ms before window expires: still blocked
    clock.set(109_999);
    const beforeBoundary = await limiter.check('client-1', standardRule);
    expect(beforeBoundary.allowed).toBe(false);
    expect(beforeBoundary.resetMs).toBe(1);
    expect(beforeBoundary.retryAfterSec).toBe(1);

    // Exactly at window boundary: new window starts, allowed
    clock.set(110_000);
    const atBoundary = await limiter.check('client-1', standardRule);
    expect(atBoundary.allowed).toBe(true);
    expect(atBoundary.remaining).toBe(4);
    expect(atBoundary.resetMs).toBe(10_000);
  });

  it('should support multi-cost consumption', async () => {
    const res1 = await limiter.check('client-1', standardRule, 3);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    // Requesting 3 more exceeds remaining (2)
    const res2 = await limiter.check('client-1', standardRule, 3);
    expect(res2.allowed).toBe(false);
    expect(res2.remaining).toBe(2);

    // Requesting 2 should still be allowed
    const res3 = await limiter.check('client-1', standardRule, 2);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('should isolate limits across different keys', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.check('client-A', standardRule);
    }

    const blockedA = await limiter.check('client-A', standardRule);
    expect(blockedA.allowed).toBe(false);

    const allowedB = await limiter.check('client-B', standardRule);
    expect(allowedB.allowed).toBe(true);
    expect(allowedB.remaining).toBe(4);
  });

  it('should immediately reset key when reset() is called', async () => {
    for (let i = 0; i < 5; i++) {
      await limiter.check('client-1', standardRule);
    }
    expect((await limiter.check('client-1', standardRule)).allowed).toBe(false);

    await limiter.reset('client-1');

    const afterReset = await limiter.check('client-1', standardRule);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(4);
  });
});
