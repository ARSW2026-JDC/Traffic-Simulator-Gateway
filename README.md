# Traffic-Simulator-Gateway

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=coverage)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=alert_status)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=security_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)

Proxy inverso y router central para la aplicación CUTS. Maneja autenticación, rate limiting, logging y balanceo de carga hacia los servicios backend y simulación.

## Tecnologías

- **[Express](https://expressjs.com/)** v4.18.2 - Framework web
- **[TypeScript](https://www.typescriptlang.org/)** v5.3.3 - Tipado
- **[http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)** v2.0.6 - Proxy
- **[express-rate-limit](https://express-rate-limit.fromnodejs.com/)** v7.1.5 - Rate limiting
- **[morgan](https://github.com/expressjs/morgan)** v1.10.0 - Logging HTTP
- **[pino](https://getpino.io/)** v9.0.0 - Logger JSON
- **[firebase-admin](https://firebase.google.com/docs/admin)** v12.0.0 - Autenticación
- **[cors](https://github.com/expressjs/cors)** v2.8.5 - CORS
- **[prom-client](https://github.com/siimon/prom-client)** v15.1.0 - Métricas Prometheus
- **[swagger-ui-express](https://github.com/scottgoliath/swagger-ui-express)** - Documentación

## Prerrequisitos

- Node.js >= 18.x
- npm >= 9.x

## Instalación

```bash
npm install
```

## Ejecución

```bash
# Desarrollo
npm run dev

# Producción
npm run build && npm start
```

## Tests

```bash
npm test
npm run test:coverage
```

## Rutas

| Ruta | Destino |
|------|--------|
| `/api/*` | Backend (REST) | 
| `/nrt/*` | Backend (WebSocket) |
| `/sim/*` | Simulation Server (WebSocket) |
| `/health` | Health check del Gateway |
| `/metrics` | Métricas Prometheus |

## Rate Limiting

- **API**: 300 req/min
- **NRT** (chat): 50 req/min
- **Sim** (simulación): 100 req/min

## Monitoreo

### Endpoints de Monitoreo

| Endpoint | Descripción |
|----------|-------------|
| `/health` | Health check con estado de servicios |
| `/metrics` | Métricas en formato Prometheus |

### Métricas Disponibles

- `gateway_http_requests_total` - Total de requests HTTP
- `gateway_http_request_duration_seconds` - Duración de requests
- `gateway_websocket_connections` - Conexiones WebSocket activas
- `gateway_proxy_errors_total` - Errores de proxy
- `gateway_rate_limit_exceeded_total` - Rate limits excedidos

### integraciones

- **Prometheus**: Scraping en `http://localhost:3000/metrics`
- **Loki** (opcional): Logs en `http://localhost:3100`

## Seguridad

- Validación estricta de variables de entorno
- Autenticación Firebase obligatoria en producción
- Rate limiting por ruta
- `xfwd: false` para evitar IP forwarding inseguro