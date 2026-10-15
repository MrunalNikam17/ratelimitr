import { Redis, RedisOptions } from 'ioredis';
import { RedisStoreError } from '../core/errors.js';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  url?: string;
  keyPrefix?: string;
  connectTimeoutMs?: number;
  maxRetriesPerRequest?: number;
}

export function createRedisClient(config: RedisConfig = {}): Redis {
  const options: RedisOptions = {
    host: config.host || process.env['REDIS_HOST'] || '127.0.0.1',
    port: config.port || Number(process.env['REDIS_PORT'] || 6379),
    password: config.password || process.env['REDIS_PASSWORD'] || undefined,
    connectTimeout: config.connectTimeoutMs || 5000,
    maxRetriesPerRequest: config.maxRetriesPerRequest ?? 2,
    enableOfflineQueue: false, // Fail fast if store is unreachable to respect fail-open/fail-closed
    lazyConnect: true,
  };

  const client = config.url || process.env['REDIS_URL']
    ? new Redis(config.url || (process.env['REDIS_URL'] as string), options)
    : new Redis(options);

  return client;
}

export async function checkRedisHealth(redis: Redis): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === 'PONG';
  } catch (error) {
    throw new RedisStoreError('Redis ping failed', error);
  }
}
