/**
 * Maximum devices to fetch per page from ThingsBoard
 */
export const TB_PAGE_SIZE = 100;

/**
 * Maximum concurrent API requests to avoid overwhelming ThingsBoard
 */
export const MAX_CONCURRENT_TELEMETRY_REQUESTS = 10;

/**
 * Default number of days after which a device is considered "stale"
 * (no communication within this period)
 */
export const DEFAULT_STALE_DAYS = 2;

/**
 * Date range presets for analytics
 */
export const DATE_RANGE_PRESETS = {
  LAST_HOUR: { label: "Last hour", hours: 1 },
  LAST_24_HOURS: { label: "Last 24 hours", hours: 24 },
  LAST_7_DAYS: { label: "Last 7 days", days: 7 },
  LAST_30_DAYS: { label: "Last 30 days", days: 30 },
  LAST_90_DAYS: { label: "Last 90 days", days: 90 },
} as const;

/**
 * Default telemetry keys for charts (user can customize)
 */
export const DEFAULT_TELEMETRY_KEYS = ["speed", "battery", "signal"];

/**
 * Aggregation options for historical telemetry
 */
export const AGGREGATION_TYPES = {
  NONE: "NONE",
  AVG: "AVG",
  MIN: "MIN",
  MAX: "MAX",
  SUM: "SUM",
  COUNT: "COUNT",
} as const;

/**
 * Default aggregation intervals based on date range
 */
export const DEFAULT_INTERVALS = {
  HOUR: 60 * 1000, // 1 minute intervals for hourly view
  DAY: 60 * 60 * 1000, // 1 hour intervals for daily view
  WEEK: 6 * 60 * 60 * 1000, // 6 hour intervals for weekly view
  MONTH: 24 * 60 * 60 * 1000, // 1 day intervals for monthly view
} as const;

/**
 * Stale threshold options for configurable reports
 */
export const STALE_THRESHOLD_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
] as const;
