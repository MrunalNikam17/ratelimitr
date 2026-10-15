"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = exports.MetricsCollector = void 0;
const prom_client_1 = require("prom-client");
class MetricsCollector {
    registry;
    requestsTotal;
    checkDuration;
    storeErrorsTotal;
    constructor(enableDefaultMetrics = true) {
        this.registry = new prom_client_1.Registry();
        if (enableDefaultMetrics) {
            (0, prom_client_1.collectDefaultMetrics)({ register: this.registry, prefix: 'ratelimitr_' });
        }
        this.requestsTotal = new prom_client_1.Counter({
            name: 'ratelimit_requests_total',
            help: 'Total number of rate limit checks processed',
            labelNames: ['algorithm', 'status', 'route'],
            registers: [this.registry],
        });
        this.checkDuration = new prom_client_1.Histogram({
            name: 'ratelimit_duration_seconds',
            help: 'Latency of rate limit check evaluations in seconds',
            labelNames: ['algorithm', 'status'],
            buckets: [0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
            registers: [this.registry],
        });
        this.storeErrorsTotal = new prom_client_1.Counter({
            name: 'ratelimit_store_errors_total',
            help: 'Total number of store (Redis) connection/query errors encountered',
            labelNames: ['fail_mode'],
            registers: [this.registry],
        });
    }
    recordCheck(params) {
        const status = params.allowed ? 'allowed' : 'blocked';
        const route = params.route ?? 'unknown';
        this.requestsTotal.inc({ algorithm: params.algorithm, status, route });
        this.checkDuration.observe({ algorithm: params.algorithm, status }, params.durationSec);
    }
    recordStoreError(failMode) {
        this.storeErrorsTotal.inc({ fail_mode: failMode });
    }
    async getMetricsText() {
        return this.registry.metrics();
    }
    getContentType() {
        return this.registry.contentType;
    }
    clear() {
        this.registry.clear();
    }
}
exports.MetricsCollector = MetricsCollector;
exports.metrics = new MetricsCollector(false);
//# sourceMappingURL=prometheus.js.map