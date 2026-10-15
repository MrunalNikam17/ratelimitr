import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimiter } from '../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule } from '../core/types.js';
import { AppConfig } from '../config/schema.js';
import { KeyGenerator } from './key-generators.js';
import { MetricsCollector } from '../metrics/prometheus.js';
export interface RateLimitMiddlewareOptions {
    limiter: RateLimiter;
    rule?: RateLimitRule;
    config?: AppConfig;
    keyGenerator?: KeyGenerator;
    cost?: number | ((req: Request) => number);
    metricsCollector?: MetricsCollector;
    onBlocked?: (req: Request, res: Response, next: NextFunction, result: RateLimitResult) => void;
}
export declare function createRateLimitMiddleware(options: RateLimitMiddlewareOptions): RequestHandler;
//# sourceMappingURL=rate-limit.middleware.d.ts.map