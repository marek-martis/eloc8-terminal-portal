"use client";

import { useQuery } from "@tanstack/react-query";

interface DeviceTypeSummary {
  total: number;
  uniqueTypes: number;
  types: Record<string, number>;
}

export function useDeviceTypeSummary() {
  return useQuery({
    queryKey: ["deviceTypeSummary"],
    queryFn: async () => {
      const response = await fetch("/api/devices/type-summary");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch device type summary");
      }
      return response.json() as Promise<DeviceTypeSummary>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
