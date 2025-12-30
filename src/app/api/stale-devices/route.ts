import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { parseISO, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

interface StaleDeviceDetail {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceProfileId: string | null;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  firstSeenStaleAt: string;
  consecutiveStaleDays: number;
}

interface StaleDeviceRemoval extends StaleDeviceDetail {
  daysWasStale: number;
}

/**
 * GET /api/stale-devices
 * Fetch snapshot data for comparison view
 * Query params:
 * - date (required): ISO date string for primary snapshot
 * - compareDate (optional): ISO date string for comparison
 * - deviceTypes (optional): Comma-separated list of device types to filter
 * - deviceProfileIds (optional): Comma-separated list of device profile IDs to filter
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("eloc8-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const compareDateParam = searchParams.get("compareDate");
    const deviceTypesParam = searchParams.get("deviceTypes");
    const deviceProfileIdsParam = searchParams.get("deviceProfileIds");

    // Parse device types filter
    const deviceTypesFilter = deviceTypesParam
      ? deviceTypesParam.split(",").map((t) => t.trim()).filter(Boolean)
      : null;
    
    // Parse device profile IDs filter
    const deviceProfileIdsFilter = deviceProfileIdsParam
      ? deviceProfileIdsParam.split(",").map((t) => t.trim()).filter(Boolean)
      : null;

    if (!dateParam) {
      return NextResponse.json(
        { message: "date parameter is required" },
        { status: 400 }
      );
    }

    // Parse dates
    const primaryDate = startOfDay(parseISO(dateParam));
    const compareDate = compareDateParam
      ? startOfDay(parseISO(compareDateParam))
      : null;

    // Build device filter for Prisma query
    const deviceWhereClause: any = {};
    if (deviceTypesFilter?.length) {
      deviceWhereClause.deviceType = { in: deviceTypesFilter };
    }
    if (deviceProfileIdsFilter?.length) {
      deviceWhereClause.deviceProfileId = { in: deviceProfileIdsFilter };
    }


    // Fetch primary snapshot with devices (filtered by device types and profiles if specified)
    const currentSnapshot = await prisma.staleDeviceSnapshot.findUnique({
      where: { snapshotDate: primaryDate },
      include: {
        devices: {
          where: deviceWhereClause,
          orderBy: { consecutiveStaleDays: "desc" },
        },
      },
    });

    // Fetch comparison snapshot if requested
    const comparisonSnapshot = compareDate
      ? await prisma.staleDeviceSnapshot.findUnique({
          where: { snapshotDate: compareDate },
          include: {
            devices: {
              where: deviceWhereClause,
              orderBy: { consecutiveStaleDays: "desc" },
            },
          },
        })
      : null;

    // Fetch all available dates for the date picker
    const availableDatesResult = await prisma.staleDeviceSnapshot.findMany({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: "desc" },
    });
    const availableDates = availableDatesResult.map((d) =>
      d.snapshotDate.toISOString().split("T")[0]
    );

    // Fetch all unique device types from snapshots for the filter dropdown
    const deviceTypesResult = await prisma.staleDeviceRecord.findMany({
      select: { deviceType: true },
      distinct: ["deviceType"],
      orderBy: { deviceType: "asc" },
    });
    const availableDeviceTypes = deviceTypesResult.map((d) => d.deviceType);

    // Transform current snapshot devices to response format
    const transformDevice = (
      device: {
        thingsboardDeviceId: string;
        deviceName: string;
        deviceType: string;
        deviceProfileId: string | null;
        lastActivityAt: Date | null;
        daysSinceActivity: number;
        firstSeenStaleAt: Date;
        consecutiveStaleDays: number;
      }
    ):
 StaleDeviceDetail => ({
      deviceId: device.thingsboardDeviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      deviceProfileId: device.deviceProfileId,
      lastActivityAt: device.lastActivityAt?.toISOString() || null,
      daysSinceActivity: device.daysSinceActivity,
      firstSeenStaleAt: device.firstSeenStaleAt.toISOString(),
      consecutiveStaleDays: device.consecutiveStaleDays,
    });

    // Build analysis
    let longestStale: StaleDeviceDetail[] = [];
    let newAdditions: StaleDeviceDetail[] = [];
    let removals: StaleDeviceRemoval[] = [];

    if (currentSnapshot) {
      // Top 10 longest stale devices
      longestStale = currentSnapshot.devices
        .slice(0, 10)
        .map(transformDevice);

      if (comparisonSnapshot) {
        // Create sets of device IDs for comparison
        const currentDeviceIds = new Set(
          currentSnapshot.devices.map((d) => d.thingsboardDeviceId)
        );
        const comparisonDeviceIds = new Set(
          comparisonSnapshot.devices.map((d) => d.thingsboardDeviceId)
        );

        // New additions: in current but not in comparison
        newAdditions = currentSnapshot.devices
          .filter((d) => !comparisonDeviceIds.has(d.thingsboardDeviceId))
          .map(transformDevice);

        // Removals: in comparison but not in current
        removals = comparisonSnapshot.devices
          .filter((d) => !currentDeviceIds.has(d.thingsboardDeviceId))
          .map((device) => ({
            ...transformDevice(device),
            daysWasStale: device.consecutiveStaleDays,
          }));
      }
    }

    return NextResponse.json({
      currentSnapshot: currentSnapshot
        ? {
            id: currentSnapshot.id,
            snapshotDate: currentSnapshot.snapshotDate.toISOString().split("T")[0],
            staleDays: currentSnapshot.staleDays,
            totalDevices: currentSnapshot.totalDevices,
            staleCount: currentSnapshot.staleCount,
            devices: currentSnapshot.devices.map(transformDevice),
          }
        : null,
      comparisonSnapshot: comparisonSnapshot
        ? {
            id: comparisonSnapshot.id,
            snapshotDate: comparisonSnapshot.snapshotDate.toISOString().split("T")[0],
            staleDays: comparisonSnapshot.staleDays,
            totalDevices: comparisonSnapshot.totalDevices,
            staleCount: comparisonSnapshot.staleCount,
            devices: comparisonSnapshot.devices.map(transformDevice),
          }
        : null,
      analysis: {
        longestStale,
        newAdditions,
        removals,
      },
      availableDates,
      availableDeviceTypes,
    });
  } catch (error) {
    console.error("Stale devices fetch error:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch stale device data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
