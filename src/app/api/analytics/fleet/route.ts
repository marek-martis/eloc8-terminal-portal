import { NextRequest, NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard";
import { ACTIVE_WINDOW_MINUTES } from "@/lib/constants";
import { getSession } from "@/lib/auth";

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
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const keys = searchParams.get("keys")?.split(",") || ["vbat"];
    const telemetryKey = keys[0] || "vbat";

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    type EntityDataItem = {
      entityId: { id: string; entityType: string };
      latest?: {
        ENTITY_FIELD?: Record<string, { ts: number; value: string }>;
        SERVER_ATTRIBUTE?: Record<string, { ts: number; value: number | string }>;
        TIME_SERIES?: Record<string, { ts: number; value: number | string }>;
      };
    };

    type EntityDataResponse = {
      data: EntityDataItem[];
      totalElements: number;
      totalPages: number;
      hasNext: boolean;
    };

    const baseQuery = {
      entityFilter: {
        type: "entityType",
        resolveMultiple: true,
        entityType: "DEVICE",
      },
      entityFields: [
        { type: "ENTITY_FIELD", key: "name" },
        { type: "ENTITY_FIELD", key: "type" },
      ],
      latestValues: [
        { type: "TIME_SERIES", key: telemetryKey },
        { type: "SERVER_ATTRIBUTE", key: "lastActivityTime" },
      ],
    };

    const activeThreshold = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000;
    const deviceMetricsResponse = await tbClient.findEntityData<EntityDataResponse>({
      ...baseQuery,
      pageLink: {
        page: 0,
        pageSize: 20,
        sortOrder: {
          key: { key: "lastActivityTime", type: "SERVER_ATTRIBUTE" },
          direction: "DESC",
        },
      },
    });

    const deviceMetrics: FleetMetrics["deviceMetrics"] = deviceMetricsResponse.data.map((item) => {
      const fields = item.latest?.ENTITY_FIELD;
      const timeSeries = item.latest?.TIME_SERIES;
      const serverAttrs = item.latest?.SERVER_ATTRIBUTE;
      const vbatRaw = timeSeries?.[telemetryKey]?.value;
      const vbatValue = vbatRaw !== undefined ? parseFloat(String(vbatRaw)) : null;
      const lastActivityRaw = serverAttrs?.lastActivityTime?.value;
      const lastActivityTime = typeof lastActivityRaw === "number"
        ? lastActivityRaw
        : lastActivityRaw
          ? Number(lastActivityRaw)
          : null;

      return {
        deviceId: item.entityId.id,
        deviceName: fields?.name?.value || "",
        speed: null,
        battery: vbatValue !== null && !Number.isNaN(vbatValue) ? vbatValue : null,
        lastActivityTime,
      };
    });

    let activeDevices = 0;
    let totalDevices = 0;
    let vbatSum = 0;
    let vbatCount = 0;
    let page = 0;
    let hasNext = true;

    while (hasNext) {
      const result = await tbClient.findEntityData<EntityDataResponse>({
        ...baseQuery,
        pageLink: {
          page,
          pageSize: 1000,
          sortOrder: {
            key: { key: "name", type: "ENTITY_FIELD" },
            direction: "ASC",
          },
        },
      });

      totalDevices = result.totalElements;
      for (const item of result.data) {
        const serverAttrs = item.latest?.SERVER_ATTRIBUTE;
        const timeSeries = item.latest?.TIME_SERIES;
        const lastActivityRaw = serverAttrs?.lastActivityTime?.value;
        const lastActivityTime = typeof lastActivityRaw === "number"
          ? lastActivityRaw
          : lastActivityRaw
            ? Number(lastActivityRaw)
            : null;

        if (lastActivityTime !== null && lastActivityTime > activeThreshold) {
          activeDevices++;
        }

        const vbatRaw = timeSeries?.[telemetryKey]?.value;
        const vbatValue = vbatRaw !== undefined ? parseFloat(String(vbatRaw)) : null;
        if (vbatValue !== null && !Number.isNaN(vbatValue)) {
          vbatSum += vbatValue;
          vbatCount++;
        }
      }

      hasNext = result.hasNext;
      page++;
    }

    const averageBattery = vbatCount > 0 ? vbatSum / vbatCount : null;

    const response: FleetMetrics = {
      totalDevices,
      activeDevices,
      averageSpeed: null,
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
