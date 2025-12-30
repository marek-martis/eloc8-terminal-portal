# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

eLOC8 Terminal Portal is a logistics-focused dashboard for real-time GPS device tracking. It integrates with ThingsBoard IoT platform as the backend for device management and telemetry data.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npx prisma generate              # Generate Prisma client
npx prisma migrate dev           # Run migrations in development
npx prisma db push               # Push schema changes without migration
docker-compose up -d postgres    # Start PostgreSQL for local development
docker-compose up -d             # Start production stack (app, postgres, nginx)
```

## Architecture

### Tech Stack
- Next.js 16 with App Router
- React 19, TypeScript, Tailwind CSS v4
- Prisma with PostgreSQL (user preferences, device cache, alerts, audit logs)
- TanStack Query for server state
- Zustand for client state
- Zod for validation
- react-hook-form for forms
- Leaflet/react-leaflet for maps

### Authentication Flow
1. User logs in via `/api/auth/login` which authenticates against ThingsBoard
2. ThingsBoard tokens are stored encrypted, app issues its own JWT cookie (`eloc8-token`)
3. Middleware (`src/middleware.ts`) validates JWT and protects all routes except `/login`
4. `AuthProvider` manages client-side auth state with automatic token refresh

### Data Flow
- **ThingsBoard Client** (`src/lib/thingsboard/client.ts`): Server-side wrapper for ThingsBoard REST API
- **API Routes** (`src/app/api/`): Proxy requests to ThingsBoard, add caching, transform responses
- **React Query Hooks** (`src/hooks/`): `useDevices`, `useDeviceStats`, `useTelemetry`, `useAuth`
- **WebSocket Provider** (`src/providers/websocket-provider.tsx`): Real-time telemetry updates via ThingsBoard WebSocket, auto-updates React Query cache
- **Shared Constants** (`src/lib/constants.ts`): Default stale days, API limits, and other configuration

### Route Structure
```
src/app/
├── (dashboard)/      # Protected routes with sidebar/header layout
│   ├── page.tsx      # Dashboard home with fleet overview stats
│   ├── map/          # Main map view with device markers
│   ├── devices/      # Device list and management
│   ├── analytics/    # Charts and metrics
│   └── settings/     # User preferences
├── login/            # Public login page
└── api/              # API routes (auth, devices, telemetry, devices/stats)
```

### Key Patterns
- Dashboard routes use `WebSocketProvider` for live telemetry
- Components are in `src/components/` organized by feature (ui, layout, map, charts)
- UI components use class-variance-authority for variants
- All API routes proxy to ThingsBoard and handle token refresh

### Notes
- Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts` - migration pending

## Environment Variables

Required in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `THINGSBOARD_URL` - ThingsBoard API base URL
- `NEXT_PUBLIC_THINGSBOARD_WS_URL` - ThingsBoard WebSocket URL (client-side)
- `JWT_SECRET` - 32-byte secret for session JWTs
