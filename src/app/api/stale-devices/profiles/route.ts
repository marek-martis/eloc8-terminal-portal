import { NextResponse } from "next/server";
import { createThingsboardClient } from "@/lib/thingsboard/client";
import { getSession } from "@/lib/auth";

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
