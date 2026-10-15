import { describe, it, expect } from 'vitest';
import * as ratelimitr from '../../../src/index.js';
import { createLogger, logger } from '../../../src/logger/index.js';
import { apiKeyOrIpGenerator, ipKeyGenerator } from '../../../src/middleware/key-generators.js';
import { Request } from 'express';

describe('Public Exports, Logger, and Key Generators', () => {
  it('exports all expected public interfaces and classes', () => {
    expect(ratelimitr.MemoryRateLimiter).toBeDefined();
    expect(ratelimitr.RedisRateLimiter).toBeDefined();
    expect(ratelimitr.createRateLimitMiddleware).toBeDefined();
    expect(ratelimitr.loadConfig).toBeDefined();
    expect(ratelimitr.metrics).toBeDefined();
    expect(ratelimitr.RateLimiterError).toBeDefined();
  });

  it('logger initializes correctly', () => {
    const customLogger = createLogger('debug');
    expect(customLogger.level).toBe('debug');
    expect(logger).toBeDefined();
  });

  it('key-generators handle x-forwarded-for, authorization bearer, and fallbacks', () => {
    // x-forwarded-for with array or string
    const reqForwarded = {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
      socket: {},
    } as unknown as Request;
    expect(ipKeyGenerator(reqForwarded)).toBe('ip:192.168.1.1');

    const reqForwardedArray = {
      headers: { 'x-forwarded-for': ['192.168.1.2', '10.0.0.2'] },
      socket: {},
    } as unknown as Request;
    expect(ipKeyGenerator(reqForwardedArray)).toBe('ip:192.168.1.2');

    // fallback socket
    const reqSocket = {
      headers: {},
      socket: { remoteAddress: '10.0.0.5' },
    } as unknown as Request;
    expect(ipKeyGenerator(reqSocket)).toBe('ip:10.0.0.5');

    // Bearer token
    const reqBearer = {
      headers: { authorization: 'Bearer jwt_token_abc' },
      socket: {},
    } as unknown as Request;
    expect(apiKeyOrIpGenerator(reqBearer)).toBe('bearer:jwt_token_abc');
  });
});
