import { Router, Request, Response } from 'express';
import { MetricsCollector } from '../../metrics/prometheus.js';

export function createMetricsRouter(metrics: MetricsCollector): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', metrics.getContentType());
    const text = await metrics.getMetricsText();
    res.send(text);
  });

  return router;
}
