# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Phase 1: Analytics & Reporting
- Historical telemetry charts with time-series visualization (Recharts)
- Device activity timeline showing online/offline events
- Export reports functionality (CSV and PDF via `@react-pdf/renderer`)
- Custom date range filtering with presets (last hour, 24h, 7d, 30d, 90d)
- Fleet utilization metrics with aggregated statistics
- New API routes: `/api/telemetry/history`, `/api/analytics/fleet`, `/api/events`, `/api/export/csv`, `/api/export/pdf`
- New hooks: `useHistoricalTelemetry`, `useFleetAnalytics`, `useDeviceEvents`
- Enhanced Analytics page with tabs (Overview, Telemetry Charts, Activity, Fleet Metrics)

#### Phase 6: Stale Device Tracking
- Daily snapshot system to track stale devices over time
- Dedicated `/stale-devices` page with date comparison functionality
- Report: devices on stale list longest (ranked by consecutive days)
- Report: new additions between selected dates
- Report: removals with duration they were stale
- Configurable stale threshold per-report (1 day to 1 month)
- Cron-triggerable API endpoint for daily snapshots (`POST /api/stale-devices/snapshot`)
- Filter stale devices by one or more device profiles
- New Prisma models: `StaleDeviceSnapshot`, `StaleDeviceRecord`
- New hooks: `useStaleDeviceSnapshots`, `useAvailableSnapshotDates`, `useTriggerSnapshot`

#### Phase 5: Dashboard
- Dashboard landing page with fleet overview (total, active, inactive device counts)
- Device stats API endpoint (`/api/devices/stats`)
- `useDeviceStats` hook for fetching device statistics
- Dashboard link in sidebar navigation
- Shared constants (`src/lib/constants.ts`) for API limits
- PostgreSQL port (5432) exposed in docker-compose.yml for local development
- CLAUDE.md documentation for AI-assisted development
- ThingsBoard `entitiesQuery/count` API methods for efficient device counting

### Changed
- Updated docker-compose.yml to expose postgres port to host
- **Active/inactive status now uses ThingsBoard server attribute (`active: true/false`) instead of telemetry timestamps**
- Renamed `isOnline` to `isActive` in Device interface for consistency with ThingsBoard
- Map page and Dashboard now show "Active/Inactive" instead of "Online/Offline"
- **Live Map now displays only active devices** (inactive devices filtered out)
- Map only fits bounds on initial load, preserving user zoom level
- **Stats API now uses ThingsBoard `entitiesQuery/count` for O(1) device counting** (2 API calls instead of N+1)
- Devices API now supports `fetchAll=true` parameter to fetch all devices across pages
- Analytics page uses `useAllDevices` hook to show complete device list
- Updated sidebar navigation with "Stale Tracking" link
- Added stale threshold options to constants (1 day to 1 month)

### Fixed
- Database connection from host machine for Prisma migrations
- WebSocket provider self-referencing callback lint error
- Improved API error handling with specific error messages for JWT failures (401) and ThingsBoard API errors (502)
- ThingsBoard client now correctly detects token expiry by decoding JWT instead of assuming fixed expiry
- Map zoom issues caused by repeated fitBounds calls on device updates
- Device profile dropdown in stale devices page now clickable (fixed cursor and hover styles in CommandItem)
- Device profile filter now works correctly - snapshots now store `deviceProfileId` from ThingsBoard
- Profiles API (`/api/stale-devices/profiles`) now fetches profiles directly from ThingsBoard instead of empty local cache
- Added `getDeviceProfiles()` method to ThingsBoard client for fetching tenant device profiles
