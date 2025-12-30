import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";
import { format } from "date-fns";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

interface TelemetryDataPoint {
  ts: number;
  value: string | number;
}

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1a1a1a",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 5,
  },
  table: {
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 5,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: "#333",
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "30%",
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
});

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
    const deviceName = searchParams.get("deviceName") || "Device";

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

    // Calculate statistics for each key
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    keysArray.forEach((key) => {
      const points = telemetry[key] || [];
      const values = points.map((p) => parseFloat(String(p.value))).filter((v) => !isNaN(v));

      if (values.length > 0) {
        stats[key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    });

    // Collect all unique timestamps and sort
    const allTimestamps = new Set<number>();
    Object.values(telemetry).forEach((points) => {
      points.forEach((point) => allTimestamps.add(point.ts));
    });
    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Limit to most recent 100 data points for PDF
    const limitedTimestamps = sortedTimestamps.slice(-100);

    // Build data rows
    const dataRows = limitedTimestamps.map((ts) => {
      const row: Record<string, string> = {
        timestamp: format(new Date(ts), "yyyy-MM-dd HH:mm"),
      };
      keysArray.forEach((key) => {
        const points = telemetry[key] || [];
        const matchingPoint = points.find((p) => p.ts === ts);
        row[key] = matchingPoint ? String(matchingPoint.value) : "-";
      });
      return row;
    });

    // Create PDF document using createElement
    const doc = createElement(Document, {},
      createElement(Page, { size: "A4", style: styles.page },
        // Header
        createElement(View, { style: styles.header },
          createElement(Text, { style: styles.title }, `${deviceName} Telemetry Report`),
          createElement(Text, { style: styles.subtitle },
            `Period: ${format(new Date(startTsNum), "MMM d, yyyy")} - ${format(new Date(endTsNum), "MMM d, yyyy")}`
          ),
          createElement(Text, { style: styles.subtitle },
            `Generated: ${format(new Date(), "MMM d, yyyy HH:mm")}`
          )
        ),

        // Statistics Section
        createElement(View, { style: styles.section },
          createElement(Text, { style: styles.sectionTitle }, "Statistics Summary"),
          createElement(View, { style: styles.statsGrid },
            ...keysArray.map((key) =>
              createElement(View, { key, style: styles.statCard },
                createElement(Text, { style: styles.statLabel }, `${key.charAt(0).toUpperCase() + key.slice(1)}`),
                createElement(Text, { style: styles.statValue },
                  stats[key] ? `Avg: ${stats[key].avg.toFixed(2)}` : "N/A"
                ),
                createElement(Text, { style: { ...styles.statLabel, marginTop: 4 } },
                  stats[key] ? `Min: ${stats[key].min.toFixed(2)} | Max: ${stats[key].max.toFixed(2)}` : ""
                )
              )
            )
          )
        ),

        // Data Table Section
        createElement(View, { style: styles.section },
          createElement(Text, { style: styles.sectionTitle },
            `Recent Data Points (Last ${dataRows.length} of ${sortedTimestamps.length})`
          ),
          createElement(View, { style: styles.table },
            // Table Header
            createElement(View, { style: styles.tableHeader },
              createElement(Text, { style: styles.tableCellHeader }, "Timestamp"),
              ...keysArray.map((key) =>
                createElement(Text, { key, style: styles.tableCellHeader },
                  key.charAt(0).toUpperCase() + key.slice(1)
                )
              )
            ),
            // Table Rows
            ...dataRows.slice(0, 50).map((row, i) =>
              createElement(View, { key: i, style: styles.tableRow },
                createElement(Text, { style: styles.tableCell }, row.timestamp),
                ...keysArray.map((key) =>
                  createElement(Text, { key, style: styles.tableCell }, row[key])
                )
              )
            )
          )
        ),

        // Footer
        createElement(Text, { style: styles.footer },
          `eLOC8 Terminal Portal - ${deviceName} - Page 1`
        )
      )
    );

    // Render PDF to buffer
    const pdfBuffer = await renderToBuffer(doc);

    const filename = `${deviceName}_report_${format(new Date(startTsNum), "yyyyMMdd")}_${format(new Date(endTsNum), "yyyyMMdd")}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { message: "Failed to export PDF", error: errorMessage },
      { status: 500 }
    );
  }
}
