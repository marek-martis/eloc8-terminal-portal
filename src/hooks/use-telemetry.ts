"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/providers/websocket-provider";

interface TelemetryData {
  [key: string]: Array<{ ts: number; value: string | number | boolean }>;
}

export function useTelemetry(
  deviceId: string | undefined,
  options?: {
    keys?: string[];
    enabled?: boolean;
  }
) {
  const { subscribe, unsubscribe, isConnected } = useWebSocket();
  const subscriptionIdRef = useRef<number | null>(null);

  const query = useQuery<TelemetryData>({
    queryKey: ["telemetry", deviceId],
    queryFn: async () => {
      if (!deviceId) throw new Error("No device ID");
      const keysParam = options?.keys ? `&keys=${options.keys.join(",")}` : "";
      const response = await fetch(
        `/api/telemetry?deviceId=${deviceId}${keysParam}`
      );
      if (!response.ok) throw new Error("Failed to fetch telemetry");
      return response.json();
    },
    enabled: !!deviceId && options?.enabled !== false,
    staleTime: 30000,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!deviceId || !isConnected || options?.enabled === false) return;

    subscriptionIdRef.current = subscribe(deviceId, options?.keys);

    return () => {
      if (subscriptionIdRef.current !== null) {
        unsubscribe(subscriptionIdRef.current, deviceId);
        subscriptionIdRef.current = null;
      }
    };
  }, [
    deviceId,
    isConnected,
    subscribe,
    unsubscribe,
    options?.keys,
    options?.enabled,
  ]);

  return {
    ...query,
    isLive: isConnected,
  };
}

export function useMultipleTelemetry(
  deviceIds: string[],
  options?: { keys?: string[] }
) {
  const { subscribeToMultiple, unsubscribe, isConnected } = useWebSocket();
  const subscriptionIdsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isConnected || deviceIds.length === 0) return;

    subscriptionIdsRef.current = subscribeToMultiple(deviceIds, options?.keys);

    return () => {
      subscriptionIdsRef.current.forEach((id, index) => {
        unsubscribe(id, deviceIds[index]);
      });
      subscriptionIdsRef.current = [];
    };
  }, [
    deviceIds,
    isConnected,
    subscribeToMultiple,
    unsubscribe,
    options?.keys,
  ]);

  return { isLive: isConnected };
}
