# MuTraPro

MuTraPro is a web-based music service platform for transcription, arrangement, recording, studio booking, mock payment, feedback, notification, and admin reporting.

This project uses a Node.js/Express microservice backend with React web frontend and MySQL.

## Backend Stack

- Node.js 18
- Express
- MySQL 8
- Docker Compose
- JWT authentication
- bcrypt password hashing
- Multer file upload
- Redis cache
- RabbitMQ for lightweight event messaging
- Nginx for serving the built React web app

## Services

| Service | Port | Purpose |
|---|---:|---|
| api-gateway | 3007 | Single API entrypoint for the web frontend |
| auth-service | 3001 | Register, login, JWT, profile, admin user management |
| order-service | 3002 | Service requests, order workflow, mock payment, feedback, revision |
| task-service | 3003 | Task assignment and specialist work tracking |
| file-service | 3004 | Secure upload/download and file metadata |
| studio-service | 3005 | Studio rooms and booking |
| notification-service | 3006 | Notifications and device token registration |
| analytics-service | 3008 | Dashboard/report data |
| web-app | 3000 | React web frontend |
| MySQL | 3307 | Local host mapping to MySQL container port 3306 |
| RabbitMQ UI | 15672 | RabbitMQ management |
| NiFi | 9090 | Optional analytics flow tool |

## Environment Setup

Create `.env` from the sample:

```powershell
copy .env.example .env
```

Required variables:

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

Do not commit the real `.env` file.

## Run With Docker

```powershell
docker compose up --build -d
docker compose ps
```

Health checks:

```powershell
curl http://localhost:3007/api/health
curl http://localhost:3007/api/health/all
```

Open the web app:

```text
http://localhost:3000
```

## Demo Accounts

Default demo password:

```text
Admin@123
```

| Role | Email |
|---|---|
| Admin | admin@mutrapro.com |
| Service Coordinator | dpv@mutrapro.com |
| Transcription Specialist | cvka@mutrapro.com |
| Arrangement Specialist | cvpk@mutrapro.com |
| Recording Artist | artist@mutrapro.com |
| Studio Admin | studio@mutrapro.com |

## Main API Groups

Base URL:

```text
http://localhost:3007/api
```

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

Detailed API documentation is in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md).

## Common Issues

If Docker cannot connect:

```text
permission denied while trying to connect to the docker API
```

Open Docker Desktop, wait until the engine is running, then retry from a PowerShell session with proper permission.

If MySQL port 3306 is already used locally, this project maps MySQL to host port `3307`.
