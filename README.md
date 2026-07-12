# Fleet Telemetry Monitoring System

Full-stack industrial IoT monitoring platform that simulates a small equipment fleet, continuously ingests telemetry, stores readings in a **local SQLite file**, runs anomaly and trend analysis, and surfaces actionable alerts on a live React dashboard.

> **Note:** Sensor values are **simulated in code** (random within realistic ranges). They are not read from real hardware. This is intentional for demo / assignment use.

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
| Backend | Node.js, Express, TypeScript, Prisma, SQLite, Socket.IO |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, Socket.IO Client |
| Storage | Local file: `backend/prisma/dev.db` (no PostgreSQL / Docker required) |

## Quick Start (Assignment Demo)

You need **3 terminals**. From the project root:

### 1. Install & create database

```bash
cd telemetry-monitoring

cd backend
npm install
npx prisma generate
npx prisma db push

cd ../frontend
npm install
```

### 2. Start the API (Terminal 1)

```bash
cd backend
npm run dev
```

→ API: http://localhost:4000

### 3. Start the dashboard (Terminal 2)

```bash
cd frontend
npm run dev
```

→ Dashboard: http://localhost:5173

### 4. Start the simulator (Terminal 3)

```bash
cd backend
npm run simulator
```

Open the dashboard. Within a few seconds you should see live temperatures, vibration, power, pressure, and alerts.

## Architecture

```
┌─────────────┐     POST /api/telemetry      ┌──────────────────────┐
│  Simulator  │ ───────────────────────────► │  Express API         │
│  (random    │                              │  + Analysis Engine   │
│   values)   │                              │  + Prisma ORM        │
└─────────────┘                              └──────────┬───────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────────┐
                                              │  SQLite (dev.db)     │
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

1. Simulator generates random temperature, vibration, power, and pressure values every second.
2. Simulator sends them with `POST /api/telemetry`.
3. API validates and stores each reading in `backend/prisma/dev.db`.
4. Analysis engine evaluates thresholds, trends, duplicates, noise, and sensor failure.
5. Alerts are created or auto-resolved; device status is refreshed.
6. Socket.IO broadcasts live updates to the dashboard.
7. A background scheduler marks devices offline after 2 minutes without data.

## Project Structure

```
telemetry-monitoring/
├── README.md
├── package.json
├── backend/
│   ├── .env                 # DATABASE_URL=file:./dev.db
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── dev.db           # created by `prisma db push`
│   ├── src/
│   │   ├── analyzers/       # Analysis engine rules
│   │   ├── controllers/     # HTTP handlers
│   │   ├── database/        # Prisma client + seed
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── scheduler/       # Offline detection job
│   │   ├── services/        # Business logic
│   │   ├── simulator/       # Fake sensor data generator
│   │   ├── types/
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

- Node.js **16.14+** (18+ recommended)
- npm 8+

No PostgreSQL, Docker, or cloud account is required.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API server port |
| `NODE_ENV` | `development` | Runtime environment |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin |
| `DATABASE_URL` | `file:./dev.db` | Local SQLite file under `backend/prisma/` |
| `OFFLINE_THRESHOLD_MS` | `120000` | Mark offline after this idle period |
| `OFFLINE_CHECK_INTERVAL_MS` | `30000` | Offline scheduler interval |
| `SIMULATOR_API_URL` | `http://localhost:4000/api/telemetry` | Simulator POST target |
| `SIMULATOR_INTERVAL_MS` | `1000` | Simulator tick interval |

If `.env` is missing:

```bash
cp backend/.env.example backend/.env
```

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | REST base URL (Vite proxies `/api` → port 4000) |
| `VITE_SOCKET_URL` | `http://localhost:4000` | Socket.IO server URL |

## Database

```bash
cd backend
npx prisma generate
npx prisma db push
```

This creates `backend/prisma/dev.db`.

Devices are seeded automatically when the API starts:

- Cooler-01
- Cooler-02
- Pump-01
- Motor-01
- Motor-02

Optional DB browser:

```bash
cd backend
npx prisma studio
```

## API Documentation

Base URL: `http://localhost:4000/api`

### `POST /telemetry`

Ingest a telemetry reading.

```json
{
  "deviceId": "uuid",
  "metric": "temperature",
  "value": 42.5,
  "timestamp": "2026-07-12T10:00:00.000Z"
}
```

`metric` must be one of: `temperature`, `vibration`, `power`, `pressure`.  
`timestamp` is optional.

**Response:** `201` — stores reading, runs analysis, broadcasts via Socket.IO.

### `GET /devices`

Return all fleet devices.

### `GET /devices/:id`

Return device detail:

- Latest metric values
- Chart history (temperature, vibration, power, pressure)
- Active alerts and alert history
- Current status

### `GET /alerts`

| Query param | Type | Description |
|-------------|------|-------------|
| `severity` | string | `info`, `warning`, `critical`, `offline` |
| `acknowledged` | boolean | Filter by acknowledgement |
| `resolved` | boolean | Default `false` (active only) |
| `deviceId` | uuid | Filter by device |

Sorted by severity, then recency.

### `PATCH /alerts/:id/acknowledge`

Mark an alert as acknowledged.

### `GET /dashboard`

Fleet summary:

- Counts: total / healthy / warning / critical / offline
- Device table rows (latest metrics + active alert)
- Latest active alerts

### `GET /health`

Liveness probe.

## Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `telemetry:new` | server → client | New reading |
| `alert:update` | server → client | `{ action, alert }` |
| `device:status` | server → client | `{ deviceId, status, name }` |
| `dashboard:update` | server → client | Full dashboard summary |
| `subscribe:device` | client → server | Join device room |
| `unsubscribe:device` | client → server | Leave device room |

`action` for alerts: `created`, `updated`, `resolved`, `acknowledged`.

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
- **Extras** — search, status filter, dark mode, auto-refresh + live sockets

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Dashboard shows “Unable to reach the API” | Start backend first (`npm run dev` in `backend`) |
| No live numbers | Start simulator (`npm run simulator` in `backend`) |
| DB errors on start | Run `npx prisma generate` and `npx prisma db push` in `backend` |
| Port already in use | Stop the other process using port 4000 or 5173 |

## Future Improvements

- Swap SQLite for PostgreSQL for multi-user / production use
- Configurable thresholds per device type
- Authentication for operators
- Email / Slack alert routing
- Historical retention and downsampling
- Integration tests for the analysis engine

## License

MIT
