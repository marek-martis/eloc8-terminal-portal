"use client";

import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import {
  useStaleDeviceSnapshots,
  useAvailableSnapshotDates,
  useTriggerSnapshot,
  type StaleDeviceDetail,
  type StaleDeviceRemoval,
} from "@/hooks/use-stale-devices";
import { useDeviceProfiles } from "@/hooks/use-device-profiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { STALE_THRESHOLD_OPTIONS } from "@/lib/constants";

function MetricCard({
  title,
  value,
  icon,
  subtitle,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: { value: number; direction: "up" | "down" };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div
            className={`flex items-center text-sm mt-1 ${
              trend.direction === "up" ? "text-red-500" : "text-green-500"
            }`}
          >
            {trend.direction === "up" ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            {trend.value > 0 ? "+" : ""}
            {trend.value} from comparison
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type SortField = "deviceName" | "deviceType" | "lastActivityAt" | "daysSinceActivity" | "consecutiveStaleDays";
type SortDirection = "asc" | "desc";

function SortableHeader({
  label,
  field,
  currentField,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentField: SortField | null;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = currentField === field;
  return (
    <th
      className={`py-3 px-2 font-medium cursor-pointer hover:bg-slate-100 select-none ${
        align === "right" ? "text-right" : "text-left"
      }`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        <span>{label}</span>
        {isActive ? (
          direction === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </th>
  );
}

function DeviceTable({
  devices,
  showDaysWasStale = false,
  emptyMessage = "No devices found",
}: {
  devices: (StaleDeviceDetail | StaleDeviceRemoval)[];
  showDaysWasStale?: boolean;
  emptyMessage?: string;
}) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedDevices = useMemo(() => {
    if (!sortField) return devices;

    return [...devices].sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortField) {
        case "deviceName":
          aVal = a.deviceName.toLowerCase();
          bVal = b.deviceName.toLowerCase();
          break;
        case "deviceType":
          aVal = a.deviceType.toLowerCase();
          bVal = b.deviceType.toLowerCase();
          break;
        case "lastActivityAt":
          aVal = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          bVal = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          break;
        case "daysSinceActivity":
          aVal = a.daysSinceActivity;
          bVal = b.daysSinceActivity;
          break;
        case "consecutiveStaleDays":
          aVal = showDaysWasStale && "daysWasStale" in a
            ? (a as StaleDeviceRemoval).daysWasStale
            : a.consecutiveStaleDays;
          bVal = showDaysWasStale && "daysWasStale" in b
            ? (b as StaleDeviceRemoval).daysWasStale
            : b.consecutiveStaleDays;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [devices, sortField, sortDirection, showDaysWasStale]);

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <SortableHeader
              label="Device"
              field="deviceName"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Type"
              field="deviceType"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
            />
            <SortableHeader
              label="Last Activity"
              field="lastActivityAt"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label="Days Inactive"
              field="daysSinceActivity"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
            <SortableHeader
              label={showDaysWasStale ? "Days Was Stale" : "Days on List"}
              field="consecutiveStaleDays"
              currentField={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sortedDevices.map((device) => (
            <tr
              key={device.deviceId}
              className="border-b last:border-0 hover:bg-slate-50"
            >
              <td className="py-3 px-2 font-medium">{device.deviceName}</td>
              <td className="py-3 px-2">
                <Badge variant="outline">{device.deviceType}</Badge>
              </td>
              <td className="py-3 px-2 text-right text-muted-foreground">
                {device.lastActivityAt
                  ? format(new Date(device.lastActivityAt), "MMM d, yyyy HH:mm")
                  : "Never"}
              </td>
              <td className="py-3 px-2 text-right">
                <Badge
                  variant={device.daysSinceActivity > 7 ? "destructive" : "secondary"}
                >
                  {device.daysSinceActivity === 999
                    ? "N/A"
                    : `${device.daysSinceActivity}d`}
                </Badge>
              </td>
              <td className="py-3 px-2 text-right">
                <Badge variant="outline">
                  {showDaysWasStale && "daysWasStale" in device
                    ? (device as StaleDeviceRemoval).daysWasStale
                    : device.consecutiveStaleDays}
                  d
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StaleDevicesPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [compareDate, setCompareDate] = useState<string>(yesterday);
  const [threshold, setThreshold] = useState<number>(2);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);

  const { data: datesData, isLoading: isLoadingDates } =
    useAvailableSnapshotDates();
  const { data: profilesData, isLoading: isLoadingProfiles } =
    useDeviceProfiles();
  const { data: snapshotData, isLoading: isLoadingSnapshots } =
    useStaleDeviceSnapshots({
      date: selectedDate,
      compareDate,
      deviceProfileIds: selectedProfiles,
    });

  const triggerSnapshot = useTriggerSnapshot();

  const availableDates = datesData?.dates || [];
  const profileOptions = useMemo(
    () =>
      profilesData?.map((profile) => ({
        label: profile.name,
        value: profile.id,
      })) || [],
    [profilesData]
  );

  // Use actual snapshot date if available, otherwise show selected
  const effectiveDate =
    snapshotData?.currentSnapshot?.snapshotDate || selectedDate;
  const effectiveCompareDate =
    snapshotData?.comparisonSnapshot?.snapshotDate || compareDate;

  // Calculate metrics
  const staleCount = snapshotData?.currentSnapshot?.staleCount ?? 0;
  const compareStaleCount = snapshotData?.comparisonSnapshot?.staleCount ?? 0;
  const staleDiff = staleCount - compareStaleCount;

  const newAdditionsCount = snapshotData?.analysis.newAdditions.length ?? 0;
  const removalsCount = snapshotData?.analysis.removals.length ?? 0;

  const longestStaleDevice = snapshotData?.analysis.longestStale[0];
  const longestStaleDays = longestStaleDevice?.consecutiveStaleDays ?? 0;

  // Filter devices by threshold and selected profiles for display
  const filteredDevices = useMemo(() => {
    if (!snapshotData?.currentSnapshot?.devices) return [];

    let devices = snapshotData.currentSnapshot.devices.filter(
      (d) => d.daysSinceActivity >= threshold
    );

    if (selectedProfiles.length > 0) {
      devices = devices.filter((d) =>
        d.deviceProfileId
          ? selectedProfiles.includes(d.deviceProfileId)
          : false
      );
    }
    return devices;
  }, [snapshotData?.currentSnapshot?.devices, threshold, selectedProfiles]);

  const handleTriggerSnapshot = async () => {
    try {
      await triggerSnapshot.mutateAsync({ staleDays: threshold });
    } catch (error) {
      console.error("Failed to trigger snapshot:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Stale Device Tracking
          </h1>
          <p className="text-muted-foreground">
            Track devices that haven't communicated recently
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerSnapshot}
            disabled={triggerSnapshot.isPending}
          >
            {triggerSnapshot.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Capture Snapshot
          </Button>
        </div>
      </div>

      {/* Date, Threshold, and Profile Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Date:</span>
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={today}>Today</SelectItem>
                  {availableDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {format(new Date(date), "MMM d, yyyy")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-muted-foreground">compared to</span>

            <div className="flex items-center gap-2">
              <Select value={compareDate} onValueChange={setCompareDate}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={yesterday}>Yesterday</SelectItem>
                  {availableDates
                    .filter((d) => d !== selectedDate)
                    .map((date) => (
                      <SelectItem key={date} value={date}>
                        {format(new Date(date), "MMM d, yyyy")}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Profile:</span>
              <MultiSelect
                options={profileOptions}
                defaultValue={selectedProfiles}
                onValueChange={setSelectedProfiles}
                placeholder="Select profiles"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm font-medium">Threshold:</span>
              <Select
                value={String(threshold)}
                onValueChange={(v) => setThreshold(Number(v))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STALE_THRESHOLD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingSnapshots || isLoadingProfiles ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </>
        ) : (
          <>
            <MetricCard
              title="Total Stale"
              value={staleCount}
              icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              subtitle={`Threshold: ${snapshotData?.currentSnapshot?.staleDays ?? threshold}+ days`}
              trend={
                snapshotData?.comparisonSnapshot
                  ? {
                      value: staleDiff,
                      direction: staleDiff > 0 ? "up" : "down",
                    }
                  : undefined
              }
            />
            <MetricCard
              title="New Additions"
              value={newAdditionsCount}
              icon={<TrendingUp className="h-5 w-5 text-red-500" />}
              subtitle="Became stale since comparison"
            />
            <MetricCard
              title="Removed"
              value={removalsCount}
              icon={<TrendingDown className="h-5 w-5 text-green-500" />}
              subtitle="No longer stale since comparison"
            />
            <MetricCard
              title="Longest Stale"
              value={longestStaleDays > 0 ? `${longestStaleDays} days` : "N/A"}
              icon={<Clock className="h-5 w-5 text-blue-500" />}
              subtitle={longestStaleDevice?.deviceName || "No stale devices"}
            />
          </>
        )}
      </div>

      {/* No Data Message */}
      {!isLoadingSnapshots && !snapshotData?.currentSnapshot && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No Snapshot Available
              </h3>
              <p className="text-muted-foreground mb-4">
                No snapshot data exists for {selectedDate}. Click "Capture
                Snapshot" to create one now.
              </p>
              <Button onClick={handleTriggerSnapshot} disabled={triggerSnapshot.isPending}>
                {triggerSnapshot.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Capture Snapshot Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs with Device Tables */}
      {snapshotData?.currentSnapshot && (
        <Tabs defaultValue="longest" className="space-y-4">
          <TabsList>
            <TabsTrigger value="longest">
              Longest Stale ({snapshotData.analysis.longestStale.length})
            </TabsTrigger>
            <TabsTrigger value="new">
              New Additions ({newAdditionsCount})
            </TabsTrigger>
            <TabsTrigger value="removed">Removals ({removalsCount})</TabsTrigger>
            <TabsTrigger value="all">
              All Stale ({filteredDevices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="longest">
            <Card>
              <CardHeader>
                <CardTitle>Devices Stale the Longest</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSnapshots ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <DeviceTable
                    devices={snapshotData.analysis.longestStale}
                    emptyMessage="No stale devices in this snapshot"
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>
                  New Stale Devices (since {effectiveCompareDate})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSnapshots ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <DeviceTable
                    devices={snapshotData.analysis.newAdditions}
                    emptyMessage={
                      snapshotData.comparisonSnapshot
                        ? "No new stale devices since comparison date"
                        : "Select a comparison date to see new additions"
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="removed">
            <Card>
              <CardHeader>
                <CardTitle>
                  Devices Removed from Stale List (since {effectiveCompareDate})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSnapshots ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <DeviceTable
                    devices={snapshotData.analysis.removals}
                    showDaysWasStale
                    emptyMessage={
                      snapshotData.comparisonSnapshot
                        ? "No devices were removed from the stale list"
                        : "Select a comparison date to see removals"
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>
                  All Stale Devices ({effectiveDate})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSnapshots ? (
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : (
                  <DeviceTable
                    devices={filteredDevices}
                    emptyMessage={`No devices inactive for ${threshold}+ days`}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
