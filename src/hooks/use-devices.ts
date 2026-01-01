"use client";

import { useQuery } from "@tanstack/react-query";

interface DeviceFilters {
  type?: string;
  status?: "active" | "inactive" | "all";
  search?: string;
  pageSize?: number;
  page?: number;
  fetchAll?: boolean;
  sortBy?: "name" | "lastActivityTime";
  sortDir?: "ASC" | "DESC";
}

export interface Device {
  id: string;
  name: string;
  type: string;
  label?: string;
  isActive: boolean;
  location?: {
    lat: number;
    lng: number;
  };
  lastTelemetryAt?: string;
}

interface UseDevicesOptions {
  refetchInterval?: number | false;
}

export function useDevices(filters?: DeviceFilters, options?: UseDevicesOptions) {
  return useQuery({
    queryKey: ["devices", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.set("type", filters.type);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
      if (filters?.page) params.set("page", String(filters.page));
      if (filters?.fetchAll) params.set("fetchAll", "true");
      if (filters?.sortBy) params.set("sortBy", filters.sortBy);
      if (filters?.sortDir) params.set("sortDir", filters.sortDir);

      const response = await fetch(`/api/devices?${params}`);
      if (!response.ok) throw new Error("Failed to fetch devices");
      return response.json() as Promise<{ data: Device[]; total: number }>;
    },
    staleTime: 30 * 1000,
    refetchInterval: options?.refetchInterval,
  });
}

/**
 * Hook to fetch all devices (handles pagination internally)
 * Use this for analytics, reports, or anywhere you need the complete device list
 */
export function useAllDevices(
  filters?: Omit<DeviceFilters, "page" | "pageSize" | "fetchAll">,
  options?: UseDevicesOptions
) {
  return useDevices({ ...filters, fetchAll: true }, options);
}

export function useDevice(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      if (!deviceId) throw new Error("No device ID");
      const response = await fetch(`/api/devices/${deviceId}`);
      if (!response.ok) throw new Error("Failed to fetch device");
      return response.json() as Promise<Device>;
    },
    enabled: !!deviceId,
  });
}

export function useDeviceTypes() {
  return useQuery({
    queryKey: ["deviceTypes"],
    queryFn: async () => {
      const response = await fetch("/api/devices/types");
      if (!response.ok) throw new Error("Failed to fetch device types");
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
