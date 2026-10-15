"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMetricsRouter = createMetricsRouter;
const express_1 = require("express");
function createMetricsRouter(metrics) {
    const router = (0, express_1.Router)();
    router.get('/', async (_req, res) => {
        res.setHeader('Content-Type', metrics.getContentType());
        const text = await metrics.getMetricsText();
        res.send(text);
    });
    return router;
}
//# sourceMappingURL=metrics.route.js.map