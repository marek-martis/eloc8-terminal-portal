import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * GET /api/stale-devices/dates
 * Returns list of available snapshot dates for the date picker
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const snapshots = await prisma.staleDeviceSnapshot.findMany({
      select: { snapshotDate: true },
      orderBy: { snapshotDate: "desc" },
    });

    const dates = snapshots.map((s) =>
      s.snapshotDate.toISOString().split("T")[0]
    );

    return NextResponse.json({ dates });
  } catch (error) {
    console.error("Stale device dates fetch error:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch available dates",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
