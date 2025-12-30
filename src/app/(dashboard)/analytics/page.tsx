"use client";

import { useState } from "react";
import { subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useAllDevices } from "@/hooks/use-devices";
import { useFleetAnalytics } from "@/hooks/use-fleet-analytics";
import {
  useHistoricalTelemetry,
  transformTelemetryForChart,
} from "@/hooks/use-historical-telemetry";
import { useDeviceEvents } from "@/hooks/use-device-events";
import { MetricCard } from "@/components/charts/metric-card";
import { DeviceStatusChart } from "@/components/charts/device-status-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ActivityTimeline } from "@/components/charts/activity-timeline";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ExportButton } from "@/components/ui/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Radio,
  Wifi,
  WifiOff,
  Activity,
  Gauge,
  Battery,
  TrendingUp,
} from "lucide-react";
import { DEFAULT_TELEMETRY_KEYS } from "@/lib/constants";

export default function AnalyticsPage() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [telemetryKeys] = useState<string[]>(DEFAULT_TELEMETRY_KEYS);

  const { data: devicesData, isLoading: isLoadingDevices, error } = useAllDevices();
  const { data: fleetData, isLoading: isLoadingFleet } = useFleetAnalytics();
  const { data: historicalData, isLoading: isLoadingHistory } = useHistoricalTelemetry(
    selectedDeviceId || undefined,
    dateRange,
    { keys: telemetryKeys, enabled: !!selectedDeviceId }
  );
  const { data: eventsData, isLoading: isLoadingEvents } = useDeviceEvents(
    selectedDeviceId || undefined,
    dateRange,
    { enabled: !!selectedDeviceId }
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Failed to load analytics data</p>
      </div>
    );
  }

  const devices = devicesData?.data || [];
  const onlineCount = devices.filter((d) => d.isActive).length;
  const offlineCount = devices.length - onlineCount;
  const onlinePercentage =
    devices.length > 0 ? Math.round((onlineCount / devices.length) * 100) : 0;

  const deviceTypes = devices.reduce(
    (acc, device) => {
      acc[device.type] = (acc[device.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const chartData = transformTelemetryForChart(historicalData?.data);
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Fleet metrics and device telemetry analysis
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <ExportButton
            deviceId={selectedDeviceId}
            deviceName={selectedDevice?.name}
            dateRange={dateRange}
            keys={telemetryKeys}
            disabled={!selectedDeviceId}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry Charts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="fleet">Fleet Metrics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingDevices ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </>
            ) : (
              <>
                <MetricCard
                  title="Total Devices"
                  value={devices.length}
                  icon={<Radio className="h-4 w-4 text-muted-foreground" />}
                />
                <MetricCard
                  title="Online"
                  value={onlineCount}
                  icon={<Wifi className="h-4 w-4 text-green-500" />}
                  trend={{
                    value: onlinePercentage,
                    direction: onlinePercentage > 80 ? "up" : "down",
                    label: "of fleet",
                  }}
                />
                <MetricCard
                  title="Offline"
                  value={offlineCount}
                  icon={<WifiOff className="h-4 w-4 text-red-500" />}
                />
                <MetricCard
                  title="Device Types"
                  value={Object.keys(deviceTypes).length}
                  icon={<Activity className="h-4 w-4 text-muted-foreground" />}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDevices ? (
                  <Skeleton className="h-[250px]" />
                ) : (
                  <DeviceStatusChart online={onlineCount} offline={offlineCount} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Types</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDevices ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-10" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(deviceTypes).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="font-medium">{type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{count}</span>
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${(count / devices.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingDevices ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {devices
                    .filter((d) => d.lastTelemetryAt)
                    .sort(
                      (a, b) =>
                        new Date(b.lastTelemetryAt!).getTime() -
                        new Date(a.lastTelemetryAt!).getTime()
                    )
                    .slice(0, 10)
                    .map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              device.isActive ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <div>
                            <p className="font-medium text-sm">{device.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.type}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {device.lastTelemetryAt
                            ? new Date(device.lastTelemetryAt).toLocaleString()
                            : "Never"}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telemetry Charts Tab */}
        <TabsContent value="telemetry" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle>Device Telemetry History</CardTitle>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedDeviceId ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Select a device to view telemetry history
                </div>
              ) : isLoadingHistory ? (
                <Skeleton className="h-[300px]" />
              ) : (
                <TimeSeriesChart
                  data={chartData}
                  dataKeys={telemetryKeys}
                  height={300}
                />
              )}
            </CardContent>
          </Card>

          {selectedDeviceId && chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {telemetryKeys.map((key) => {
                const values = chartData
                  .map((d) => d[key])
                  .filter((v): v is number => typeof v === "number");
                const avg = values.length > 0
                  ? values.reduce((a, b) => a + b, 0) / values.length
                  : null;
                const max = values.length > 0 ? Math.max(...values) : null;
                const min = values.length > 0 ? Math.min(...values) : null;

                return (
                  <Card key={key}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium capitalize">
                        {key} Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Average</span>
                        <span className="font-medium">
                          {avg !== null ? avg.toFixed(2) : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Maximum</span>
                        <span className="font-medium">
                          {max !== null ? max.toFixed(2) : "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Minimum</span>
                        <span className="font-medium">
                          {min !== null ? min.toFixed(2) : "N/A"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle>Device Activity Timeline</CardTitle>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select a device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {!selectedDeviceId ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  Select a device to view activity timeline
                </div>
              ) : (
                <ActivityTimeline
                  events={eventsData?.events || []}
                  isLoading={isLoadingEvents}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fleet Metrics Tab */}
        <TabsContent value="fleet" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingFleet ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </>
            ) : (
              <>
                <MetricCard
                  title="Total Devices"
                  value={fleetData?.totalDevices ?? 0}
                  icon={<Radio className="h-4 w-4 text-blue-500" />}
                />
                <MetricCard
                  title="Active Now"
                  value={fleetData?.activeDevices ?? 0}
                  icon={<Activity className="h-4 w-4 text-green-500" />}
                />
                <MetricCard
                  title="Avg Speed"
                  value={
                    fleetData?.averageSpeed !== null
                      ? `${fleetData?.averageSpeed}`
                      : "N/A"
                  }
                  icon={<Gauge className="h-4 w-4 text-amber-500" />}
                />
                <MetricCard
                  title="Avg Battery"
                  value={
                    fleetData?.averageBattery !== null
                      ? `${fleetData?.averageBattery}%`
                      : "N/A"
                  }
                  icon={<Battery className="h-4 w-4 text-green-500" />}
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Device Metrics Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFleet ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Device</th>
                        <th className="text-right py-3 px-2 font-medium">Speed</th>
                        <th className="text-right py-3 px-2 font-medium">Battery</th>
                        <th className="text-right py-3 px-2 font-medium">
                          Last Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fleetData?.deviceMetrics.slice(0, 20).map((device) => (
                        <tr key={device.deviceId} className="border-b last:border-0">
                          <td className="py-3 px-2">{device.deviceName}</td>
                          <td className="py-3 px-2 text-right">
                            {device.speed !== null ? device.speed.toFixed(1) : "—"}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {device.battery !== null ? `${device.battery}%` : "—"}
                          </td>
                          <td className="py-3 px-2 text-right text-muted-foreground">
                            {device.lastActivityTime
                              ? new Date(device.lastActivityTime).toLocaleString()
                              : "Never"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
