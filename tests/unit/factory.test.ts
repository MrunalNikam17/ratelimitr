import { describe, it, expect } from 'vitest';
import { MemoryRateLimiter } from '../../src/algorithms/factory.js';
import { AlgorithmType, RateLimitRule } from '../../src/core/types.js';
import { UnsupportedAlgorithmError } from '../../src/core/errors.js';

describe('MemoryRateLimiter Strategy Factory', () => {
  const algorithms: AlgorithmType[] = [
    'fixed_window',
    'token_bucket',
    'sliding_window_log',
    'sliding_window_counter',
    'leaky_bucket',
  ];

  it('should dispatch to each of the 5 algorithms successfully', async () => {
    const limiter = new MemoryRateLimiter();

    for (const algorithm of algorithms) {
      const rule: RateLimitRule = {
        algorithm,
        limit: 5,
        windowSec: 10,
      };

      const result = await limiter.check(`user-${algorithm}`, rule);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
    }

    await limiter.close();
  });

  it('should reset state across all strategies', async () => {
    const limiter = new MemoryRateLimiter();
    const rule: RateLimitRule = {
      algorithm: 'token_bucket',
      limit: 1,
      windowSec: 60,
    };

    const r1 = await limiter.check('user-reset', rule);
    expect(r1.allowed).toBe(true);

    const r2 = await limiter.check('user-reset', rule);
    expect(r2.allowed).toBe(false);

    await limiter.reset('user-reset');

    const r3 = await limiter.check('user-reset', rule);
    expect(r3.allowed).toBe(true);

    await limiter.close();
  });

  it('should throw UnsupportedAlgorithmError for unknown algorithm', () => {
    const limiter = new MemoryRateLimiter();
    expect(() => {
      limiter.getStrategy('non_existent' as AlgorithmType);
    }).toThrow(UnsupportedAlgorithmError);
  });
});
