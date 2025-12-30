"use client";

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_STALE_DAYS } from "@/lib/constants";

interface DeviceStats {
  total: number;
  active: number;
  inactive: number;
  stale: number;
  staleDays: number;
}

export function useDeviceStats(staleDays: number = DEFAULT_STALE_DAYS) {
  return useQuery({
    queryKey: ["deviceStats", staleDays],
    queryFn: async () => {
      const params = new URLSearchParams({ staleDays: String(staleDays) });
      const response = await fetch(`/api/devices/stats?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch device stats");
      }
      return response.json() as Promise<DeviceStats>;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
