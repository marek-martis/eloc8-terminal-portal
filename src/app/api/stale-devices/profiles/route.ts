import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/stale-devices/profiles
 * Returns device profiles from the local database (synced from ThingsBoard during snapshot creation).
 * These IDs match what's stored in StaleDeviceRecord.deviceProfileId for filtering.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Fetch profiles from local database - these IDs match what's stored in snapshots
    const profiles = await prisma.deviceProfile.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Failed to fetch device profiles:", error);
    return NextResponse.json(
      { message: "Failed to fetch device profiles" },
      { status: 500 }
    );
  }
}
