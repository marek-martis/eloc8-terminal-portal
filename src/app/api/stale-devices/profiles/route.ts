import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard/client";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("eloc8-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      const result = await jwtVerify(token, JWT_SECRET);
      payload = result.payload as { tbToken: string; tbRefreshToken: string };
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken,
      refreshToken: payload.tbRefreshToken,
    });

    const profilesData = await tbClient.getDeviceProfiles({ pageSize: 100 });

    const profiles = profilesData.data.map((profile) => ({
      id: profile.id.id,
      name: profile.name,
    }));

    // Sort by name
    profiles.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Failed to fetch device profiles:", error);
    return NextResponse.json(
      { message: "Failed to fetch device profiles" },
      { status: 500 }
    );
  }
}
