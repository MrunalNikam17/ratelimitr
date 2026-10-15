import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export class MetricsCollector {
  public readonly registry: Registry;
  public readonly requestsTotal: Counter<string>;
  public readonly checkDuration: Histogram<string>;
  public readonly storeErrorsTotal: Counter<string>;

  constructor(enableDefaultMetrics = true) {
    this.registry = new Registry();

    if (enableDefaultMetrics) {
      collectDefaultMetrics({ register: this.registry, prefix: 'ratelimitr_' });
    }

    this.requestsTotal = new Counter({
      name: 'ratelimit_requests_total',
      help: 'Total number of rate limit checks processed',
      labelNames: ['algorithm', 'status', 'route'],
      registers: [this.registry],
    });

    this.checkDuration = new Histogram({
      name: 'ratelimit_duration_seconds',
      help: 'Latency of rate limit check evaluations in seconds',
      labelNames: ['algorithm', 'status'],
      buckets: [0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
      registers: [this.registry],
    });

    this.storeErrorsTotal = new Counter({
      name: 'ratelimit_store_errors_total',
      help: 'Total number of store (Redis) connection/query errors encountered',
      labelNames: ['fail_mode'],
      registers: [this.registry],
    });
  }

  recordCheck(params: {
    algorithm: string;
    allowed: boolean;
    durationSec: number;
    route?: string;
  }): void {
    const status = params.allowed ? 'allowed' : 'blocked';
    const route = params.route ?? 'unknown';

    this.requestsTotal.inc({ algorithm: params.algorithm, status, route });
    this.checkDuration.observe({ algorithm: params.algorithm, status }, params.durationSec);
  }

  recordStoreError(failMode: string): void {
    this.storeErrorsTotal.inc({ fail_mode: failMode });
  }

  async getMetricsText(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  clear(): void {
    this.registry.clear();
  }
}

export const metrics = new MetricsCollector(false);
