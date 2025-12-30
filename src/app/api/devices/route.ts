import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "0");
    const pageSize = parseInt(searchParams.get("pageSize") || "100");
    const fetchAll = searchParams.get("fetchAll") === "true";

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    let allDevices: Array<{ id: { id: string }; name: string; type: string; label?: string }> = [];
    let totalElements = 0;

    try {
      if (fetchAll) {
        // Fetch all devices by paginating through all pages
        const batchSize = 100;
        let currentPage = 0;
        let hasMore = true;

        while (hasMore) {
          const result = await tbClient.getDevices({
            type,
            textSearch: search,
            page: currentPage,
            pageSize: batchSize,
          });

          allDevices = allDevices.concat(result.data);
          totalElements = result.totalElements;
          hasMore = result.hasNext;
          currentPage++;
        }
      } else {
        // Fetch single page
        const result = await tbClient.getDevices({
          type,
          textSearch: search,
          page,
          pageSize,
        });
        allDevices = result.data;
        totalElements = result.totalElements;
      }
    } catch (tbError) {
      console.error("ThingsBoard getDevices failed:", tbError);
      return NextResponse.json(
        { message: "Failed to fetch devices from ThingsBoard", error: tbError instanceof Error ? tbError.message : "Unknown error" },
        { status: 502 }
      );
    }

    const devices = await Promise.all(
      allDevices.map(async (device) => {
        try {
          // Fetch telemetry and server attributes in parallel
          const [telemetry, attributes] = await Promise.all([
            tbClient.getLatestTelemetry(device.id.id, ["latitude", "longitude"]),
            tbClient.getDeviceAttributes(device.id.id, "SERVER_SCOPE"),
          ]);

          const lat = telemetry.latitude?.[0]?.value;
          const lng = telemetry.longitude?.[0]?.value;

          // Get active status from server attributes
          const activeAttr = (attributes as Array<{ key: string; value: unknown }>)?.find(
            (attr) => attr.key === "active"
          );
          const isActive = activeAttr?.value === true || activeAttr?.value === "true";

          return {
            id: device.id.id,
            name: device.name,
            type: device.type,
            label: device.label,
            isActive,
            location:
              lat && lng
                ? {
                    lat: parseFloat(String(lat)),
                    lng: parseFloat(String(lng)),
                  }
                : undefined,
            lastTelemetryAt: telemetry.latitude?.[0]?.ts
              ? new Date(telemetry.latitude[0].ts).toISOString()
              : undefined,
          };
        } catch {
          return {
            id: device.id.id,
            name: device.name,
            type: device.type,
            label: device.label,
            isActive: false,
          };
        }
      })
    );

    return NextResponse.json({
      data: devices,
      total: totalElements,
    });
  } catch (error) {
    console.error("Devices API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch devices", error: errorMessage },
      { status: 500 }
    );
  }
}
