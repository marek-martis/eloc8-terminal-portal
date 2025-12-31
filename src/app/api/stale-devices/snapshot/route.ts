import { NextResponse } from "next/server";
import { startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { createThingsboardClient } from "@/lib/thingsboard";
import { DEFAULT_STALE_DAYS } from "@/lib/constants";
import { getSession } from "@/lib/auth";

const CRON_API_KEY = process.env.CRON_API_KEY;

/**
 * POST /api/stale-devices/snapshot
 * Triggered by cron job to capture daily snapshot of stale devices
 */
export async function POST(request: Request) {
  try {
    // Check for cron API key or valid session
    const apiKey = request.headers.get("x-api-key");
    const isCronAuth = CRON_API_KEY && apiKey === CRON_API_KEY;

    const session = await getSession();

    if (!isCronAuth && !session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse request body for optional staleDays parameter
    let staleDays = DEFAULT_STALE_DAYS;
    try {
      const body = await request.json();
      if (body.staleDays && typeof body.staleDays === "number") {
        staleDays = body.staleDays;
      }
    } catch {
      // No body or invalid JSON, use default
    }

    // Normalize to UTC midnight for consistent daily snapshots
    const today = startOfDay(new Date());

    // Check if snapshot already exists for today (idempotent)
    const existingSnapshot = await prisma.staleDeviceSnapshot.findUnique({
      where: { snapshotDate: today },
    });

    if (existingSnapshot) {
      return NextResponse.json({
        message: "Snapshot already exists for today",
        snapshot: existingSnapshot,
      });
    }

    // Session is required to create snapshot (need ThingsBoard tokens)
    if (!session) {
      return NextResponse.json(
        { message: "Valid session required to create snapshot" },
        { status: 401 }
      );
    }

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    // Fetch all devices from ThingsBoard with their lastActivityTime attribute
    const allDevices: Array<{
      id: string;
      name: string;
      type: string;
      deviceProfileId?: string;
      lastActivityAt?: string;
    }> = [];

    let page = 0;
    let hasMore = true;
    const batchSize = 100;

    while (hasMore) {
      const response = await tbClient.getDevices({
        page,
        pageSize: batchSize,
      });

      // Fetch attributes for all devices in this batch in parallel
      const devicePromises = response.data.map(async (device) => {
        try {
          const attributes = await tbClient.getDeviceAttributes(device.id.id, "SERVER_SCOPE");
          const lastActivityAttr = (attributes as Array<{ key: string; value: unknown }>)?.find(
            (attr) => attr.key === "lastActivityTime"
          );
          const lastActivityTs = lastActivityAttr?.value as number | undefined;

          return {
            id: device.id.id,
            name: device.name,
            type: device.type,
            deviceProfileId: device.deviceProfileId?.id,
            lastActivityAt: lastActivityTs ? new Date(lastActivityTs).toISOString() : undefined,
          };
        } catch {
          return {
            id: device.id.id,
            name: device.name,
            type: device.type,
            deviceProfileId: device.deviceProfileId?.id,
          };
        }
      });

      const batchDevices = await Promise.all(devicePromises);
      allDevices.push(...batchDevices);

      hasMore = response.hasNext;
      page++;
    }

    // Calculate stale threshold date
    const staleThreshold = subDays(today, staleDays);

    // Filter stale devices
    const staleDevices = allDevices.filter((device) => {
      if (!device.lastActivityAt) return true; // No activity = stale
      return new Date(device.lastActivityAt) < staleThreshold;
    });

    // Get previous day's snapshot to track consecutive stale days
    const yesterday = subDays(today, 1);
    const previousSnapshot = await prisma.staleDeviceSnapshot.findUnique({
      where: { snapshotDate: yesterday },
      include: { devices: true },
    });

    const previousDeviceMap = new Map(
      previousSnapshot?.devices.map((d) => [d.thingsboardDeviceId, d]) || []
    );

    // Create the new snapshot with device records
    const snapshot = await prisma.staleDeviceSnapshot.create({
      data: {
        snapshotDate: today,
        staleDays,
        totalDevices: allDevices.length,
        staleCount: staleDevices.length,
        devices: {
          create: staleDevices.map((device) => {
            const previousRecord = previousDeviceMap.get(device.id);
            const lastActivityAt = device.lastActivityAt
              ? new Date(device.lastActivityAt)
              : null;

            // Calculate days since last activity
            const daysSinceActivity = lastActivityAt
              ? Math.floor(
                  (today.getTime() - lastActivityAt.getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              : 999; // Large number for devices with no telemetry

            return {
              thingsboardDeviceId: device.id,
              deviceName: device.name,
              deviceType: device.type,
              deviceProfileId: device.deviceProfileId || null,
              lastActivityAt,
              daysSinceActivity,
              // If device was stale yesterday, continue tracking
              firstSeenStaleAt: previousRecord?.firstSeenStaleAt || today,
              consecutiveStaleDays: previousRecord
                ? previousRecord.consecutiveStaleDays + 1
                : 1,
            };
          }),
        },
      },
      include: {
        devices: true,
      },
    });

    return NextResponse.json({
      message: "Snapshot created successfully",
      snapshot: {
        id: snapshot.id,
        snapshotDate: snapshot.snapshotDate,
        staleDays: snapshot.staleDays,
        totalDevices: snapshot.totalDevices,
        staleCount: snapshot.staleCount,
        createdAt: snapshot.createdAt,
      },
    });
  } catch (error) {
    console.error("Snapshot creation error:", error);
    return NextResponse.json(
      {
        message: "Failed to create snapshot",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
