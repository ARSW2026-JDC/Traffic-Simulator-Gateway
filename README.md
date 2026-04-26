# Traffic-Simulator-Gateway

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

## ▶Ejecución

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

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del Gateway | `3000` |
| `BACKEND_URL` | URL del Backend | `http://localhost:4000` |
| `SIMULATION_URL` | URL del Simulation Server | `http://localhost:5000` |
| `ALLOWED_ORIGIN` | Origen CORS permitido | `http://localhost:5173` |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | - |
| `FIREBASE_PRIVATE_KEY` | Firebase Private Key | - |
| `FIREBASE_CLIENT_EMAIL` | Firebase Client Email | - |

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