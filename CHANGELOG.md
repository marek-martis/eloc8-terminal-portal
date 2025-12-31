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
- Sortable table headers in stale devices page (click to sort by Device, Type, Last Activity, Days Inactive, Days on List)

#### Phase 5: Dashboard
- Dashboard landing page with fleet overview (total, active, inactive device counts)
- Device stats API endpoint (`/api/devices/stats`)
- `useDeviceStats` hook for fetching device statistics
- Dashboard link in sidebar navigation
- Shared constants (`src/lib/constants.ts`) for API limits
- PostgreSQL port (5432) exposed in docker-compose.yml for local development
- CLAUDE.md documentation for AI-assisted development
- ThingsBoard `entitiesQuery/count` API methods for efficient device counting
- ThingsBoard `entitiesQuery/find` API methods (`findStaleDevices`, `findAllDevicesWithActivity`) for efficient server-side filtering
- Device type summary API endpoint (`/api/devices/type-summary`) for analytics charts
- Devices API now supports status filtering (`status=active|inactive`) using `lastActivityTime`
- Stale devices table export for CSV and XLSX

### Changed
- **Migrated `middleware.ts` to `proxy.ts`** for Next.js 16 compatibility (renamed function from `middleware` to `proxy`)
- Updated docker-compose.yml to expose postgres port to host
- **Active/inactive status now uses `lastActivityTime` with a rolling activity window**
- Renamed `isOnline` to `isActive` in Device interface for consistency with ThingsBoard
- Map page and Dashboard now show "Active/Inactive" instead of "Online/Offline"
- **Live Map now displays only active devices** (inactive devices filtered out)
- Map only fits bounds on initial load, preserving user zoom level
- **Stats API now uses ThingsBoard `entitiesQuery/count` for O(1) device counting** (2 API calls instead of N+1)
- Devices API now supports `fetchAll=true`, plus `sortBy`/`sortDir` for server-side sorting
- Analytics page uses paged device search for selectors instead of loading all devices
- Live Tracking Map now requests active devices only and uses stats API for totals
- Stale device total now reflects selected profiles when profile filter is active
- Replaced XLSX export library to resolve security audit issue
- Updated sidebar navigation with "Stale Tracking" link
- Added stale threshold options to constants (1 day to 1 month)
- **Stale device snapshot creation now uses `entitiesQuery/find` API** - reduces API calls from N+1 (1000+ for large fleets) to 2-3 calls

### Security
- **Removed fallback JWT secret** - app now fails to start if `JWT_SECRET` is not configured
- Added centralized auth utility (`src/lib/auth.ts`) with `getSession()` and `createToken()` helpers
- Refactored all API routes to use shared auth utility

### Fixed
- Database connection from host machine for Prisma migrations
- WebSocket provider self-referencing callback lint error
- Improved API error handling with specific error messages for JWT failures (401) and ThingsBoard API errors (502)
- ThingsBoard client now correctly detects token expiry by decoding JWT instead of assuming fixed expiry
- Map zoom issues caused by repeated fitBounds calls on device updates
- MultiSelect component now fully controlled with proper X button handling (fixes cmdk v1.x compatibility issue)
- MultiSelect clear/remove controls no longer cause nested button hydration errors
- Stale device snapshot creation now guards against invalid activity timestamps
- Profile filter in stale devices page now uses local database IDs that match stored snapshot data
- Profiles API (`/api/stale-devices/profiles`) now fetches from local database instead of ThingsBoard (IDs match snapshots)
- Added `getDeviceProfiles()` method to ThingsBoard client for fetching tenant device profiles
- Added input validation for `staleDays` parameter in stats API (must be 1-365)
- Fixed foreign key constraint error in stale device snapshot creation - now syncs device profiles from ThingsBoard before creating records
