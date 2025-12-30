# Feature Roadmap

## Phase 1: Analytics & Reporting
- [x] Historical telemetry charts (speed, battery, signal over time)
- [x] Device activity timeline (online/offline events)
- [x] Export reports (CSV/PDF)
- [x] Custom date range filtering
- [x] Fleet utilization metrics

## Phase 2: Device Management
- [ ] Device details page with full telemetry history
- [ ] Alert configuration per device (geofence, low battery, offline)
- [ ] Device grouping/tagging
- [ ] Bulk operations (assign to group, configure alerts)
- [ ] Maintenance scheduling

## Phase 3: Map Enhancements
- [ ] Geofence drawing and management
- [ ] Route history playback
- [ ] Device clustering for large fleets
- [ ] Heatmaps for device activity
- [ ] Custom map layers/overlays

## Phase 4: Data Integrity & Device Health
- [ ] Device communication insights (buffered messages, network connection status)
- [ ] Device clock correctness monitoring
- [ ] Data quality checks (valid lat/lon, telemetry sequence validation)

## Technical Debt
- [ ] Migrate middleware.ts to proxy.ts (Next.js 16)
- [ ] Fix WebSocket connection issues
- [ ] Add Settings page preferences persistence

## Phase 5: Landing Page & Dashboard Overview (High Priority)
- [x] Implement a new landing page as the primary entry point.
- [x] Display total registered devices count.
- [x] Display count of currently active devices.
- [x] Display count of devices that have not communicated for a configurable number of days (default 2 days).

## Phase 6: Stale Device Tracking
- [x] Daily snapshot system to track stale devices over time
- [x] Dedicated /stale-devices page with date comparison
- [x] Report: devices on stale list longest (ranked by consecutive days)
- [x] Report: new additions between selected dates
- [x] Report: removals with duration they were stale
- [x] Configurable stale threshold per-report (1 day to 1 month)
- [x] Cron-triggerable API endpoint for daily snapshots
