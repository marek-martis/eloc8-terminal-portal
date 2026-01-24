# Review Tasks

## API Correctness
- [x] Add pagination/batching to `src/app/api/devices/stats/route.ts` so totals handle fleets larger than 1000 devices.
- [x] Validate `staleDays`: coerce to positive integer, share a default constant with the client, and return 400 on invalid input.
- [x] Use `lastMidReceived` server attribute to classify stale devices; devices missing this attribute are also considered stale.

## Performance & Reliability
- [x] Limit telemetry fan-out by adding concurrency controls or using a bulk/aggregate ThingsBoard endpoint instead of hundreds of parallel calls.

## Quality & Documentation
- [ ] Add tests for `useDeviceStats`, the stats API route (happy path, invalid `staleDays`, auth failure, telemetry gaps), and dashboard card rendering/error state.
- [x] Document the default staleness window and override path in `README.md` or `AGENTS.md` so ops understand how counts are derived.
