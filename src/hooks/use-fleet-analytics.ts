"use client";

import { useQuery } from "@tanstack/react-query";

interface DeviceMetric {
  deviceId: string;
  deviceName: string;
  speed: number | null;
  battery: number | null;
  lastActivityTime: number | null;
}

interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  averageSpeed: number | null;
  averageBattery: number | null;
  totalDistance: number | null;
  deviceMetrics: DeviceMetric[];
}

interface UseFleetAnalyticsOptions {
  keys?: string[];
  enabled?: boolean;
}

export function useFleetAnalytics(options: UseFleetAnalyticsOptions = {}) {
  const { keys = ["speed", "battery"], enabled = true } = options;

  return useQuery({
    queryKey: ["fleetAnalytics", keys],
    queryFn: async () => {
      const params = new URLSearchParams({ keys: keys.join(",") });
      const response = await fetch(`/api/analytics/fleet?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch fleet analytics");
      }
      return response.json() as Promise<FleetMetrics>;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}
