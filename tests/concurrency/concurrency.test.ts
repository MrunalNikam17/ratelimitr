import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Express } from 'express';
import { createApp } from '../../src/server/app.js';
import { MemoryRateLimiter } from '../../src/algorithms/factory.js';
import { MetricsCollector } from '../../src/metrics/prometheus.js';
import { AppConfig } from '../../src/config/schema.js';
import request from 'supertest';
import { Server } from 'node:http';

describe('Concurrency Testing: 1,000 Parallel Requests Across 3 Server Instances', () => {
  const TOTAL_REQUESTS = 1000;
  const RATE_LIMIT = 50;
  const WINDOW_SEC = 10;

  const servers: Server[] = [];
  const apps: Express[] = [];
  let sharedLimiter: MemoryRateLimiter;

  const testConfig: AppConfig = {
    server: { port: 0, host: '127.0.0.1', logLevel: 'fatal' },
    redis: { enabled: false, host: '127.0.0.1', port: 6379, keyPrefix: 'rl_concurrency:', connectTimeoutMs: 2000 },
    failMode: 'fail_closed',
    defaultRule: {
      algorithm: 'token_bucket',
      limit: RATE_LIMIT,
      windowSec: WINDOW_SEC,
      burst: RATE_LIMIT,
    },
    rules: [],
  };

  beforeAll(async () => {
    sharedLimiter = new MemoryRateLimiter();
    const metrics = new MetricsCollector(false);

    // Initialize 3 distinct server instances simulating a distributed cluster
    for (let i = 0; i < 3; i++) {
      const app = createApp({
        limiter: sharedLimiter,
        config: testConfig,
        metrics,
      });
      apps.push(app);
      const server = app.listen(0);
      servers.push(server);
    }
  });

  afterAll(async () => {
    for (const server of servers) {
      server.close();
    }
    await sharedLimiter.close();
  });

  it('never exceeds the configured limit under 1,000 concurrent requests across 3 instances', async () => {
    const key = `concurrency-test-${Date.now()}`;
    const targetApps = apps;

    // Fire 1,000 parallel requests distributed across the 3 server instances
    const promises = Array.from({ length: TOTAL_REQUESTS }, (_, idx) => {
      const targetApp = targetApps[idx % targetApps.length]!;
      return request(targetApp)
        .post('/check')
        .send({
          key,
          rule: {
            algorithm: 'token_bucket',
            limit: RATE_LIMIT,
            windowSec: 3600,
            burst: RATE_LIMIT,
          },
        });
    });

    const responses = await Promise.all(promises);

    let allowedCount = 0;
    let blockedCount = 0;

    for (const res of responses) {
      if (res.status === 200 && res.body.allowed === true) {
        allowedCount++;
      } else if (res.status === 429 && res.body.allowed === false) {
        blockedCount++;
      } else {
        throw new Error(`Unexpected status code: ${res.status}`);
      }
    }

    // Verify limit was respected exactly
    expect(allowedCount).toBe(RATE_LIMIT);
    expect(blockedCount).toBe(TOTAL_REQUESTS - RATE_LIMIT);
    expect(allowedCount + blockedCount).toBe(TOTAL_REQUESTS);
    expect(allowedCount).toBeLessThanOrEqual(RATE_LIMIT);
  });

  it('guarantees concurrency safety for Fixed Window Counter across 3 instances', async () => {
    const key = `concurrency-fw-${Date.now()}`;
    const fwLimit = 40;

    const promises = Array.from({ length: 600 }, (_, idx) => {
      const targetApp = apps[idx % apps.length]!;
      return request(targetApp)
        .post('/check')
        .send({
          key,
          rule: {
            algorithm: 'fixed_window',
            limit: fwLimit,
            windowSec: WINDOW_SEC,
          },
        });
    });

    const responses = await Promise.all(promises);

    const allowed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(allowed).toBe(fwLimit);
    expect(blocked).toBe(600 - fwLimit);
    expect(allowed).toBeLessThanOrEqual(fwLimit);
  });

  it('guarantees concurrency safety for Leaky Bucket across 3 instances', async () => {
    const key = `concurrency-lb-${Date.now()}`;
    const lbLimit = 35;

    const promises = Array.from({ length: 500 }, (_, idx) => {
      const targetApp = apps[idx % apps.length]!;
      return request(targetApp)
        .post('/check')
        .send({
          key,
          rule: {
            algorithm: 'leaky_bucket',
            limit: lbLimit,
            windowSec: WINDOW_SEC,
            burst: lbLimit,
          },
        });
    });

    const responses = await Promise.all(promises);

    const allowed = responses.filter((r) => r.status === 200).length;
    const blocked = responses.filter((r) => r.status === 429).length;

    expect(allowed).toBe(lbLimit);
    expect(blocked).toBe(500 - lbLimit);
    expect(allowed).toBeLessThanOrEqual(lbLimit);
  });
});
