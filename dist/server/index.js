"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_js_1 = require("../config/index.js");
const index_js_2 = require("../logger/index.js");
const prometheus_js_1 = require("../metrics/prometheus.js");
const redis_client_js_1 = require("../store/redis-client.js");
const redis_limiter_js_1 = require("../algorithms/redis/redis-limiter.js");
const factory_js_1 = require("../algorithms/factory.js");
const app_js_1 = require("./app.js");
async function bootstrap() {
    const config = (0, index_js_1.loadConfig)(process.env['CONFIG_PATH'] || 'config/default.yaml');
    let limiter;
    let redis;
    if (config.redis.enabled) {
        try {
            redis = (0, redis_client_js_1.createRedisClient)(config.redis);
            await redis.connect();
            await (0, redis_client_js_1.checkRedisHealth)(redis);
            const redisLimiter = new redis_limiter_js_1.RedisRateLimiter({
                redis,
                failMode: config.failMode,
                keyPrefix: config.redis.keyPrefix,
            });
            await redisLimiter.init();
            limiter = redisLimiter;
            index_js_2.logger.info('Connected to Redis and pre-loaded Lua rate limit scripts');
        }
        catch (err) {
            index_js_2.logger.error({ err }, 'Failed to connect to Redis. Falling back to MemoryRateLimiter');
            limiter = new factory_js_1.MemoryRateLimiter();
        }
    }
    else {
        index_js_2.logger.info('Redis disabled in config. Initializing in-memory rate limiter');
        limiter = new factory_js_1.MemoryRateLimiter();
    }
    const app = (0, app_js_1.createApp)({
        limiter,
        config,
        metrics: prometheus_js_1.metrics,
        redis,
    });
    const server = app.listen(config.server.port, config.server.host, () => {
        index_js_2.logger.info({
            port: config.server.port,
            host: config.server.host,
            failMode: config.failMode,
        }, `ratelimitr server listening on http://${config.server.host}:${config.server.port}`);
    });
    const shutdown = async () => {
        index_js_2.logger.info('Graceful shutdown initiated...');
        server.close(async () => {
            await limiter.close();
            if (redis) {
                await redis.quit().catch(() => redis?.disconnect());
            }
            index_js_2.logger.info('Shutdown complete.');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
bootstrap().catch((err) => {
    index_js_2.logger.fatal({ err }, 'Fatal error during startup');
    process.exit(1);
});
//# sourceMappingURL=index.js.map