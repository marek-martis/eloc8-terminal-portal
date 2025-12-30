import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { createThingsboardClient } from "@/lib/thingsboard";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("eloc8-token")?.value;

    if (!token) {
      return NextResponse.json({ message: "No token found" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    const tbClient = createThingsboardClient({
      accessToken: payload.tbToken as string,
      refreshToken: payload.tbRefreshToken as string,
    });

    const newTbToken = await tbClient.refreshAccessToken();
    const tokens = tbClient.getTokens();

    const newAppToken = await new SignJWT({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tbToken: newTbToken,
      tbRefreshToken: tokens.refreshToken,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_SECRET);

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
