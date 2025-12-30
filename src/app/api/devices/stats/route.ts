import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";
import { DEFAULT_STALE_DAYS } from "@/lib/constants";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("eloc8-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      const verified = await jwtVerify(token, JWT_SECRET);
      payload = verified.payload;
    } catch (jwtError) {
      console.error("JWT verification failed:", jwtError);
      return NextResponse.json(
        { message: "Invalid token", error: "JWT verification failed" },
        { status: 401 }
      );
    }

    // Get staleDays from query parameter or use default
    const searchParams = request.nextUrl.searchParams;
    const staleDays = parseInt(searchParams.get("staleDays") || String(DEFAULT_STALE_DAYS), 10);

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    // Use ThingsBoard's entitiesQuery/count API for efficient counting
    // This is much faster than fetching all devices and counting client-side
    try {
      const [total, active, stale] = await Promise.all([
        tbClient.countDevices(),
        tbClient.countDevicesByAttribute("active", true, "SERVER_SCOPE"),
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
