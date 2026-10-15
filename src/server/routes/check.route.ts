import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RateLimiter } from '../../core/limiter.interface.js';
import { AppConfig } from '../../config/schema.js';
import { matchRule } from '../../config/index.js';
import { RateLimitRuleSchema } from '../../config/schema.js';
import { MetricsCollector } from '../../metrics/prometheus.js';

const CheckBodySchema = z.object({
  key: z.string().min(1, 'key is required'),
  rule: RateLimitRuleSchema.optional(),
  route: z.string().optional(),
  clientId: z.string().optional(),
  cost: z.number().int().positive().default(1),
});

export function createCheckRouter(
  limiter: RateLimiter,
  config: AppConfig,
  metrics: MetricsCollector,
): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const parseResult = CheckBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        details: parseResult.error.issues,
      });
      return;
    }

    const { key, rule: explicitRule, route, clientId, cost } = parseResult.data;
    const rule = explicitRule ?? matchRule(config, { route, clientId });

    const startTime = process.hrtime.bigint();
    const result = await limiter.check(key, rule, cost);
    const durationSec = Number(process.hrtime.bigint() - startTime) / 1e9;

    metrics.recordCheck({
      algorithm: rule.algorithm,
      allowed: result.allowed,
      durationSec,
      route,
    });

    res.setHeader('X-RateLimit-Limit', result.limit.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetEpochMs / 1000).toString());

    if (!result.allowed) {
      const retryAfter = result.retryAfterSec ?? 1;
      res.setHeader('Retry-After', retryAfter.toString());
      res.status(429).json({
        allowed: false,
        limit: result.limit,
        remaining: result.remaining,
        resetMs: result.resetMs,
        resetEpochMs: result.resetEpochMs,
        retryAfterSec: retryAfter,
      });
      return;
    }

    res.status(200).json({
      allowed: true,
      limit: result.limit,
      remaining: result.remaining,
      resetMs: result.resetMs,
      resetEpochMs: result.resetEpochMs,
    });
  });

  return router;
}
