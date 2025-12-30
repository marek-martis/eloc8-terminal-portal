"use client";

import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "react-day-picker";

interface DeviceEvent {
  id: string;
  timestamp: number;
  type: string;
  deviceId: string;
  details: Record<string, unknown>;
}

interface EventsResponse {
  events: DeviceEvent[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalElements: number;
    hasNext: boolean;
  };
}

interface UseDeviceEventsOptions {
  eventType?: string;
  pageSize?: number;
  page?: number;
  enabled?: boolean;
}

export function useDeviceEvents(
  deviceId: string | undefined,
  dateRange: DateRange | undefined,
  options: UseDeviceEventsOptions = {}
) {
  const {
    eventType = "LC_EVENT",
    pageSize = 50,
    page = 0,
    enabled = true,
  } = options;

  const startTs = dateRange?.from?.getTime();
  const endTs = dateRange?.to?.getTime();

  return useQuery({
    queryKey: ["deviceEvents", deviceId, startTs, endTs, eventType, pageSize, page],
    queryFn: async () => {
      if (!deviceId) {
        throw new Error("Device ID is required");
      }

      const params = new URLSearchParams({
        deviceId,
        eventType,
        pageSize: String(pageSize),
        page: String(page),
      });

      if (startTs) params.set("startTs", String(startTs));
      if (endTs) params.set("endTs", String(endTs));

      const response = await fetch(`/api/events?${params}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch device events");
      }
      return response.json() as Promise<EventsResponse>;
    },
    enabled: enabled && !!deviceId,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Helper to format event type for display
export function formatEventType(type: string): string {
  const typeMap: Record<string, string> = {
    LC_EVENT: "Lifecycle",
    STATS: "Statistics",
    DEBUG_RULE_NODE: "Debug",
    DEBUG_RULE_CHAIN: "Rule Chain Debug",
    ERROR: "Error",
  };
  return typeMap[type] || type;
}

// Helper to get event description from details
export function getEventDescription(event: DeviceEvent): string {
  const details = event.details;

  if (details.event === "CONNECT") {
    return "Device connected";
  } else if (details.event === "DISCONNECT") {
    return "Device disconnected";
  } else if (details.event === "ACTIVITY") {
    return "Device activity detected";
  } else if (details.event === "INACTIVITY") {
    return "Device became inactive";
  }

  return details.event as string || "Event occurred";
}
