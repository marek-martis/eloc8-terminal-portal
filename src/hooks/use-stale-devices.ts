"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface StaleDeviceDetail {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceProfileId: string | null;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  firstSeenStaleAt: string;
  consecutiveStaleDays: number;
}

export interface StaleDeviceRemoval extends StaleDeviceDetail {
  daysWasStale: number;
}

export interface SnapshotData {
  id: string;
  snapshotDate: string;
  staleDays: number;
  totalDevices: number;
  staleCount: number;
  devices: StaleDeviceDetail[];
}

export interface StaleDevicesResponse {
  currentSnapshot: SnapshotData | null;
  comparisonSnapshot: SnapshotData | null;
  analysis: {
    longestStale: StaleDeviceDetail[];
    newAdditions: StaleDeviceDetail[];
    removals: StaleDeviceRemoval[];
  };
  availableDates: string[];
  availableDeviceTypes: string[];
}

interface UseStaleDeviceSnapshotsParams {
  date: string;
  compareDate?: string;
  deviceTypes?: string[];
  deviceProfileIds?: string[];
}

/**
 * Fetch stale device snapshots for comparison
 */
export function useStaleDeviceSnapshots(params: UseStaleDeviceSnapshotsParams) {
  return useQuery({
    queryKey: ["staleDevices", params.date, params.compareDate, params.deviceTypes, params.deviceProfileIds],
    queryFn: async () => {
      const searchParams = new URLSearchParams({ date: params.date });
      if (params.compareDate) {
        searchParams.set("compareDate", params.compareDate);
      }
      if (params.deviceTypes?.length) {
        searchParams.set("deviceTypes", params.deviceTypes.join(","));
      }
      if (params.deviceProfileIds?.length) {
        searchParams.set("deviceProfileIds", params.deviceProfileIds.join(","));
      }

      const response = await fetch(`/api/stale-devices?${searchParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch stale device data");
      }
      return response.json() as Promise<StaleDevicesResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!params.date,
  });
}

/**
 * Fetch list of available snapshot dates
 */
export function useAvailableSnapshotDates() {
  return useQuery({
    queryKey: ["staleDeviceDates"],
    queryFn: async () => {
      const response = await fetch("/api/stale-devices/dates");
      if (!response.ok) {
        throw new Error("Failed to fetch available dates");
      }
      return response.json() as Promise<{ dates: string[] }>;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

interface TriggerSnapshotParams {
  staleDays?: number;
}

interface SnapshotResult {
  message: string;
  snapshot: {
    id: string;
    snapshotDate: string;
    staleDays: number;
    totalDevices: number;
    staleCount: number;
    createdAt: string;
  };
}

/**
 * Manually trigger a snapshot creation (admin utility)
 */
export function useTriggerSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: TriggerSnapshotParams) => {
      const response = await fetch("/api/stale-devices/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = error.error ? `: ${error.error}` : "";
        throw new Error((error.message || "Failed to trigger snapshot") + detail);
      }

      return response.json() as Promise<SnapshotResult>;
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["staleDevices"] });
      queryClient.invalidateQueries({ queryKey: ["staleDeviceDates"] });
    },
  });
}
