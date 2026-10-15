import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from '../../../src/metrics/prometheus.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector(false);
  });

  it('records allowed and blocked checks', async () => {
    collector.recordCheck({
      algorithm: 'token_bucket',
      allowed: true,
      durationSec: 0.002,
      route: '/api/test',
    });

    collector.recordCheck({
      algorithm: 'token_bucket',
      allowed: false,
      durationSec: 0.001,
      route: '/api/test',
    });

    const output = await collector.getMetricsText();
    expect(output).toContain('ratelimit_requests_total{algorithm="token_bucket",status="allowed",route="/api/test"} 1');
    expect(output).toContain('ratelimit_requests_total{algorithm="token_bucket",status="blocked",route="/api/test"} 1');
    expect(output).toContain('ratelimit_duration_seconds');
  });

  it('records store errors', async () => {
    collector.recordStoreError('fail_closed');
    const output = await collector.getMetricsText();
    expect(output).toContain('ratelimit_store_errors_total{fail_mode="fail_closed"} 1');
  });

  it('returns valid prometheus content type', () => {
    expect(collector.getContentType()).toContain('text/plain');
  });
});
