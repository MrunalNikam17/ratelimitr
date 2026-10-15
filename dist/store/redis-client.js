"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisClient = createRedisClient;
exports.checkRedisHealth = checkRedisHealth;
const ioredis_1 = require("ioredis");
const errors_js_1 = require("../core/errors.js");
function createRedisClient(config = {}) {
    const options = {
        host: config.host || process.env['REDIS_HOST'] || '127.0.0.1',
        port: config.port || Number(process.env['REDIS_PORT'] || 6379),
        password: config.password || process.env['REDIS_PASSWORD'] || undefined,
        connectTimeout: config.connectTimeoutMs || 5000,
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? 2,
        enableOfflineQueue: false, // Fail fast if store is unreachable to respect fail-open/fail-closed
        lazyConnect: true,
    };
    const client = config.url || process.env['REDIS_URL']
        ? new ioredis_1.Redis(config.url || process.env['REDIS_URL'], options)
        : new ioredis_1.Redis(options);
    return client;
}
async function checkRedisHealth(redis) {
    try {
        const res = await redis.ping();
        return res === 'PONG';
    }
    catch (error) {
        throw new errors_js_1.RedisStoreError('Redis ping failed', error);
    }
}
//# sourceMappingURL=redis-client.js.map