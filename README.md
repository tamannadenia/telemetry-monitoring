# Fleet Telemetry Monitoring System

Full-stack industrial IoT monitoring platform that simulates a small equipment fleet, continuously ingests telemetry, stores readings in PostgreSQL, runs anomaly/trend analysis, and surfaces actionable alerts on a live React dashboard.

## Features

- Continuous sensor simulation for 5 industrial devices
- Telemetry ingestion API with validation
- Analysis engine: thresholds, rising trends, noise filtering, sensor failure, offline detection
- Automatic alert resolution when metrics return to normal
- Real-time dashboard updates via Socket.IO
- Device detail views with Recharts line graphs
- Search, status filters, alert filters, acknowledgement, dark mode

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Node.js, Express, TypeScript, Prisma, SQLite (local file), Socket.IO |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, Socket.IO Client |
| Storage | `backend/prisma/dev.db` — no external database server required |

## Architecture

```
┌─────────────┐     POST /api/telemetry      ┌──────────────────────┐
│  Simulator  │ ───────────────────────────► │  Express API         │
│  (5 devices │                              │  + Analysis Engine   │
│   / second) │                              │  + Prisma ORM        │
└─────────────┘                              └──────────┬───────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────────┐
                                              │  PostgreSQL          │
                                              │  devices / telemetry │
                                              │  / alerts            │
                                              └──────────┬───────────┘
                                                       │
                                            Socket.IO  │  REST
                                                       ▼
                                              ┌──────────────────────┐
                                              │  React Dashboard     │
                                              │  Fleet + Device      │
                                              │  charts & alerts     │
                                              └──────────────────────┘
```

### Data flow

1. Simulator POSTs temperature, vibration, power, and pressure every second.
2. API validates and stores each reading in the local SQLite file.
3. Analysis engine evaluates thresholds, trends, duplicates, noise, and sensor failure.
4. Alerts are created or auto-resolved; device status is refreshed.
5. Socket.IO broadcasts telemetry, alerts, device status, and dashboard summaries.
6. A background scheduler marks devices offline after 2 minutes without data.

## Project Structure

```
telemetry-monitoring/
├── docker-compose.yml
├── README.md
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── analyzers/       # Analysis engine rules
│   │   ├── controllers/     # HTTP handlers
│   │   ├── database/        # Prisma client + seed
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── scheduler/       # Offline detection job
│   │   ├── services/        # Business logic
│   │   ├── simulator/       # Fleet sensor simulator
│   │   ├── websocket/       # Socket.IO gateway
│   │   └── index.ts
│   └── package.json
└── frontend/
    ├── src/
    │   ├── charts/
    │   ├── components/
    │   ├── hooks/
    │   ├── pages/
    │   ├── services/
    │   └── types/
    └── package.json
```

## Prerequisites

- Node.js 16.14+ (18+ recommended)
- npm 8+

No PostgreSQL install is required. Data is stored in a local SQLite file.

## Installation

```bash
# Clone / open the project
cd telemetry-monitoring

# Install dependencies
npm run install:all
# equivalent:
#   npm install --prefix backend
#   npm install --prefix frontend

# Generate Prisma client and create local DB file
npm run db:setup
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API server port |
| `NODE_ENV` | `development` | Runtime environment |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `DATABASE_URL` | `file:./dev.db` | Local SQLite file (under `backend/prisma/`) |
| `OFFLINE_THRESHOLD_MS` | `120000` | Mark offline after this idle period |
| `OFFLINE_CHECK_INTERVAL_MS` | `30000` | Offline scheduler interval |
| `SIMULATOR_API_URL` | `http://localhost:4000/api/telemetry` | Target used by the simulator |
| `SIMULATOR_INTERVAL_MS` | `1000` | Simulator tick interval |

Copy from the example file:

```bash
cp backend/.env.example backend/.env
```

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | REST base URL (Vite proxies `/api` → `:4000`) |
| `VITE_SOCKET_URL` | `http://localhost:4000` | Socket.IO server URL |

## Database Setup

```bash
cd backend
npx prisma generate
npx prisma db push
# optional: npx prisma studio
```

This creates `backend/prisma/dev.db` automatically.

Devices are seeded automatically when the API starts:

- Cooler-01, Cooler-02, Pump-01, Motor-01, Motor-02

