# MuTraPro System

MuTraPro System is a web-based music service platform for transcription, arrangement, recording, studio booking, mock payment, feedback, notification, and analytics reporting.

The system uses a Node.js/Express microservice backend, a React web frontend served by Nginx, MySQL, Redis, RabbitMQ, and Apache NiFi.

## Technology Stack

- Node.js 18
- Express.js
- React
- Nginx
- MySQL 8
- Redis
- RabbitMQ
- Apache NiFi
- Docker Compose
- JWT authentication
- bcrypt password hashing
- Multer file upload

## Service Port Policy

For security, backend service ports are not exposed directly to the host machine. All external client traffic must go through either:

- API Gateway: `http://localhost:3007`
- Web App via Nginx: `http://localhost:3000`

Internal services communicate only through the Docker network `mutrapro-network`.

| Component | Host Port | Container Port | Exposure | Notes |
|---|---:|---:|---|---|
| web-app | 3000 | 80 | Public | React app served by Nginx |
| api-gateway | 3007 | 3007 | Public | Single backend API entrypoint |
| mysql_db | 3307 | 3306 | Public for local DB access | Limited to `mem_limit: 1G` |
| nifi | 9090 | 8080 | Public | Limited to `mem_limit: 1G` |
| auth-service | Closed | 3001 | Internal only | Access through API Gateway |
| order-service | Closed | 3002 | Internal only | Access through API Gateway |
| task-service | Closed | 3003 | Internal only | Access through API Gateway |
| file-service | Closed | 3004 | Internal only | Access through API Gateway |
| studio-service | Closed | 3005 | Internal only | Access through API Gateway |
| notification-service | Closed | 3006 | Internal only | Access through API Gateway and internal events |
| analytics-service | Closed | 3008 | Internal only | Access through API Gateway |
| redis_cache | Closed | 6379 | Internal only | No host exposure |
| rabbitmq | Closed | 5672 / 15672 | Internal only | No host exposure |

Important: ports `3001-3006` and `3008` are intentionally closed on the host. Do not call these services directly from the browser or external clients.

## Environment Setup

Create a local `.env` file from the example:

```powershell
copy .env.example .env
```

Before starting Docker, review and replace all secret placeholders in `.env`, especially:

```env
DB_PASSWORD=change_me
JWT_SECRET=change_me_to_a_long_random_secret_at_least_32_chars
CORS_ORIGIN=http://localhost:3000
RABBITMQ_DEFAULT_USER=user
RABBITMQ_DEFAULT_PASS=password
NIFI_SENSITIVE_PROPS_KEY=change_me_for_demo
INTERNAL_SERVICE_TOKEN=change_me_internal_service_token
CORS_ORIGIN=http://localhost:3000
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=mutrapr
```

Recommended local values for non-secret runtime configuration:

```env
DB_HOST=mysql_db
DB_USER=root
CORS_ORIGIN=http://localhost:3000
REACT_APP_API_GATEWAY_URL=http://localhost:3007
```

Never commit a real `.env` file.

## Run With Docker

Build and start the full system:

```powershell
docker compose up --build -d
```

Check container status:

```powershell
docker compose ps
```

Follow logs when needed:

```powershell
docker compose logs -f
```

Run only after configuration changes:

```powershell
docker compose up -d
```

Rebuild a specific service:

```powershell
docker compose up --build -d api-gateway
```

Stop the system:

```powershell
docker compose down
```

Stop the system and remove named volumes only when you intentionally want to reset persisted data:

```powershell
docker compose down -v
```

## Access URLs

| Target | URL |
|---|---|
| Web App | `http://localhost:3000` |
| API Gateway Health | `http://localhost:3007/api/health` |
| API Gateway Full Health | `http://localhost:3007/api/health/all` |
| NiFi | `http://localhost:9090` |
| MySQL from host | `localhost:3307` |

## API Entry Point

External API calls should use:

```text
http://localhost:3007/api
```

Common API groups:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/verify`
- `GET /auth/admin/users`
- `POST /orders`
- `GET /orders`
- `GET /orders/customer/:customerId`
- `PUT /orders/:id/status`
- `POST /orders/:id/pay`
- `POST /orders/:id/feedback`
- `POST /orders/:id/request-revision`
- `POST /tasks`
- `GET /tasks/specialist/:specialistId`
- `PUT /tasks/:id/status`
- `POST /files/upload`
- `GET /files/files/order/:orderId`
- `GET /files/files/download/:fileId`
- `GET /studio/studios`
- `POST /studio/bookings`
- `GET /studio/bookings/all`

Detailed API documentation is available in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## Demo Accounts

Default demo password:

```text
Admin@123
```

| Role | Email |
|---|---|
| Admin | `admin@mutrapro.com` |
| Service Coordinator | `dpv@mutrapro.com` |
| Transcription Specialist | `cvka@mutrapro.com` |
| Arrangement Specialist | `cvpk@mutrapro.com` |
| Recording Artist | `artist@mutrapro.com` |
| Studio Admin | `studio@mutrapro.com` |

Change demo credentials before using the system outside local development.

## Operational Notes

- `mysql_db` and `nifi` are capped with `mem_limit: 1G` to reduce local machine crashes.
- Backend services are private by default. If a feature requires browser access, route it through `api-gateway`.
- Redis and RabbitMQ are intentionally internal-only and should not be exposed to the host.
- File uploads are persisted through project-mounted upload directories and Docker volumes.

## Common Issues

If Docker cannot connect:

```text
permission denied while trying to connect to the docker API
```

Open Docker Desktop, wait until the engine is running, then retry from a PowerShell session with proper permissions.

If MySQL port `3306` is already used locally, this project maps MySQL to host port `3307`.

If a backend service appears unreachable from the host, that is expected for internal services. Use `http://localhost:3007/api` through the API Gateway.

<!-- CI/CD Webhook Test - Round 2 -->
