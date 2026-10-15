"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthRouter = createHealthRouter;
const express_1 = require("express");
const redis_client_js_1 = require("../../store/redis-client.js");
function createHealthRouter(redis) {
    const router = (0, express_1.Router)();
    const startTime = Date.now();
    router.get('/', async (_req, res) => {
        let redisHealthy = true;
        if (redis) {
            try {
                redisHealthy = await (0, redis_client_js_1.checkRedisHealth)(redis);
            }
            catch {
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
//# sourceMappingURL=health.route.js.map