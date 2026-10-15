import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySlidingWindowLogLimiter } from '../../../src/algorithms/memory/sliding-window-log.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('MemorySlidingWindowLogLimiter', () => {
  let clock: MockClock;
  let limiter: MemorySlidingWindowLogLimiter;

  const rule: RateLimitRule = {
    algorithm: 'sliding_window_log',
    limit: 3,
    windowSec: 10, // 10,000 ms
  };

  beforeEach(() => {
    clock = new MockClock(100_000);
    limiter = new MemorySlidingWindowLogLimiter(clock);
  });

  it('should allow requests up to the limit', async () => {
    const r1 = await limiter.check('user-1', rule);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    clock.advance(2000); // 102_000
    const r2 = await limiter.check('user-1', rule);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    clock.advance(3000); // 105_000
    const r3 = await limiter.check('user-1', rule);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request at 105_000 should be rejected
    const blocked = await limiter.check('user-1', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // Oldest request was at 100_000. Reset for oldest is 100_000 + 10_000 - 105_000 = 5,000 ms
    expect(blocked.resetMs).toBe(5000);
    expect(blocked.retryAfterSec).toBe(5);
  });

  it('should slide smoothly and evict requests older than windowSec', async () => {
    // 3 requests at t = 100_000, 102_000, 105_000
    await limiter.check('user-1', rule);
    clock.advance(2000);
    await limiter.check('user-1', rule);
    clock.advance(3000);
    await limiter.check('user-1', rule);

    // At t = 109_000, all 3 are within window [99_000, 109_000]
    clock.set(109_000);
    expect((await limiter.check('user-1', rule)).allowed).toBe(false);

    // Advance to t = 110_001. Window is [100_001, 110_001].
    // Request at 100_000 is now outside window!
    clock.set(110_001);
    const r = await limiter.check('user-1', rule);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0); // 102k, 105k, 110k => 3 total

    // Advance to t = 112_001. Request at 102_000 expires.
    clock.set(112_001);
    const rNext = await limiter.check('user-1', rule);
    expect(rNext.allowed).toBe(true);
  });

  it('should support multi-cost consumption', async () => {
    const res1 = await limiter.check('user-1', rule, 2);
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(1);

    // Cost 2 exceeds remaining 1
    const res2 = await limiter.check('user-1', rule, 2);
    expect(res2.allowed).toBe(false);

    // Cost 1 fits
    const res3 = await limiter.check('user-1', rule, 1);
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('should handle reset and clear', async () => {
    await limiter.check('user-1', rule, 3);
    expect((await limiter.check('user-1', rule)).allowed).toBe(false);

    await limiter.reset('user-1');
    const fresh = await limiter.check('user-1', rule);
    expect(fresh.allowed).toBe(true);

    await limiter.clear();
  });
});
