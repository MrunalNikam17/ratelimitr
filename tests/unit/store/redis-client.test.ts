import { describe, it, expect, vi } from 'vitest';
import type { Redis } from 'ioredis';
import { createRedisClient, checkRedisHealth } from '../../../src/store/redis-client.js';
import { RedisStoreError } from '../../../src/core/errors.js';

describe('Redis Client Utilities', () => {
  it('should instantiate a Redis client with configuration options', () => {
    const client = createRedisClient({
      host: 'localhost',
      port: 6379,
      connectTimeoutMs: 1000,
      maxRetriesPerRequest: 1,
    });
    expect(client).toBeDefined();
    expect(client.options.host).toBe('localhost');
    expect(client.options.port).toBe(6379);
    client.disconnect();
  });

  it('checkRedisHealth returns true on PONG', async () => {
    const mockRedis = {
      ping: vi.fn().mockResolvedValue('PONG'),
    } as unknown as Redis;

    const healthy = await checkRedisHealth(mockRedis);
    expect(healthy).toBe(true);
  });

  it('checkRedisHealth throws RedisStoreError on failure', async () => {
    const mockRedis = {
      ping: vi.fn().mockRejectedValue(new Error('Connection refused')),
    } as unknown as Redis;

    await expect(checkRedisHealth(mockRedis)).rejects.toThrow(RedisStoreError);
  });
});
