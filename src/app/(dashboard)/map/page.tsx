"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer } from "@/components/map/map-container";
import { useDevices } from "@/hooks/use-devices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Radio } from "lucide-react";
import { ACTIVE_WINDOW_MINUTES } from "@/lib/constants";

const POLL_OPTIONS = [
  { label: "30s", value: 30 * 1000 },
  { label: "1 min", value: 60 * 1000 },
  { label: "5 min", value: 5 * 60 * 1000 },
  { label: "10 min", value: 10 * 60 * 1000 },
] as const;

export default function MapPage() {
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(60 * 1000);
  const { data, isLoading, error, dataUpdatedAt } = useDevices(
    { fetchAll: true },
    { refetchInterval: pollIntervalMs }
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "lastTelemetryAt">("name");
  const [now, setNow] = useState(() => Date.now());

  // Update `now` on a regular interval
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const allDevices = data?.data || [];

  // Use dataUpdatedAt to get current time when data refreshes
  // This ensures new active devices appear immediately after a refetch
  const effectiveNow = dataUpdatedAt || now;

  const devicesWithLiveStatus = useMemo(() => {
    const activeWindowMs = ACTIVE_WINDOW_MINUTES * 60 * 1000;
    return allDevices.map((device) => {
      const lastTelemetryAt = device.lastTelemetryAt
        ? new Date(device.lastTelemetryAt).getTime()
        : null;
      const isActive =
        lastTelemetryAt !== null &&
        !Number.isNaN(lastTelemetryAt) &&
        effectiveNow - lastTelemetryAt <= activeWindowMs;
      return { ...device, isActive };
    });
  }, [allDevices, effectiveNow]);

  // Only show active devices on the map
  const activeDevices = useMemo(
    () => devicesWithLiveStatus.filter((d) => d.isActive),
    [devicesWithLiveStatus]
  );

  // Filter by search query for the sidebar list
  const filteredDevices = useMemo(
    () =>
      activeDevices.filter(
        (device) =>
          device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          device.type.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [activeDevices, searchQuery]
  );

  const sortedDevices = useMemo(() => {
    const next = [...filteredDevices];
    if (sortMode === "lastTelemetryAt") {
      next.sort((a, b) => {
        const aTime = a.lastTelemetryAt
          ? new Date(a.lastTelemetryAt).getTime()
          : 0;
        const bTime = b.lastTelemetryAt
          ? new Date(b.lastTelemetryAt).getTime()
          : 0;
        return bTime - aTime;
      });
    } else {
      next.sort((a, b) => a.name.localeCompare(b.name));
    }
    return next;
  }, [filteredDevices, sortMode]);

  const activeCount = activeDevices.length;
  const inactiveCount = devicesWithLiveStatus.length - activeCount;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Failed to load devices</p>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-6">
      <div className="w-80 flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Device Status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">
                  {isLoading ? "…" : activeCount} Active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm">
                  {isLoading ? "…" : inactiveCount} Inactive
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Refresh</span>
              <Select
                value={String(pollIntervalMs)}
                onValueChange={(value) => setPollIntervalMs(Number(value))}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLL_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={String(option.value)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card className="flex-1 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Active Devices ({filteredDevices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 pb-2 pt-1">
              <Select
                value={sortMode}
                onValueChange={(value) =>
                  setSortMode(value as "name" | "lastTelemetryAt")
                }
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="lastTelemetryAt">
                    Sort: Last update
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y">
                  {sortedDevices.map((device) => (
                    <li
                      key={device.id}
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={`p-3 cursor-pointer hover:bg-slate-50 transition-colors ${
                        selectedDeviceId === device.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{device.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {device.type}
                          </p>
                        </div>
                        <Badge variant="success" className="text-xs">
                          Active
                        </Badge>
                      </div>
                      {device.location && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {device.location.lat.toFixed(4)},{" "}
                          {device.location.lng.toFixed(4)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Last update:{" "}
                        {device.lastTelemetryAt
                          ? new Date(device.lastTelemetryAt).toLocaleString()
                          : "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full">
          {isLoading ? (
            <Skeleton className="w-full h-full" />
          ) : (
            <MapContainer
              devices={filteredDevices}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={setSelectedDeviceId}
              className="h-full"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
