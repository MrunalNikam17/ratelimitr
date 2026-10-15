import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { MemoryRateLimiter } from '../../src/algorithms/factory.js';
import { MetricsCollector } from '../../src/metrics/prometheus.js';
import { AppConfig } from '../../src/config/schema.js';

describe('HTTP API Integration Tests', () => {
  let limiter: MemoryRateLimiter;
  let metrics: MetricsCollector;
  let app: ReturnType<typeof createApp>;

  const config: AppConfig = {
    server: { port: 3000, host: '0.0.0.0', logLevel: 'info' },
    redis: { enabled: false, host: 'localhost', port: 6379, keyPrefix: 'rl:', connectTimeoutMs: 5000 },
    failMode: 'fail_closed',
    defaultRule: { algorithm: 'token_bucket', limit: 2, windowSec: 10 },
    rules: [
      { route: '/api/special', algorithm: 'fixed_window', limit: 1, windowSec: 10 },
    ],
  };

  beforeEach(() => {
    limiter = new MemoryRateLimiter();
    metrics = new MetricsCollector(false);
    app = createApp({ limiter, config, metrics });
  });

  describe('POST /check', () => {
    it('returns 200 with allowed=true and standard headers', async () => {
      const res = await request(app)
        .post('/check')
        .send({ key: 'client-123' });

      expect(res.status).toBe(200);
      expect(res.body.allowed).toBe(true);
      expect(res.body.remaining).toBe(1);
      expect(res.headers['x-ratelimit-limit']).toBe('2');
      expect(res.headers['x-ratelimit-remaining']).toBe('1');
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('propagates incoming X-Request-Id header', async () => {
      const res = await request(app)
        .post('/check')
        .set('X-Request-Id', 'custom-req-id-1234')
        .send({ key: 'client-req-id' });

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe('custom-req-id-1234');
    });

    it('returns 429 when rate limit is exceeded with Retry-After header', async () => {
      // 1st request
      await request(app).post('/check').send({ key: 'client-429' });
      // 2nd request
      await request(app).post('/check').send({ key: 'client-429' });

      // 3rd request should exceed limit of 2
      const res = await request(app)
        .post('/check')
        .send({ key: 'client-429' });

      expect(res.status).toBe(429);
      expect(res.body.allowed).toBe(false);
      expect(res.body.remaining).toBe(0);
      expect(res.headers['retry-after']).toBeDefined();
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('returns 400 for invalid body payload', async () => {
      const res = await request(app)
        .post('/check')
        .send({ key: '' }); // invalid empty key

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    it('matches custom route rules from config', async () => {
      // /api/special has limit = 1
      const res1 = await request(app)
        .post('/check')
        .send({ key: 'route-client', route: '/api/special' });
      expect(res1.status).toBe(200);
      expect(res1.body.remaining).toBe(0);

      const res2 = await request(app)
        .post('/check')
        .send({ key: 'route-client', route: '/api/special' });
      expect(res2.status).toBe(429);
    });
  });

  describe('GET /health', () => {
    it('returns 200 OK with health status and uptime', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.redis).toBe(true);
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('GET /metrics', () => {
    it('returns Prometheus format metrics', async () => {
      // Trigger a check to record a metric
      await request(app).post('/check').send({ key: 'metrics-test' });

      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('ratelimit_requests_total');
      expect(res.text).toContain('ratelimit_duration_seconds');
    });
  });
});
