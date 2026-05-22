import client from 'prom-client'
import * as snappy from 'snappy'
import * as protobuf from 'protobufjs'

const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry })

export const httpRequestsTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total HTTP requests by route and status code',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
})

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
})

export const proxyErrorsTotal = new client.Counter({
  name: 'gateway_proxy_errors_total',
  help: 'Proxy errors by target service and error code',
  labelNames: ['target', 'error_code'],
  registers: [registry],
})

export const activeProxyConnections = new client.Gauge({
  name: 'gateway_active_proxy_connections',
  help: 'Active proxy connections by target service',
  labelNames: ['target'],
  registers: [registry],
})

export const backendHealthStatus = new client.Gauge({
  name: 'gateway_backend_health_status',
  help: 'Health status of downstream services (1=up, 0=down)',
  labelNames: ['service'],
  registers: [registry],
})

export const rateLimitExceededTotal = new client.Counter({
  name: 'gateway_rate_limit_exceeded_total',
  help: 'Rate limit exceeded by route',
  labelNames: ['route'],
  registers: [registry],
})

// ---------------------------------------------------------------------------
// Grafana Cloud Remote Write
// ---------------------------------------------------------------------------

const pushIntervalMs = Number(process.env.GRAFANA_CLOUD_PUSH_INTERVAL) || 15_000

function buildProto(): protobuf.Type {
  const root = protobuf.parse(`
    syntax = "proto3";
    package prometheus;
    message Label { bytes name = 1; bytes value = 2; }
    message Sample { double value = 1; int64 timestamp = 2; }
    message TimeSeries { repeated Label labels = 1; repeated Sample samples = 2; }
    message WriteRequest { repeated TimeSeries timeseries = 1; }
  `).root
  return root.lookupType('prometheus.WriteRequest')
}

function convertToTimeseries(jsonMetrics: any[]): any[] {
  const timestamp = Date.now()
  const result: any[] = []

  for (const metric of jsonMetrics) {
    for (const val of metric.values) {
      const name = val.metricName || metric.name
      if (!name) continue
      const labels: Record<string, string> = { __name__: name }
      if (val.labels) {
        for (const [k, v] of Object.entries(val.labels)) {
          labels[k] = String(v)
        }
      }
      result.push({
        labels: Object.entries(labels).map(([k, v]) => ({ name: Buffer.from(k), value: Buffer.from(v) })),
        samples: [{ value: val.value, timestamp }],
      })
    }
  }
  return result
}

async function push(): Promise<void> {
  const url = process.env.GRAFANA_CLOUD_URL
  const user = process.env.GRAFANA_CLOUD_USER
  const key = process.env.GRAFANA_CLOUD_API_KEY
  if (!url || !user || !key) return

  try {
    const jsonMetrics = await registry.getMetricsAsJSON()
    const timeseries = convertToTimeseries(jsonMetrics)
    if (timeseries.length === 0) return

    const WriteRequest = buildProto()
    const payload = WriteRequest.create({ timeseries })
    const buffer = WriteRequest.encode(payload).finish()
    const compressed = Buffer.from(await snappy.compress(buffer))

    const auth = 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64')
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf',
        'Content-Encoding': 'snappy',
        'Authorization': auth,
        'X-Prometheus-Remote-Write-Version': '0.1.0',
      },
      body: compressed,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(`[metrics] Grafana Cloud push failed (${res.status}): ${body.slice(0, 200)}`)
    }
  } catch (err: any) {
    console.warn(`[metrics] Grafana Cloud push error: ${err.message}`)
  }
}

let pushTimer: NodeJS.Timeout | null = null

export function startMetricsPush(): void {
  const url = process.env.GRAFANA_CLOUD_URL
  const user = process.env.GRAFANA_CLOUD_USER
  const key = process.env.GRAFANA_CLOUD_API_KEY

  if (!url || !user || !key) {
    console.warn('[metrics] Grafana Cloud push disabled. Set GRAFANA_CLOUD_URL, GRAFANA_CLOUD_USER, GRAFANA_CLOUD_API_KEY')
    return
  }

  console.log('[metrics] Grafana Cloud push enabled')
  pushTimer = setInterval(() => push(), pushIntervalMs)
}

export function stopMetricsPush(): void {
  if (pushTimer) clearInterval(pushTimer)
}

export { registry }
export { convertToTimeseries, push }
