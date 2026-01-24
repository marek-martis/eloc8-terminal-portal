# eLOC8 Terminal Portal

A logistics-focused dashboard for real-time GPS device tracking, built with Next.js and integrated with ThingsBoard IoT platform.

## Features

### Dashboard & Device Management
- Fleet overview with device statistics (total, active, inactive)
- Device list with filtering and real-time status updates
- Interactive map with Leaflet for GPS device visualization
- WebSocket integration for live telemetry updates

### Analytics & Reporting
- Historical telemetry charts (vbat)
- Device activity timeline (online/offline events)
- Fleet utilization metrics
- Export reports to CSV and PDF
- Custom date range filtering with presets

### Stale Device Tracking
- Daily snapshot system for tracking inactive devices over time
- Date comparison with new additions and removals reports
- Configurable stale threshold (1 day to 1 month)
- Filter by device profile
- Cron-triggerable API endpoint for automation
- Uses `lastMidReceived` server attribute (devices missing this attribute are also considered stale)

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Database**: PostgreSQL with Prisma ORM
- **State Management**: TanStack Query (server), Zustand (client)
- **Forms & Validation**: react-hook-form, Zod
- **Maps**: Leaflet / react-leaflet
- **IoT Backend**: ThingsBoard

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- ThingsBoard instance

### Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/eloc8"
THINGSBOARD_URL="https://your-thingsboard-instance.com"
NEXT_PUBLIC_THINGSBOARD_WS_URL="wss://your-thingsboard-instance.com"
JWT_SECRET="your-32-byte-secret-key"
```

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the portal.

### Docker Deployment

```bash
# Start PostgreSQL for local development
docker-compose up -d postgres

# Start full production stack (app, postgres, nginx)
docker-compose up -d
```

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/      # Protected routes with sidebar layout
│   │   ├── page.tsx      # Dashboard home
│   │   ├── map/          # Live map view
│   │   ├── devices/      # Device list
│   │   ├── analytics/    # Charts and metrics
│   │   ├── stale-devices/# Stale device tracking
│   │   └── settings/     # User preferences
│   ├── login/            # Public login page
│   └── api/              # API routes
├── components/
│   ├── ui/               # Reusable UI components
│   ├── layout/           # Header, sidebar
│   ├── map/              # Map components
│   └── charts/           # Chart components
├── hooks/                # React Query hooks
├── lib/
│   ├── thingsboard/      # ThingsBoard client
│   └── prisma.ts         # Database client
└── providers/            # Context providers
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npx prisma studio    # Open Prisma database GUI
```

## Authentication

The portal authenticates users against ThingsBoard:

1. User submits credentials to `/api/auth/login`
2. Credentials are validated against ThingsBoard API
3. ThingsBoard tokens are encrypted and stored
4. App issues its own JWT cookie (`eloc8-token`)
5. Middleware protects all routes except `/login`

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | Authenticate user |
| `POST /api/auth/logout` | End session |
| `GET /api/devices` | List devices (supports `status`, `sortBy`, `sortDir`) |
| `GET /api/devices/stats` | Device statistics |
| `GET /api/telemetry` | Latest telemetry |
| `GET /api/telemetry/history` | Historical telemetry |
| `GET /api/analytics/fleet` | Fleet metrics |
| `GET /api/devices/type-summary` | Device type counts for analytics |
| `GET /api/events` | Device events |
| `GET /api/stale-devices` | Stale device snapshots |
| `POST /api/stale-devices/snapshot` | Trigger snapshot |
| `GET /api/export/csv` | Export to CSV |
| `GET /api/export/pdf` | Export to PDF |

## Configuration Constants

Key thresholds are defined in `src/lib/constants.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `ACTIVE_WINDOW_MINUTES` | 15 | Devices with `lastActivityTime` within this window are shown as "active" on the Live Map and dashboard |
| `DEFAULT_STALE_DAYS` | 2 | Devices without `lastMidReceived` within this period are considered stale |

### Overriding Stale Days

The stale device snapshot API accepts a `staleDays` parameter (1-365) to override the default:

```bash
# Trigger snapshot with 7-day threshold
curl -X POST /api/stale-devices/snapshot \
  -H "Content-Type: application/json" \
  -d '{"staleDays": 7}'
```

The stale devices page also allows selecting different thresholds (1 day to 1 month) per-report.

## License

Private - All rights reserved
