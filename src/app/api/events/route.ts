import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const TB_BASE_URL = process.env.THINGSBOARD_URL;

interface DeviceEvent {
  id: { id: string; entityType: string };
  createdTime: number;
  tenantId: { id: string; entityType: string };
  entityId: { id: string; entityType: string };
  type: string;
  uid: string;
  body: Record<string, unknown>;
}

interface EventsResponse {
  data: DeviceEvent[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
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
    const eventType = searchParams.get("eventType") || "LC_EVENT"; // Lifecycle events by default
    const startTs = searchParams.get("startTs");
    const endTs = searchParams.get("endTs");
    const pageSize = searchParams.get("pageSize") || "50";
    const page = searchParams.get("page") || "0";

    if (!deviceId) {
      return NextResponse.json(
        { message: "deviceId is required" },
        { status: 400 }
      );
    }

    // Build query parameters
    const queryParams = new URLSearchParams({
      pageSize,
      page,
      sortProperty: "createdTime",
      sortOrder: "DESC",
    });

    if (startTs) queryParams.set("startTime", startTs);
    if (endTs) queryParams.set("endTime", endTs);

    // Call ThingsBoard events API directly
    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    const tokens = tbClient.getTokens();

    const response = await fetch(
      `${TB_BASE_URL}/api/events/DEVICE/${deviceId}/${eventType}?${queryParams}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Authorization": `Bearer ${tokens.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("ThingsBoard events API error:", errorText);
      return NextResponse.json(
        { message: "Failed to fetch events from ThingsBoard" },
        { status: response.status }
      );
    }

    const data = await response.json() as EventsResponse;

    // Transform events into a more friendly format
    const events = data.data.map((event) => ({
      id: event.id.id,
      timestamp: event.createdTime,
      type: event.type,
      deviceId: event.entityId.id,
      details: event.body,
    }));

    return NextResponse.json({
      events,
      pagination: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        totalPages: data.totalPages,
        totalElements: data.totalElements,
        hasNext: data.hasNext,
      },
    });
  } catch (error) {
    console.error("Events API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch events", error: errorMessage },
      { status: 500 }
    );
  }
}
