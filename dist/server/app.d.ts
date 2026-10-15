import { Express } from 'express';
import type { Redis } from 'ioredis';
import { RateLimiter } from '../core/limiter.interface.js';
import { AppConfig } from '../config/schema.js';
import { MetricsCollector } from '../metrics/prometheus.js';
export interface AppDependencies {
    limiter: RateLimiter;
    config: AppConfig;
    metrics: MetricsCollector;
    redis?: Redis;
}
export declare function createApp(deps: AppDependencies): Express;
//# sourceMappingURL=app.d.ts.map