## Running the Backend

```bash
cd backend
npm run dev
```

API listens on [http://localhost:4000](http://localhost:4000).

## Running the Frontend

```bash
cd frontend
npm run dev
```

Dashboard: [http://localhost:5173](http://localhost:5173)

## Running the Simulator

With the API already running:

```bash
cd backend
npm run simulator
```

The simulator resolves device IDs from PostgreSQL and POSTs all four metrics for each device every second. It occasionally injects warming trends, critical spikes, isolated noise spikes (filtered), and sensor-failure (zero) scenarios.

## Recommended Startup Order

```bash
# Terminal 1
cd backend && npm run db:generate && npm run db:push && npm run dev

# Terminal 2
cd frontend && npm run dev

# Terminal 3
cd backend && npm run simulator
```

## API Documentation

Base URL: `http://localhost:4000/api`

### `POST /telemetry`

Ingest a telemetry reading.

```json
{
  "deviceId": "uuid",
  "metric": "temperature" | "vibration" | "power" | "pressure",
  "value": 42.5,
  "timestamp": "2026-07-12T10:00:00.000Z"  // optional
}
```

**Response:** `201` created telemetry row (triggers analysis + Socket.IO broadcast).

### `GET /devices`

Return all fleet devices.

### `GET /devices/:id`

Return device detail:

- Latest metric values
- Chart history (temperature, vibration, power, pressure)
- Active alerts and alert history
- Current status

### `GET /alerts`

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `severity` | string | `info` \| `warning` \| `critical` \| `offline` |
| `acknowledged` | boolean | Filter acknowledgement |
| `resolved` | boolean | Default `false` (active only) |
| `deviceId` | uuid | Filter by device |

Sorted by severity, then recency.

### `PATCH /alerts/:id/acknowledge`

Mark an alert as acknowledged.

### `GET /dashboard`

Fleet summary payload:

- Counts: total / healthy / warning / critical / offline
- Device table rows (latest metrics + active alert)
- Latest active alerts

### `GET /health`

Liveness probe.

## Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `telemetry:new` | server → client | New reading |
| `alert:update` | server → client | `{ action, alert }` (`created` / `updated` / `resolved` / `acknowledged`) |
| `device:status` | server → client | `{ deviceId, status, name }` |
| `dashboard:update` | server → client | Full dashboard summary |
| `subscribe:device` | client → server | `deviceId` room join |
| `unsubscribe:device` | client → server | leave room |

## Analysis Engine Rules

1. **Critical threshold** — temperature > 60 or vibration > 2.5 → Critical alert
2. **Warning threshold** — temperature > 45 or vibration > 1.5 → Warning alert
3. **Trend detection** — last 5 temperature readings strictly increasing → “Temperature rising continuously”
4. **Missing data** — no readings for > 2 minutes → Offline status + alert
5. **Duplicate readings** — identical consecutive values ignored for alerting
6. **Noise filtering** — first elevated reading after normal is deferred (isolated spike filter)
7. **Sensor failure** — five consecutive zeros → “Possible sensor failure”
8. **Deduped alerts** — equivalent active alerts are not recreated; severity may upgrade
9. **Auto-resolve** — alerts clear when metrics return to normal ranges

## Normal Operating Ranges

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Temperature | 30–45 °C | 46–60 °C | > 60 °C |
| Vibration | 0.2–1.5 | 1.5–2.5 | > 2.5 |
| Power | 100–300 W | — | — |
| Pressure | 40–80 PSI | — | — |

## UI Overview

- **Summary cards** — total / healthy / warning / critical / offline
- **Device table** — status, temperature, vibration, power, last seen, active alert
- **Alert panel** — severity filter + acknowledgement
- **Device page** — latest values, Recharts history, alert history
- **Extras** — search, status filter, dark mode, 10s auto-refresh + live sockets

## Future Improvements

- Persistent historical retention / downsampling (TimescaleDB)
- Multi-tenant sites and role-based operator access
- Configurable thresholds per device type
- ML-based remaining useful life (RUL) estimates
- Email / Slack / PagerDuty alert routing
- Prometheus metrics and OpenTelemetry tracing
- Integration tests for the analysis engine
- Horizontal scaling with Redis adapter for Socket.IO

## License

MIT
