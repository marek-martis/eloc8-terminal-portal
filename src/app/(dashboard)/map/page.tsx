"use client";

import { useState } from "react";
import { MapContainer } from "@/components/map/map-container";
import { useDevices } from "@/hooks/use-devices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Radio } from "lucide-react";

export default function MapPage() {
  const { data, isLoading, error } = useDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");

  const allDevices = data?.data || [];

  // Only show active devices on the map
  const activeDevices = allDevices.filter((d) => d.isActive);

  // Filter by search query for the sidebar list
  const filteredDevices = activeDevices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = activeDevices.length;
  const inactiveCount = allDevices.length - activeCount;

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
          <CardContent className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">{activeCount} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm">{inactiveCount} Inactive</span>
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
            <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y">
                  {filteredDevices.map((device) => (
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
