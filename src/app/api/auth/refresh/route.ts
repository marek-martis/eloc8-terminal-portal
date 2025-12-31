import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createThingsboardClient } from "@/lib/thingsboard";
import { getSession, createToken } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: "No token found" }, { status: 401 });
    }

    const tbClient = createThingsboardClient({
      accessToken: session.tbToken,
      refreshToken: session.tbRefreshToken,
    });

    const newTbToken = await tbClient.refreshAccessToken();
    const tokens = tbClient.getTokens();

    const newAppToken = await createToken({
      userId: session.userId,
      email: session.email,
      role: session.role,
      tbToken: newTbToken,
      tbRefreshToken: tokens.refreshToken || session.tbRefreshToken,
    });

    const cookieStore = await cookies();
    cookieStore.set("eloc8-token", newAppToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2,
      path: "/",
    });

    return NextResponse.json({ accessToken: newTbToken });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { message: "Token refresh failed" },
      { status: 401 }
    );
  }
}
