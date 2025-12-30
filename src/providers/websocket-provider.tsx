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

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (deviceId: string, keys?: string[]) => number;
  unsubscribe: (subscriptionId: number, deviceId: string) => void;
  subscribeToMultiple: (deviceIds: string[], keys?: string[]) => number[];
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

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
          queryClient.setQueryData(
            ["telemetry", deviceId],
            (old: Record<string, unknown> | undefined) => ({
              ...old,
              ...message.data,
              _lastUpdate: Date.now(),
            })
          );

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
