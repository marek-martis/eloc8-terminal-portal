import { NextRequest, NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard";
import { ACTIVE_WINDOW_MINUTES, DEFAULT_STALE_DAYS } from "@/lib/constants";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get staleDays from query parameter or use default, with validation
    const searchParams = request.nextUrl.searchParams;
    const staleDaysParam = searchParams.get("staleDays");
    let staleDays = DEFAULT_STALE_DAYS;

    if (staleDaysParam) {
      const parsed = parseInt(staleDaysParam, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 365) {
        staleDays = parsed;
      }
    }

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    // Use ThingsBoard's entitiesQuery/count API for efficient counting
    // This is much faster than fetching all devices and counting client-side
    try {
      const activeThreshold = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000;
      const [total, active, stale] = await Promise.all([
        tbClient.countDevices(),
        tbClient.countDevicesByLastActivityTime(activeThreshold),
        tbClient.countStaleDevices(staleDays),
      ]);

      return NextResponse.json({
        total,
        active,
        inactive: total - active,
        stale,
        staleDays,
      });
    } catch (tbError) {
      console.error("ThingsBoard count query failed:", tbError);
      return NextResponse.json(
        {
          message: "Failed to fetch device stats from ThingsBoard",
          error: tbError instanceof Error ? tbError.message : "Unknown error",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Device stats API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch device stats", error: errorMessage },
      { status: 500 }
    );
  }
}
