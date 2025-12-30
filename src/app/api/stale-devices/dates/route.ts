import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

/**
 * GET /api/stale-devices/dates
 * Returns list of available snapshot dates for the date picker
 */
export async function GET() {
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
