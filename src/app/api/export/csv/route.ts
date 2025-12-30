import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";
import { format } from "date-fns";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

interface TelemetryDataPoint {
  ts: number;
  value: string | number;
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
    const deviceId = searchParams.get("deviceId");
    const keys = searchParams.get("keys");
    const startTs = searchParams.get("startTs");
    const endTs = searchParams.get("endTs");
    const deviceName = searchParams.get("deviceName") || "device";

    // Validate required parameters
    if (!deviceId || !keys || !startTs || !endTs) {
      return NextResponse.json(
        { message: "deviceId, keys, startTs, and endTs are required" },
        { status: 400 }
      );
    }

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    const keysArray = keys.split(",").map((k) => k.trim());
    const startTsNum = parseInt(startTs, 10);
    const endTsNum = parseInt(endTs, 10);

    // Fetch historical telemetry
    const telemetry = await tbClient.getHistoricalTelemetry(
      deviceId,
      keysArray,
      startTsNum,
      endTsNum
    ) as Record<string, TelemetryDataPoint[]>;

    // Collect all unique timestamps
    const allTimestamps = new Set<number>();
    Object.values(telemetry).forEach((points) => {
      points.forEach((point) => allTimestamps.add(point.ts));
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build CSV header
    const headers = ["Timestamp", "DateTime", ...keysArray];
    const csvRows: string[] = [headers.join(",")];

    // Build data rows
    sortedTimestamps.forEach((ts) => {
      const row: string[] = [
        String(ts),
        format(new Date(ts), "yyyy-MM-dd HH:mm:ss"),
      ];

      keysArray.forEach((key) => {
        const points = telemetry[key] || [];
        const matchingPoint = points.find((p) => p.ts === ts);
        row.push(matchingPoint ? String(matchingPoint.value) : "");
      });

      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const filename = `${deviceName}_telemetry_${format(new Date(startTsNum), "yyyyMMdd")}_${format(new Date(endTsNum), "yyyyMMdd")}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to export CSV", error: errorMessage },
      { status: 500 }
    );
  }
}
