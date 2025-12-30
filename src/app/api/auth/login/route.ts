import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { createThingsboardClient } from "@/lib/thingsboard";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

function mapThingsboardRole(
  authority: string
): "ADMIN" | "MANAGER" | "USER" | "VIEWER" {
  switch (authority) {
    case "SYS_ADMIN":
    case "TENANT_ADMIN":
      return "ADMIN";
    case "CUSTOMER_USER":
      return "USER";
    default:
      return "VIEWER";
  }
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    const tbClient = createThingsboardClient();
    const authResponse = await tbClient.login(username, password);
    const tbUser = await tbClient.getCurrentUser();

    const user = await prisma.user.upsert({
      where: { thingsboardId: tbUser.id.id },
      update: {
        email: tbUser.email,
        name:
          `${tbUser.firstName || ""} ${tbUser.lastName || ""}`.trim() ||
          tbUser.email,
        lastLoginAt: new Date(),
      },
      create: {
        thingsboardId: tbUser.id.id,
        email: tbUser.email,
        name:
          `${tbUser.firstName || ""} ${tbUser.lastName || ""}`.trim() ||
          tbUser.email,
        role: mapThingsboardRole(tbUser.authority),
      },
    });

    const appToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      tbToken: authResponse.token,
      tbRefreshToken: authResponse.refreshToken,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set("eloc8-token", appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 2,
      path: "/",
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken: authResponse.token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 401 }
    );
  }
}
