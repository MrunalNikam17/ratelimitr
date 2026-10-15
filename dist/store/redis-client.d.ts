import { Redis } from 'ioredis';
export interface RedisConfig {
    host?: string;
    port?: number;
    password?: string;
    url?: string;
    keyPrefix?: string;
    connectTimeoutMs?: number;
    maxRetriesPerRequest?: number;
}
export declare function createRedisClient(config?: RedisConfig): Redis;
export declare function checkRedisHealth(redis: Redis): Promise<boolean>;
//# sourceMappingURL=redis-client.d.ts.map