"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const node_crypto_1 = require("node:crypto");
const express_1 = __importDefault(require("express"));
const index_js_1 = require("../logger/index.js");
const check_route_js_1 = require("./routes/check.route.js");
const health_route_js_1 = require("./routes/health.route.js");
const metrics_route_js_1 = require("./routes/metrics.route.js");
function createApp(deps) {
    const { limiter, config, metrics, redis } = deps;
    const app = (0, express_1.default)();
    // Attach Request ID and structured request logger
    app.use((req, res, next) => {
        const requestId = req.headers['x-request-id'] || (0, node_crypto_1.randomUUID)();
        req.id = requestId;
        res.setHeader('X-Request-Id', requestId);
        const startTime = process.hrtime.bigint();
        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
            index_js_1.logger.info({
                requestId,
                method: req.method,
                url: req.originalUrl || req.url,
                statusCode: res.statusCode,
                durationMs: Math.round(durationMs * 100) / 100,
            }, 'HTTP request completed');
        });
        next();
    });
    app.use(express_1.default.json());
    // Mount core endpoints
    app.use('/check', (0, check_route_js_1.createCheckRouter)(limiter, config, metrics));
    app.use('/health', (0, health_route_js_1.createHealthRouter)(redis));
    app.use('/metrics', (0, metrics_route_js_1.createMetricsRouter)(metrics));
    // Central error handler
    app.use((err, req, res, _next) => {
        const requestId = req.id;
        index_js_1.logger.error({ requestId, err }, 'Unhandled request error');
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
            requestId,
        });
    });
    return app;
}
//# sourceMappingURL=app.js.map