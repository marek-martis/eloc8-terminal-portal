"use client";

import Link from "next/link";
import { useDeviceStats } from "@/hooks/use-device-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Map,
  BarChart3,
  Settings,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDeviceStats();

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-red-500">Failed to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Fleet overview and device status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Devices
                </CardTitle>
                <Radio className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{stats?.total ?? 0}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Registered in fleet
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Devices
                </CardTitle>
                <Wifi className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600">
                  {stats?.active ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Currently reporting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Inactive Devices
                </CardTitle>
                <WifiOff className="h-5 w-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-500">
                  {stats?.inactive ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Not currently reporting
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stale Devices
                </CardTitle>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-amber-600">
                  {stats?.stale ?? 0}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  No data for {stats?.staleDays ?? 2}+ days
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/map">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Map className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Live Map</h3>
                  <p className="text-sm text-muted-foreground">
                    View device locations
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/analytics">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Analytics</h3>
                  <p className="text-sm text-muted-foreground">
                    Fleet metrics and reports
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings">
            <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <Settings className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure preferences
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
