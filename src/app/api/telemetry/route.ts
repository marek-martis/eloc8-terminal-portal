import { NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

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
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
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
