import { Router, Request, Response } from 'express';
import type { Redis } from 'ioredis';
import { checkRedisHealth } from '../../store/redis-client.js';

export function createHealthRouter(redis?: Redis): Router {
  const router = Router();
  const startTime = Date.now();

  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    let redisHealthy = true;
    if (redis) {
      try {
        redisHealthy = await checkRedisHealth(redis);
      } catch {
        redisHealthy = false;
      }
    }

    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const status = !redis || redisHealthy ? 'ok' : 'degraded';
    const statusCode = status === 'ok' ? 200 : 503;

    res.status(statusCode).json({
      status,
      redis: redisHealthy,
      uptime,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
