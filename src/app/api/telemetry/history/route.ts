import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";
import { AGGREGATION_TYPES } from "@/lib/constants";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

type AggregationType = keyof typeof AGGREGATION_TYPES;

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
    const interval = searchParams.get("interval");
    const agg = searchParams.get("agg") as AggregationType | null;

    // Validate required parameters
    if (!deviceId) {
      return NextResponse.json(
        { message: "deviceId is required" },
        { status: 400 }
      );
    }

    if (!keys) {
      return NextResponse.json(
        { message: "keys is required (comma-separated telemetry keys)" },
        { status: 400 }
      );
    }

    if (!startTs || !endTs) {
      return NextResponse.json(
        { message: "startTs and endTs are required (timestamps in milliseconds)" },
        { status: 400 }
      );
    }

    const startTsNum = parseInt(startTs, 10);
    const endTsNum = parseInt(endTs, 10);

    if (isNaN(startTsNum) || isNaN(endTsNum)) {
      return NextResponse.json(
        { message: "startTs and endTs must be valid timestamps" },
        { status: 400 }
      );
    }

    if (startTsNum >= endTsNum) {
      return NextResponse.json(
        { message: "startTs must be less than endTs" },
        { status: 400 }
      );
    }

    // Validate aggregation type if provided
    if (agg && !Object.keys(AGGREGATION_TYPES).includes(agg)) {
      return NextResponse.json(
        { message: `Invalid aggregation type. Must be one of: ${Object.keys(AGGREGATION_TYPES).join(", ")}` },
        { status: 400 }
      );
    }

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    const keysArray = keys.split(",").map((k) => k.trim());
    const intervalNum = interval ? parseInt(interval, 10) : undefined;

    const telemetry = await tbClient.getHistoricalTelemetry(
      deviceId,
      keysArray,
      startTsNum,
      endTsNum,
      intervalNum,
      agg || undefined
    );

    return NextResponse.json({
      deviceId,
      keys: keysArray,
      startTs: startTsNum,
      endTs: endTsNum,
      interval: intervalNum,
      agg: agg || "NONE",
      data: telemetry,
    });
  } catch (error) {
    console.error("Historical telemetry API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch historical telemetry", error: errorMessage },
      { status: 500 }
    );
  }
}
