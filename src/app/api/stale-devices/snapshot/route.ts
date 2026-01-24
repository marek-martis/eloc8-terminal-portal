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
    let forceOverwrite = false;
    try {
      const body = await request.json();
      if (body.staleDays && typeof body.staleDays === "number") {
        staleDays = body.staleDays;
      }
      if (typeof body.forceOverwrite === "boolean") {
        forceOverwrite = body.forceOverwrite;
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

    if (existingSnapshot && !forceOverwrite) {
      return NextResponse.json({
        message: "Snapshot already exists for today",
        snapshot: existingSnapshot,
      });
    }

    if (existingSnapshot && forceOverwrite) {
      if (!session) {
        return NextResponse.json(
          { message: "Valid session required to overwrite snapshot" },
          { status: 401 }
        );
      }
      await prisma.staleDeviceSnapshot.delete({
        where: { id: existingSnapshot.id },
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

    // Collect stale devices from two sources:
    // 1. Devices where lastMidReceived < cutoffTime
    // 2. Devices missing the lastMidReceived attribute entirely
    const staleDevices: Array<{
      id: string;
      name: string;
      type: string;
      deviceProfileId?: string;
      lastActivityAt?: string;
    }> = [];

    const staleDeviceIds = new Set<string>();

    // Query 1: Find devices where lastMidReceived is older than threshold
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await tbClient.findStaleDevices({
        staleDays,
        page,
        pageSize: 1000,
      });

      for (const device of response.data) {
        const activityValue = typeof device.lastMidReceived === "number"
          ? device.lastMidReceived
          : device.lastMidReceived
            ? Number(device.lastMidReceived)
            : null;
        const activityDate = activityValue && Number.isFinite(activityValue)
          ? new Date(activityValue)
          : null;

        staleDevices.push({
          id: device.entityId.id,
          name: device.name,
          type: device.type,
          deviceProfileId: device.deviceProfileId,
          lastActivityAt: activityDate
            ? activityDate.toISOString()
            : undefined,
        });
        staleDeviceIds.add(device.entityId.id);
      }

      hasMore = response.hasNext;
      page++;
    }

    // Query 2: Find devices missing the lastMidReceived attribute entirely
    let missingPage = 0;
    let hasMoreMissing = true;

    while (hasMoreMissing) {
      const response = await tbClient.findDevicesMissingLastMidReceived({
        page: missingPage,
        pageSize: 1000,
        excludeDeviceIds: staleDeviceIds,
      });

      for (const device of response.data) {
        // Devices without lastMidReceived have never reported
        staleDevices.push({
          id: device.entityId.id,
          name: device.name,
          type: device.type,
          deviceProfileId: device.deviceProfileId,
          lastActivityAt: undefined, // Never reported
        });
        staleDeviceIds.add(device.entityId.id);
      }

      hasMoreMissing = response.hasNext;
      missingPage++;
    }

    // Get total device count for the snapshot (using efficient count API)
    const totalDevices = await tbClient.countDevices();

    // Sync device profiles from ThingsBoard to local database
    const profileMap = new Map<string, string>(); // ThingsBoard ID -> local ID
    let profilePage = 0;
    let hasMoreProfiles = true;

    while (hasMoreProfiles) {
      const profilesResponse = await tbClient.getDeviceProfiles({
        page: profilePage,
        pageSize: 100,
      });

      for (const profile of profilesResponse.data) {
        const upsertedProfile = await prisma.deviceProfile.upsert({
          where: { thingsboardId: profile.id.id },
          update: { name: profile.name },
          create: {
            thingsboardId: profile.id.id,
            name: profile.name,
          },
        });
        profileMap.set(profile.id.id, upsertedProfile.id);
      }

      hasMoreProfiles = profilesResponse.hasNext;
      profilePage++;
    }

    // Get previous day's snapshot to track consecutive stale days
    const yesterday = subDays(today, 1);
    const previousSnapshot = await prisma.staleDeviceSnapshot.findUnique({
      where: { snapshotDate: yesterday },
      include: { devices: true },
    });

    const previousDeviceMap = new Map(
      previousSnapshot?.devices.map((d) => [d.thingsboardDeviceId, d]) || []
    );

    // Create the new snapshot, then insert records in batches to avoid oversized writes.
    const snapshot = await prisma.staleDeviceSnapshot.create({
      data: {
        snapshotDate: today,
        staleDays,
        totalDevices,
        staleCount: staleDevices.length,
      },
    });

    const deviceRecords = staleDevices.map((device) => {
      const previousRecord = previousDeviceMap.get(device.id);
      const lastActivityAt = device.lastActivityAt
        ? new Date(device.lastActivityAt)
        : null;
      const normalizedLastActivityAt =
        lastActivityAt && Number.isFinite(lastActivityAt.getTime())
          ? lastActivityAt
          : null;

      const daysSinceActivity = normalizedLastActivityAt
        ? Math.floor(
            (today.getTime() - normalizedLastActivityAt.getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 999;

      const localProfileId = device.deviceProfileId
        ? profileMap.get(device.deviceProfileId) || null
        : null;

      return {
        snapshotId: snapshot.id,
        thingsboardDeviceId: device.id,
        deviceName: device.name,
        deviceType: device.type,
        deviceProfileId: localProfileId,
        lastActivityAt: normalizedLastActivityAt,
        daysSinceActivity,
        firstSeenStaleAt: previousRecord?.firstSeenStaleAt || today,
        consecutiveStaleDays: previousRecord
          ? previousRecord.consecutiveStaleDays + 1
          : 1,
      };
    });

    const batchSize = 1000;
    try {
      for (let i = 0; i < deviceRecords.length; i += batchSize) {
        const batch = deviceRecords.slice(i, i + batchSize);
        await prisma.staleDeviceRecord.createMany({ data: batch });
      }
    } catch (writeError) {
      await prisma.staleDeviceSnapshot.delete({ where: { id: snapshot.id } });
      throw writeError;
    }

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
