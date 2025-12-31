import { NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard";
import { getSession } from "@/lib/auth";
import { ACTIVE_WINDOW_MINUTES } from "@/lib/constants";

const ENTITY_QUERY_PAGE_SIZE = 1000;

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "0", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "100", 10);
    const fetchAll = searchParams.get("fetchAll") === "true";
    const status = searchParams.get("status") || undefined;
    const sortBy = searchParams.get("sortBy") || "name";
    const sortDir = searchParams.get("sortDir") === "DESC" ? "DESC" : "ASC";

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    const keyFilters: Array<{
      key: { type: string; key: string };
      valueType: string;
      predicate: { operation: string; value: { defaultValue: unknown; dynamicValue: null }; type: string };
    }> = [];

    if (type) {
      keyFilters.push({
        key: { type: "ENTITY_FIELD", key: "type" },
        valueType: "STRING",
        predicate: {
          operation: "EQUAL",
          value: { defaultValue: type, dynamicValue: null },
          type: "STRING",
        },
      });
    }

    if (search) {
      keyFilters.push({
        key: { type: "ENTITY_FIELD", key: "name" },
        valueType: "STRING",
        predicate: {
          operation: "CONTAINS",
          value: { defaultValue: search, dynamicValue: null },
          type: "STRING",
        },
      });
    }

    if (status === "active" || status === "inactive") {
      const activeThreshold = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000;
      keyFilters.push({
        key: { type: "SERVER_ATTRIBUTE", key: "lastActivityTime" },
        valueType: "NUMERIC",
        predicate: {
          operation: status === "active" ? "GREATER" : "LESS",
          value: { defaultValue: activeThreshold, dynamicValue: null },
          type: "NUMERIC",
        },
      });
    }

    const sortKey = sortBy === "lastActivityTime"
      ? { key: "lastActivityTime", type: "SERVER_ATTRIBUTE" as const }
      : { key: "name", type: "ENTITY_FIELD" as const };

    const baseQuery = {
      entityFilter: {
        type: "entityType",
        resolveMultiple: true,
        entityType: "DEVICE",
      },
      ...(keyFilters.length > 0 ? { keyFilters } : {}),
      entityFields: [
        { type: "ENTITY_FIELD", key: "name" },
        { type: "ENTITY_FIELD", key: "type" },
        { type: "ENTITY_FIELD", key: "label" },
      ],
      latestValues: [
        { type: "SERVER_ATTRIBUTE", key: "lastActivityTime" },
        { type: "TIME_SERIES", key: "latitude" },
        { type: "TIME_SERIES", key: "longitude" },
      ],
    };

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

    const activeThreshold = Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000;
    let allDevices: EntityDataItem[] = [];
    let totalElements = 0;

    try {
      if (fetchAll) {
        // Fetch all devices in batches using entitiesQuery/find
        const batchSize = ENTITY_QUERY_PAGE_SIZE;
        let currentPage = 0;
        let hasMore = true;

        while (hasMore) {
          const result = await tbClient.findEntityData<EntityDataResponse>({
            ...baseQuery,
            pageLink: {
              page: currentPage,
              pageSize: batchSize,
              sortOrder: {
                key: sortKey,
                direction: sortDir,
              },
            },
          });

          allDevices = allDevices.concat(result.data);
          totalElements = result.totalElements;
          hasMore = result.hasNext;
          currentPage++;
        }
      } else {
        const result = await tbClient.findEntityData<EntityDataResponse>({
          ...baseQuery,
          pageLink: {
            page,
            pageSize,
            sortOrder: {
              key: sortKey,
              direction: sortDir,
            },
          },
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

    const devices = allDevices.map((device) => {
      const fields = device.latest?.ENTITY_FIELD;
      const serverAttrs = device.latest?.SERVER_ATTRIBUTE;
      const timeSeries = device.latest?.TIME_SERIES;

      const lastActivityRaw = serverAttrs?.lastActivityTime?.value;
      const lastActivityTime = typeof lastActivityRaw === "number"
        ? lastActivityRaw
        : lastActivityRaw
          ? Number(lastActivityRaw)
          : null;

      const latRaw = timeSeries?.latitude?.value;
      const lngRaw = timeSeries?.longitude?.value;
      const lat = latRaw === null || latRaw === undefined ? null : parseFloat(String(latRaw));
      const lng = lngRaw === null || lngRaw === undefined ? null : parseFloat(String(lngRaw));

      const isActive = lastActivityTime !== null && lastActivityTime > activeThreshold;

      return {
        id: device.entityId.id,
        name: fields?.name?.value || "",
        type: fields?.type?.value || "",
        label: fields?.label?.value || undefined,
        isActive,
        location:
          lat !== null && !Number.isNaN(lat) && lng !== null && !Number.isNaN(lng)
            ? { lat, lng }
            : undefined,
        lastTelemetryAt: lastActivityTime
          ? new Date(lastActivityTime).toISOString()
          : undefined,
      };
    });

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
