import { NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard";
import { getSession } from "@/lib/auth";

const PAGE_SIZE = 1000;

type EntityDataItem = {
  entityId: { id: string; entityType: string };
  latest?: {
    ENTITY_FIELD?: Record<string, { ts: number; value: string }>;
  };
};

type EntityDataResponse = {
  data: EntityDataItem[];
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    const counts: Record<string, number> = {};
    let totalElements = 0;
    let page = 0;
    let hasNext = true;

    while (hasNext) {
      const result = await tbClient.findEntityData<EntityDataResponse>({
        entityFilter: {
          type: "entityType",
          resolveMultiple: true,
          entityType: "DEVICE",
        },
        entityFields: [{ type: "ENTITY_FIELD", key: "type" }],
        pageLink: {
          page,
          pageSize: PAGE_SIZE,
          sortOrder: {
            key: { key: "name", type: "ENTITY_FIELD" },
            direction: "ASC",
          },
        },
      });

      totalElements = result.totalElements;
      for (const item of result.data) {
        const deviceType = item.latest?.ENTITY_FIELD?.type?.value || "";
        if (!deviceType) continue;
        counts[deviceType] = (counts[deviceType] || 0) + 1;
      }

      hasNext = result.hasNext;
      page++;
    }

    return NextResponse.json({
      total: totalElements,
      uniqueTypes: Object.keys(counts).length,
      types: counts,
    });
  } catch (error) {
    console.error("Device type summary API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to fetch device type summary", error: errorMessage },
      { status: 500 }
    );
  }
}
