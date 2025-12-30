import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";
import { TB_PAGE_SIZE, MAX_CONCURRENT_TELEMETRY_REQUESTS } from "@/lib/constants";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

interface FleetMetrics {
  totalDevices: number;
  activeDevices: number;
  averageSpeed: number | null;
  averageBattery: number | null;
  totalDistance: number | null;
  deviceMetrics: Array<{
    deviceId: string;
    deviceName: string;
    speed: number | null;
    battery: number | null;
    lastActivityTime: number | null;
  }>;
}

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
        { message: "Invalid token" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const keys = searchParams.get("keys")?.split(",") || ["speed", "battery"];

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    // Get all devices
    const devicesResponse = await tbClient.getDevices({ pageSize: TB_PAGE_SIZE });
    const devices = devicesResponse.data;

    // Fetch telemetry for all devices in batches
    const deviceMetrics: FleetMetrics["deviceMetrics"] = [];

    for (let i = 0; i < devices.length; i += MAX_CONCURRENT_TELEMETRY_REQUESTS) {
      const batch = devices.slice(i, i + MAX_CONCURRENT_TELEMETRY_REQUESTS);
      const batchResults = await Promise.all(
        batch.map(async (device) => {
          try {
            const telemetry = await tbClient.getLatestTelemetry(device.id.id, keys);
            const attributes = await tbClient.getDeviceAttributes(device.id.id, "SERVER_SCOPE") as Array<{ key: string; value: unknown }>;

            const lastActivityAttr = attributes.find((a) => a.key === "lastActivityTime");

            return {
              deviceId: device.id.id,
              deviceName: device.name,
              speed: telemetry.speed?.[0]?.value ? parseFloat(String(telemetry.speed[0].value)) : null,
              battery: telemetry.battery?.[0]?.value ? parseFloat(String(telemetry.battery[0].value)) : null,
              lastActivityTime: typeof lastActivityAttr?.value === "number" ? lastActivityAttr.value : null,
            };
          } catch (error) {
            console.error(`Failed to fetch telemetry for device ${device.id.id}:`, error);
            return {
              deviceId: device.id.id,
              deviceName: device.name,
              speed: null,
              battery: null,
              lastActivityTime: null,
            };
          }
        })
      );
      deviceMetrics.push(...batchResults);
    }

    // Calculate fleet-wide aggregations
    const speedValues = deviceMetrics.filter((d) => d.speed !== null).map((d) => d.speed as number);
    const batteryValues = deviceMetrics.filter((d) => d.battery !== null).map((d) => d.battery as number);

    const averageSpeed = speedValues.length > 0
      ? speedValues.reduce((a, b) => a + b, 0) / speedValues.length
      : null;

    const averageBattery = batteryValues.length > 0
      ? batteryValues.reduce((a, b) => a + b, 0) / batteryValues.length
      : null;

    // Count active devices (have recent activity)
    const now = Date.now();
    const activeThreshold = now - 5 * 60 * 1000; // 5 minutes
    const activeDevices = deviceMetrics.filter(
      (d) => d.lastActivityTime !== null && d.lastActivityTime > activeThreshold
    ).length;

    const response: FleetMetrics = {
      totalDevices: devices.length,
      activeDevices,
      averageSpeed: averageSpeed !== null ? Math.round(averageSpeed * 100) / 100 : null,
      averageBattery: averageBattery !== null ? Math.round(averageBattery * 100) / 100 : null,
      totalDistance: null, // Would need historical data to calculate
      deviceMetrics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Fleet analytics API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch fleet analytics", error: errorMessage },
      { status: 500 }
    );
  }
}
