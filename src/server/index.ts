import { loadConfig } from '../config/index.js';
import { logger } from '../logger/index.js';
import { metrics } from '../metrics/prometheus.js';
import { createRedisClient, checkRedisHealth } from '../store/redis-client.js';
import { RedisRateLimiter } from '../algorithms/redis/redis-limiter.js';
import { MemoryRateLimiter } from '../algorithms/factory.js';
import { RateLimiter } from '../core/limiter.interface.js';
import { createApp } from './app.js';
import type { Redis } from 'ioredis';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  let limiter: RateLimiter;
  let redis: Redis | undefined;

  if (config.redis.enabled) {
    try {
      redis = createRedisClient(config.redis);
      await redis.connect();
      await checkRedisHealth(redis);

      const redisLimiter = new RedisRateLimiter({
        redis,
        failMode: config.failMode,
        keyPrefix: config.redis.keyPrefix,
      });
      await redisLimiter.init();
      limiter = redisLimiter;
      logger.info('Connected to Redis and pre-loaded Lua rate limit scripts');
    } catch (err) {
      logger.error({ err }, 'Failed to connect to Redis. Falling back to MemoryRateLimiter');
      limiter = new MemoryRateLimiter();
    }
  } else {
    logger.info('Redis disabled in config. Initializing in-memory rate limiter');
    limiter = new MemoryRateLimiter();
  }

  const app = createApp({
    limiter,
    config,
    metrics,
    redis,
  });

  const server = app.listen(config.server.port, config.server.host, () => {
    logger.info(
      {
        port: config.server.port,
        host: config.server.host,
        failMode: config.failMode,
      },
      `ratelimitr server listening on http://${config.server.host}:${config.server.port}`,
    );
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Graceful shutdown initiated...');
    server.close(async () => {
      await limiter.close();
      if (redis) {
        await redis.quit().catch(() => redis?.disconnect());
      }
      logger.info('Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal error during startup');
  process.exit(1);
});
