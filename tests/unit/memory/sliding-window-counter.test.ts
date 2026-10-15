import { describe, it, expect, beforeEach } from 'vitest';
import { MemorySlidingWindowCounterLimiter } from '../../../src/algorithms/memory/sliding-window-counter.js';
import { RateLimitRule } from '../../../src/core/types.js';
import { MockClock } from '../../helpers/mock-clock.js';

describe('MemorySlidingWindowCounterLimiter', () => {
  let clock: MockClock;
  let limiter: MemorySlidingWindowCounterLimiter;

  const rule: RateLimitRule = {
    algorithm: 'sliding_window_counter',
    limit: 10,
    windowSec: 10, // windowMs = 10,000
  };

  beforeEach(() => {
    // Start exactly at window boundary: 100,000
    clock = new MockClock(100_000);
    limiter = new MemorySlidingWindowCounterLimiter(clock);
  });

  it('should allow requests within a single window', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await limiter.check('user-1', rule);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(10 - (i + 1));
    }

    const blocked = await limiter.check('user-1', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('should apply weighted approximation across window boundaries', async () => {
    // Window 10 [100_000 - 110_000]: consume 10 requests
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', rule);
    }

    // Now advance 3,000 ms into Window 11 (t = 113_000, 30% into the 10s window)
    // Weight of previous window = 1 - 0.3 = 0.7
    // Previous window count = 10 * 0.7 = 7
    // Allowed remaining in current window = 10 - 7 = 3
    clock.set(113_000);

    const r1 = await limiter.check('user-1', rule);
    expect(r1.allowed).toBe(true); // total = 7 + 1 = 8

    const r2 = await limiter.check('user-1', rule);
    expect(r2.allowed).toBe(true); // total = 7 + 2 = 9

    const r3 = await limiter.check('user-1', rule);
    expect(r3.allowed).toBe(true); // total = 7 + 3 = 10

    // 4th request exceeds estimated 10
    const blocked = await limiter.check('user-1', rule);
    expect(blocked.allowed).toBe(false);
  });

  it('should drop previous window count when skipping more than 1 window', async () => {
    // Consume 10 requests in Window 10
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', rule);
    }

    // Jump 2.5 windows forward (25,000 ms)
    clock.advance(25_000);

    // Completely new window with no prior window weight
    const res = await limiter.check('user-1', rule);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(9);
  });

  it('should support reset and clear', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('user-1', rule);
    }
    expect((await limiter.check('user-1', rule)).allowed).toBe(false);

    await limiter.reset('user-1');
    const fresh = await limiter.check('user-1', rule);
    expect(fresh.allowed).toBe(true);

    await limiter.clear();
  });
});
