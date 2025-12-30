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

    const { payload } = await jwtVerify(token, JWT_SECRET);

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const keys = searchParams.get("keys")?.split(",");

    if (!deviceId) {
      return NextResponse.json(
        { message: "Device ID required" },
        { status: 400 }
      );
    }

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    const telemetry = await tbClient.getLatestTelemetry(deviceId, keys);

    return NextResponse.json(telemetry);
  } catch (error) {
    console.error("Telemetry API error:", error);
    return NextResponse.json(
      { message: "Failed to fetch telemetry" },
      { status: 500 }
    );
  }
}
