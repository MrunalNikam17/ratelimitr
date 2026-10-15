import { randomUUID } from 'node:crypto';
import express, { Express, Request, Response, NextFunction } from 'express';
import type { Redis } from 'ioredis';
import { RateLimiter } from '../core/limiter.interface.js';
import { AppConfig } from '../config/schema.js';
import { MetricsCollector } from '../metrics/prometheus.js';
import { logger } from '../logger/index.js';
import { createCheckRouter } from './routes/check.route.js';
import { createHealthRouter } from './routes/health.route.js';
import { createMetricsRouter } from './routes/metrics.route.js';

export interface AppDependencies {
  limiter: RateLimiter;
  config: AppConfig;
  metrics: MetricsCollector;
  redis?: Redis;
}

export function createApp(deps: AppDependencies): Express {
  const { limiter, config, metrics, redis } = deps;
  const app = express();

  // Attach Request ID and structured request logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    (req as Request & { id: string }).id = requestId;
    res.setHeader('X-Request-Id', requestId);

    const startTime = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      logger.info(
        {
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        },
        'HTTP request completed',
      );
    });

    next();
  });

  app.use(express.json());

  // Mount core endpoints
  app.use('/check', createCheckRouter(limiter, config, metrics));
  app.use('/health', createHealthRouter(redis));
  app.use('/metrics', createMetricsRouter(metrics));

  // Central error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as Request & { id?: string }).id;
    logger.error({ requestId, err }, 'Unhandled request error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
      requestId,
    });
  });

  return app;
}
