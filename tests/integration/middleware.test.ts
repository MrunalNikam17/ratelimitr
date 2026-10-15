import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimitMiddleware } from '../../src/middleware/rate-limit.middleware.js';
import { MemoryRateLimiter } from '../../src/algorithms/factory.js';
import { AppConfig } from '../../src/config/schema.js';

describe('Express Rate Limit Middleware Integration', () => {
  let limiter: MemoryRateLimiter;

  const config: AppConfig = {
    server: { port: 3000, host: '0.0.0.0', logLevel: 'info' },
    redis: { enabled: false, host: 'localhost', port: 6379, keyPrefix: 'rl:', connectTimeoutMs: 5000 },
    failMode: 'fail_closed',
    defaultRule: { algorithm: 'token_bucket', limit: 2, windowSec: 10 },
    rules: [
      { route: '/custom', algorithm: 'fixed_window', limit: 1, windowSec: 10 },
    ],
  };

  beforeEach(() => {
    limiter = new MemoryRateLimiter();
  });

  it('allows requests within limit and passes to next middleware', async () => {
    const app = express();
    app.use(createRateLimitMiddleware({ limiter, config }));
    app.get('/test', (_req, res) => res.json({ message: 'success' }));

    const res1 = await request(app).get('/test');
    expect(res1.status).toBe(200);
    expect(res1.body.message).toBe('success');
    expect(res1.headers['x-ratelimit-remaining']).toBe('1');

    const res2 = await request(app).get('/test');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('blocks request with 429 and Retry-After when limit exceeded', async () => {
    const app = express();
    app.use(createRateLimitMiddleware({ limiter, config }));
    app.get('/test', (_req, res) => res.json({ ok: true }));

    await request(app).get('/test');
    await request(app).get('/test');

    const res3 = await request(app).get('/test');
    expect(res3.status).toBe(429);
    expect(res3.body.error).toBe('Too Many Requests');
    expect(res3.headers['retry-after']).toBeDefined();
  });

  it('identifies clients via X-API-Key and isolates limits', async () => {
    const app = express();
    app.use(createRateLimitMiddleware({ limiter, config }));
    app.get('/data', (_req, res) => res.json({ data: 123 }));

    // Client A consumes both
    await request(app).get('/data').set('X-API-Key', 'client-a');
    await request(app).get('/data').set('X-API-Key', 'client-a');
    const blockedA = await request(app).get('/data').set('X-API-Key', 'client-a');
    expect(blockedA.status).toBe(429);

    // Client B has fresh quota
    const allowedB = await request(app).get('/data').set('X-API-Key', 'client-b');
    expect(allowedB.status).toBe(200);
  });

  it('supports dynamic cost calculation', async () => {
    const app = express();
    app.use(
      createRateLimitMiddleware({
        limiter,
        rule: { algorithm: 'token_bucket', limit: 10, windowSec: 60 },
        cost: (req) => Number(req.query['cost'] || 1),
      }),
    );
    app.get('/resource', (_req, res) => res.json({ ok: true }));

    // Consume 8 at once
    const res = await request(app).get('/resource?cost=8');
    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-remaining']).toBe('2');

    // Trying to consume 3 more exceeds remaining (2)
    const blocked = await request(app).get('/resource?cost=3');
    expect(blocked.status).toBe(429);
  });

  it('supports custom onBlocked handler', async () => {
    const app = express();
    app.use(
      createRateLimitMiddleware({
        limiter,
        rule: { algorithm: 'fixed_window', limit: 1, windowSec: 10 },
        onBlocked: (_req, res, _next, result) => {
          res.status(429).json({ custom: 'blocked', resetInMs: result.resetMs });
        },
      }),
    );
    app.get('/custom-blocked', (_req, res) => res.send('ok'));

    await request(app).get('/custom-blocked');
    const res = await request(app).get('/custom-blocked');
    expect(res.status).toBe(429);
    expect(res.body.custom).toBe('blocked');
    expect(res.body.resetInMs).toBeDefined();
  });

  it('respects fail_open behavior when store fails', async () => {
    // Failing limiter simulating Redis connection loss with fail_open
    const failingOpenLimiter = {
      check: async () => ({
        allowed: true,
        limit: 10,
        remaining: 1,
        resetMs: 0,
        resetEpochMs: Date.now(),
      }),
      reset: async () => {},
      close: async () => {},
    };

    const app = express();
    app.use(createRateLimitMiddleware({ limiter: failingOpenLimiter }));
    app.get('/fail-open-test', (_req, res) => res.json({ status: 'allowed_by_fail_open' }));

    const res = await request(app).get('/fail-open-test');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('allowed_by_fail_open');
    expect(res.headers['x-ratelimit-remaining']).toBe('1');
  });

  it('respects fail_closed behavior when store fails', async () => {
    // Failing limiter simulating Redis connection loss with fail_closed
    const failingClosedLimiter = {
      check: async () => ({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetMs: 60000,
        resetEpochMs: Date.now() + 60000,
        retryAfterSec: 60,
      }),
      reset: async () => {},
      close: async () => {},
    };

    const app = express();
    app.use(createRateLimitMiddleware({ limiter: failingClosedLimiter }));
    app.get('/fail-closed-test', (_req, res) => res.json({ status: 'should_not_reach' }));

    const res = await request(app).get('/fail-closed-test');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('60');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });
});
