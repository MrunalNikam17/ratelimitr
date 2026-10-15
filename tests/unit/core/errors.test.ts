import { describe, it, expect } from 'vitest';
import {
  RateLimiterError,
  UnsupportedAlgorithmError,
  RedisStoreError,
  ConfigurationError,
} from '../../../src/core/errors.js';

describe('Core Error Classes', () => {
  it('RateLimiterError initializes with correct message and name', () => {
    const err = new RateLimiterError('Base failure');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimiterError);
    expect(err.message).toBe('Base failure');
    expect(err.name).toBe('RateLimiterError');
  });

  it('UnsupportedAlgorithmError formatting', () => {
    const err = new UnsupportedAlgorithmError('magic_bucket');
    expect(err).toBeInstanceOf(RateLimiterError);
    expect(err.name).toBe('UnsupportedAlgorithmError');
    expect(err.message).toBe('Unsupported rate limit algorithm: magic_bucket');
  });

  it('RedisStoreError with cause', () => {
    const inner = new Error('ECONNREFUSED');
    const err = new RedisStoreError('Store failure', inner);
    expect(err.name).toBe('RedisStoreError');
    expect(err.message).toBe('Store failure');
    expect(err.cause).toBe(inner);
  });

  it('ConfigurationError formatting', () => {
    const err = new ConfigurationError('Invalid rule');
    expect(err.name).toBe('ConfigurationError');
    expect(err.message).toBe('Invalid rule');
  });
});
