# Traffic-Simulator-Gateway

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=coverage)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=alert_status)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=ARSW2026-JDC_Traffic-Simulator-Gateway&metric=security_rating)](https://sonarcloud.io/dashboard?id=ARSW2026-JDC_Traffic-Simulator-Gateway)

Proxy inverso y router central para la aplicación CUTS. Maneja autenticación, rate limiting y logging hacia los servicios backend, chat, history y simulación.

## Tecnologías

- **[Express](https://expressjs.com/)** v4.18.2 - Framework web
- **[TypeScript](https://www.typescriptlang.org/)** v5.3.3 - Tipado
- **[http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)** v3.0.5 - Proxy
- **[express-rate-limit](https://express-rate-limit.fromnodejs.com/)** v8.4.1 - Rate limiting
- **[morgan](https://github.com/expressjs/morgan)** v1.10.0 - Logging HTTP
- **[pino](https://getpino.io/)** v10.3.1 - Logger JSON
- **[firebase-admin](https://firebase.google.com/docs/admin)** v12.0.0 - Autenticación
- **[cors](https://github.com/expressjs/cors)** v2.8.5 - CORS
- **[prom-client](https://github.com/siimon/prom-client)** v15.1.0 - Métricas Prometheus

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
| `/chat/*` | Chat service (REST + WebSocket) |
| `/history/*` | History service (REST + WebSocket) |
| `/sim/*` | Simulation Server (REST + WebSocket) |
| `/health` | Health check del Gateway |

## Rate Limiting

- **API**: 300 req/min
- **Chat**: 50 req/min
- **Sim** (simulación): 100 req/min

## Monitoreo

### Endpoints de Monitoreo

| Endpoint | Descripción |
|----------|-------------|
| `/health` | Health check con estado de servicios |

## Variables de Entorno

Ver `.env.example` para valores de referencia.

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del gateway | `3000` |
| `BACKEND_URL` | URL del backend | `http://localhost:4000` |
| `SIMULATION_URL` | URL del simulation-server | `http://localhost:5000` |
| `CHAT_URL` | URL del chat | `http://localhost:6000` |
| `HISTORY_URL` | URL del history | `http://localhost:3060` |
| `ALLOWED_ORIGIN` | CORS origin permitido | `http://localhost:5173` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | - |
| `FIREBASE_CLIENT_EMAIL` | Firebase Client Email | - |
| `FIREBASE_PRIVATE_KEY` | Firebase Private Key | - |

## Seguridad

- Validación estricta de variables de entorno
- Autenticación Firebase obligatoria en producción
- Rate limiting por ruta
- `xfwd: false` para evitar IP forwarding inseguro
