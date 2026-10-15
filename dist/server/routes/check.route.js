"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckRouter = createCheckRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const index_js_1 = require("../../config/index.js");
const schema_js_1 = require("../../config/schema.js");
const CheckBodySchema = zod_1.z.object({
    key: zod_1.z.string().min(1, 'key is required'),
    rule: schema_js_1.RateLimitRuleSchema.optional(),
    route: zod_1.z.string().optional(),
    clientId: zod_1.z.string().optional(),
    cost: zod_1.z.number().int().positive().default(1),
});
function createCheckRouter(limiter, config, metrics) {
    const router = (0, express_1.Router)();
    router.post('/', async (req, res) => {
        const parseResult = CheckBodySchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({
                error: 'Bad Request',
                details: parseResult.error.issues,
            });
            return;
        }
        const { key, rule: explicitRule, route, clientId, cost } = parseResult.data;
        const rule = explicitRule ?? (0, index_js_1.matchRule)(config, { route, clientId });
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
//# sourceMappingURL=check.route.js.map