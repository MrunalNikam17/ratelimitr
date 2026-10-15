import { describe, it, expect } from 'vitest';
import { SystemClock } from '../../../src/algorithms/memory/base.js';
import { MemoryFixedWindowLimiter } from '../../../src/algorithms/memory/fixed-window.js';
import { MemoryTokenBucketLimiter } from '../../../src/algorithms/memory/token-bucket.js';

describe('Base and In-Memory Lifecycle', () => {
  it('SystemClock provides current epoch timestamp', () => {
    const clock = new SystemClock();
    const now = clock.now();
    expect(now).toBeGreaterThan(0);
    expect(Math.abs(now - Date.now())).toBeLessThan(50);
  });

  it('Default constructor uses SystemClock', async () => {
    const limiter = new MemoryFixedWindowLimiter();
    const res = await limiter.check('default-user', {
      algorithm: 'fixed_window',
      limit: 10,
      windowSec: 60,
    });
    expect(res.allowed).toBe(true);
    await limiter.close();
  });

  it('MemoryFixedWindowLimiter clear and close', async () => {
    const limiter = new MemoryFixedWindowLimiter();
    await limiter.check('user-1', { algorithm: 'fixed_window', limit: 1, windowSec: 60 });
    await limiter.clear();
    const res = await limiter.check('user-1', { algorithm: 'fixed_window', limit: 1, windowSec: 60 });
    expect(res.allowed).toBe(true);
    await limiter.close();
  });

  it('MemoryTokenBucketLimiter clear and close', async () => {
    const limiter = new MemoryTokenBucketLimiter();
    await limiter.check('user-1', { algorithm: 'token_bucket', limit: 1, windowSec: 60 });
    await limiter.clear();
    const res = await limiter.check('user-1', { algorithm: 'token_bucket', limit: 1, windowSec: 60 });
    expect(res.allowed).toBe(true);
    await limiter.close();
  });
});
