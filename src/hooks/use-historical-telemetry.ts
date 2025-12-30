"use client";

import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";
import {
  AGGREGATION_TYPES,
  DEFAULT_INTERVALS,
  DEFAULT_TELEMETRY_KEYS,
} from "@/lib/constants";

type AggregationType = keyof typeof AGGREGATION_TYPES;

interface TelemetryDataPoint {
  ts: number;
  value: string | number;
}

interface HistoricalTelemetryResponse {
  deviceId: string;
  keys: string[];
  startTs: number;
  endTs: number;
  interval?: number;
  agg: string;
  data: Record<string, TelemetryDataPoint[]>;
}

interface UseHistoricalTelemetryOptions {
  keys?: string[];
  interval?: number;
  agg?: AggregationType;
  enabled?: boolean;
}

function getAutoInterval(startTs: number, endTs: number): number {
  const duration = endTs - startTs;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;

  if (duration <= oneHour) {
    return DEFAULT_INTERVALS.HOUR;
  } else if (duration <= oneDay) {
    return DEFAULT_INTERVALS.DAY;
  } else if (duration <= oneWeek) {
    return DEFAULT_INTERVALS.WEEK;
  } else {
    return DEFAULT_INTERVALS.MONTH;
  }
}

export function useHistoricalTelemetry(
  deviceId: string | undefined,
  dateRange: DateRange | undefined,
  options: UseHistoricalTelemetryOptions = {}
) {
  const {
    keys = DEFAULT_TELEMETRY_KEYS,
    interval,
    agg = "AVG",
    enabled = true,
  } = options;

  const startTs = dateRange?.from?.getTime();
  const endTs = dateRange?.to?.getTime();

  return useQuery({
    queryKey: ["historicalTelemetry", deviceId, startTs, endTs, keys, interval, agg],
    queryFn: async () => {
      if (!deviceId || !startTs || !endTs) {
        throw new Error("Missing required parameters");
      }

      const autoInterval = interval ?? getAutoInterval(startTs, endTs);

      const params = new URLSearchParams({
        deviceId,
        keys: keys.join(","),
        startTs: String(startTs),
        endTs: String(endTs),
        interval: String(autoInterval),
        agg,
      });

      const response = await fetch(`/api/telemetry/history?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch historical telemetry");
      }
      return response.json() as Promise<HistoricalTelemetryResponse>;
    },
    enabled: enabled && !!deviceId && !!startTs && !!endTs,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Transform telemetry data for Recharts
export function transformTelemetryForChart(
  data: Record<string, TelemetryDataPoint[]> | undefined
): Array<Record<string, number | string>> {
  if (!data) return [];

  // Get all unique timestamps across all keys
  const allTimestamps = new Set<number>();
  Object.values(data).forEach((points) => {
    points.forEach((point) => allTimestamps.add(point.ts));
  });

  // Sort timestamps
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  // Create data points for each timestamp
  return sortedTimestamps.map((ts) => {
    const point: Record<string, number | string> = { ts };

    Object.entries(data).forEach(([key, points]) => {
      const matchingPoint = points.find((p) => p.ts === ts);
      if (matchingPoint) {
        const value = matchingPoint.value;
        point[key] = typeof value === "string" ? parseFloat(value) || 0 : value;
      }
    });

    return point;
  });
}
