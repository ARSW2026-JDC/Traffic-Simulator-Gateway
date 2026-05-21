import type { Request, Response, NextFunction } from 'express'
import { httpRequestsTotal, httpRequestDurationSeconds } from '../metrics/index'

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()

  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown'
    const labels = { method: req.method, route, status_code: String(res.statusCode) }

    httpRequestsTotal.inc(labels)
    httpRequestDurationSeconds.observe(labels, (Date.now() - start) / 1000)
  })

  next()
}
