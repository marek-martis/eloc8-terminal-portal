"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-provider";
import type { Device } from "@/hooks/use-devices";

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (deviceId: string, keys?: string[]) => number;
  unsubscribe: (subscriptionId: number, deviceId: string) => void;
  subscribeToMultiple: (deviceIds: string[], keys?: string[]) => number[];
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

type TelemetryValue =
  | Array<{ ts?: number; value?: unknown }>
  | Array<[number, unknown]>
  | { ts?: number; value?: unknown }
  | number
  | string
  | null
  | undefined;

function normalizeTelemetryValue(value: TelemetryValue) {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const last = value[value.length - 1];
    if (Array.isArray(last)) {
      const ts = typeof last[0] === "number" ? last[0] : Number(last[0]);
      return { ts: Number.isNaN(ts) ? undefined : ts, value: last[1] };
    }
    if (last && typeof last === "object") {
      const obj = last as { ts?: unknown; value?: unknown };
      const ts = typeof obj.ts === "number" ? obj.ts : Number(obj.ts);
      return { ts: Number.isNaN(ts) ? undefined : ts, value: obj.value };
    }
    return { value: last };
  }

  if (value && typeof value === "object") {
    const obj = value as { ts?: unknown; value?: unknown };
    const ts = typeof obj.ts === "number" ? obj.ts : Number(obj.ts);
    return { ts: Number.isNaN(ts) ? undefined : ts, value: obj.value };
  }

  if (typeof value === "number" || typeof value === "string") {
    return { value };
  }

  return null;
}

function extractNumericTelemetry(
  data: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const normalized = normalizeTelemetryValue(data[key] as TelemetryValue);
    if (!normalized) continue;
    const numeric = typeof normalized.value === "number"
      ? normalized.value
      : Number(normalized.value);
    if (!Number.isNaN(numeric)) {
      return { value: numeric, ts: normalized.ts };
    }
  }
  return { value: null as number | null, ts: undefined as number | undefined };
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const cmdIdRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionsRef = useRef<Map<number, string>>(new Map());
  const connectRef = useRef<() => void>(() => {});
  const queryClient = useQueryClient();
  const { accessToken, isAuthenticated } = useAuth();

  const sendSubscription = useCallback(
    (deviceId: string, cmdId: number, keys?: string[]) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const subscribeCmd = {
        tsSubCmds: [
          {
            cmdId,
            entityType: "DEVICE",
            entityId: deviceId,
            scope: "LATEST_TELEMETRY",
            ...(keys && { keys }),
          },
        ],
      };

      wsRef.current.send(JSON.stringify(subscribeCmd));
    },
    []
  );

  const handleMessage = useCallback(
    (message: { subscriptionId?: number; data?: Record<string, unknown> }) => {
      if (message.subscriptionId !== undefined && message.data) {
        const deviceId = subscriptionsRef.current.get(message.subscriptionId);
        if (deviceId) {
          const lat = extractNumericTelemetry(message.data, [
            "latitude",
            "lat",
          ]);
          const lng = extractNumericTelemetry(message.data, [
            "longitude",
            "lng",
          ]);
          const telemetryTs = Math.max(lat.ts ?? 0, lng.ts ?? 0);
          const lastTelemetryAt = telemetryTs
            ? new Date(telemetryTs).toISOString()
            : new Date().toISOString();

          queryClient.setQueryData(
            ["telemetry", deviceId],
            (old: Record<string, unknown> | undefined) => ({
              ...old,
              ...message.data,
              _lastUpdate: Date.now(),
            })
          );

          if (lat.value !== null || lng.value !== null) {
            queryClient.setQueriesData(
              {
                predicate: (query) =>
                  Array.isArray(query.queryKey) &&
                  query.queryKey[0] === "devices",
              },
              (
                old:
                  | { data: Device[]; total: number }
                  | undefined
              ) => {
                if (!old?.data) return old;
                let updated = false;
                const nextData = old.data.map((device) => {
                  if (device.id !== deviceId) return device;
                  const nextLat =
                    lat.value !== null ? lat.value : device.location?.lat;
                  const nextLng =
                    lng.value !== null ? lng.value : device.location?.lng;
                  if (
                    typeof nextLat !== "number" ||
                    typeof nextLng !== "number" ||
                    Number.isNaN(nextLat) ||
                    Number.isNaN(nextLng)
                  ) {
                    return device;
                  }
                  updated = true;
                  return {
                    ...device,
                    location: { lat: nextLat, lng: nextLng },
                    lastTelemetryAt,
                  };
                });
                if (!updated) return old;
                return { ...old, data: nextData };
              }
            );
          }

          queryClient.invalidateQueries({
            queryKey: ["device", deviceId, "telemetry"],
            refetchType: "none",
          });
        }
      }
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) return;

    const wsUrl = process.env.NEXT_PUBLIC_THINGSBOARD_WS_URL;
    if (!wsUrl) {
      console.error("WebSocket URL not configured");
      return;
    }

    wsRef.current = new WebSocket(`${wsUrl}?token=${accessToken}`);

    wsRef.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      subscriptionsRef.current.forEach((deviceId, cmdId) => {
        sendSubscription(deviceId, cmdId);
      });
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    wsRef.current.onclose = () => {
      console.log("WebSocket disconnected");
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), 5000);
    };

    wsRef.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [isAuthenticated, accessToken, sendSubscription, handleMessage]);

  // Keep connectRef in sync with connect
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const subscribe = useCallback(
    (deviceId: string, keys?: string[]): number => {
      const cmdId = ++cmdIdRef.current;
      subscriptionsRef.current.set(cmdId, deviceId);
      sendSubscription(deviceId, cmdId, keys);
      return cmdId;
    },
    [sendSubscription]
  );

  const unsubscribe = useCallback((subscriptionId: number, deviceId: string) => {
    subscriptionsRef.current.delete(subscriptionId);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const unsubscribeCmd = {
      tsSubCmds: [
        {
          cmdId: subscriptionId,
          entityType: "DEVICE",
          entityId: deviceId,
        },
      ],
    };

    wsRef.current.send(JSON.stringify(unsubscribeCmd));
  }, []);

  const subscribeToMultiple = useCallback(
    (deviceIds: string[], keys?: string[]): number[] => {
      return deviceIds.map((deviceId) => subscribe(deviceId, keys));
    },
    [subscribe]
  );

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider
      value={{ isConnected, subscribe, unsubscribe, subscribeToMultiple }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return context;
}
