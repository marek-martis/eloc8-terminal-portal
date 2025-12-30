"use client";

import { useState } from "react";
import { useDevices } from "@/hooks/use-devices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Clock } from "lucide-react";

export default function DevicesPage() {
  const { data, isLoading, error } = useDevices();
  const [searchQuery, setSearchQuery] = useState("");

  const devices = data?.data || [];
  const filteredDevices = devices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Failed to load devices</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All Devices</h2>
          <p className="text-sm text-muted-foreground">
            {devices.length} devices registered
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{device.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {device.type}
                    </p>
                  </div>
                  <Badge
                    variant={device.isActive ? "success" : "destructive"}
                    className="text-xs"
                  >
                    {device.isActive ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {device.location && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {device.location.lat.toFixed(4)},{" "}
                      {device.location.lng.toFixed(4)}
                    </span>
                  </div>
                )}
                {device.lastTelemetryAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(device.lastTelemetryAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground font-mono truncate">
                  ID: {device.id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredDevices.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No devices found</p>
        </div>
      )}
    </div>
  );
}
