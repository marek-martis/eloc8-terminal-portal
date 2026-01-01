import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

// Validate JWT_SECRET is configured - fail fast if not
if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET environment variable is required. " +
    "Please set it in your .env file with a secure 32+ character secret."
  );
}

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tbToken: string;
  tbRefreshToken: string;
  tbTenantId?: string;
}

/**
 * Verify and decode the session token from cookies
 * Returns null if no token or invalid token
 */
export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("eloc8-token")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Create a new signed JWT token
 */
export async function createToken(payload: JWTPayload, expiresIn = "2h"): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}
