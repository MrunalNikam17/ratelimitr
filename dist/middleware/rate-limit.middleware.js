"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitMiddleware = createRateLimitMiddleware;
const index_js_1 = require("../config/index.js");
const key_generators_js_1 = require("./key-generators.js");
const prometheus_js_1 = require("../metrics/prometheus.js");
function createRateLimitMiddleware(options) {
    const { limiter, rule: explicitRule, config, keyGenerator = key_generators_js_1.apiKeyOrIpGenerator, cost: costOption = 1, metricsCollector = prometheus_js_1.metrics, onBlocked, } = options;
    return async (req, res, next) => {
        const startTime = process.hrtime.bigint();
        const key = keyGenerator(req);
        // Resolve the rate limit rule: explicit > matched from config > fallback default
        let rule;
        if (explicitRule) {
            rule = explicitRule;
        }
        else if (config) {
            const clientId = req.headers['x-client-id'] || undefined;
            rule = (0, index_js_1.matchRule)(config, { route: req.path, clientId });
        }
        else {
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
        }
        catch (error) {
            return next(error);
        }
    };
}
//# sourceMappingURL=rate-limit.middleware.js.map