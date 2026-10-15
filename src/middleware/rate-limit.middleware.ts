import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimiter } from '../core/limiter.interface.js';
import { RateLimitResult, RateLimitRule } from '../core/types.js';
import { AppConfig } from '../config/schema.js';
import { matchRule } from '../config/index.js';
import { KeyGenerator, apiKeyOrIpGenerator } from './key-generators.js';
import { MetricsCollector, metrics as globalMetrics } from '../metrics/prometheus.js';

export interface RateLimitMiddlewareOptions {
  limiter: RateLimiter;
  rule?: RateLimitRule;
  config?: AppConfig;
  keyGenerator?: KeyGenerator;
  cost?: number | ((req: Request) => number);
  metricsCollector?: MetricsCollector;
  onBlocked?: (req: Request, res: Response, next: NextFunction, result: RateLimitResult) => void;
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions): RequestHandler {
  const {
    limiter,
    rule: explicitRule,
    config,
    keyGenerator = apiKeyOrIpGenerator,
    cost: costOption = 1,
    metricsCollector = globalMetrics,
    onBlocked,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = process.hrtime.bigint();
    const key = keyGenerator(req);

    // Resolve the rate limit rule: explicit > matched from config > fallback default
    let rule: RateLimitRule;
    if (explicitRule) {
      rule = explicitRule;
    } else if (config) {
      const clientId = (req.headers['x-client-id'] as string) || undefined;
      rule = matchRule(config, { route: req.path, clientId });
    } else {
      rule = {
        algorithm: 'token_bucket',
        limit: 60,
        windowSec: 60,
      };
    }

    const cost = typeof costOption === 'function' ? costOption(req) : costOption;

    try {
      const result = await limiter.check(key, rule, cost);

      const elapsedSec = Number(process.hrtime.bigint() - startTime) / 1e9;
      metricsCollector.recordCheck({
        algorithm: rule.algorithm,
        allowed: result.allowed,
        durationSec: elapsedSec,
        route: req.path,
      });

      // Set standard RFC-compliant rate limit headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetEpochMs / 1000).toString());

      if (result.allowed) {
        return next();
      }

      // Client is blocked
      const retryAfter = result.retryAfterSec ?? 1;
      res.setHeader('Retry-After', retryAfter.toString());

      if (onBlocked) {
        return onBlocked(req, res, next, result);
      }

      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for algorithm '${rule.algorithm}'. Retry in ${retryAfter} second(s).`,
        limit: result.limit,
        remaining: result.remaining,
        retryAfter,
      });
    } catch (error) {
      return next(error);
    }
  };
}
