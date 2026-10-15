import { Router } from 'express';
import { RateLimiter } from '../../core/limiter.interface.js';
import { AppConfig } from '../../config/schema.js';
import { MetricsCollector } from '../../metrics/prometheus.js';
export declare function createCheckRouter(limiter: RateLimiter, config: AppConfig, metrics: MetricsCollector): Router;
//# sourceMappingURL=check.route.d.ts.map