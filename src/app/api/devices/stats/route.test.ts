import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// Mock dependencies
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/thingsboard", () => ({
  createThingsboardClient: vi.fn(),
}));

import { getSession } from "@/lib/auth";
import { createThingsboardClient } from "@/lib/thingsboard";

const mockGetSession = vi.mocked(getSession);
const mockCreateThingsboardClient = vi.mocked(createThingsboardClient);

describe("GET /api/devices/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/devices/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Unauthorized");
  });

  it("returns device stats on success", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      role: "TENANT_ADMIN",
      tbToken: "tb-token",
      tbRefreshToken: "tb-refresh",
    });

    const mockClient = {
      countDevices: vi.fn().mockResolvedValue(100),
      countDevicesByLastActivityTime: vi.fn().mockResolvedValue(25),
      countStaleDevices: vi.fn().mockResolvedValue(10),
    };
    mockCreateThingsboardClient.mockReturnValue(mockClient as never);

    const request = new NextRequest("http://localhost/api/devices/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      total: 100,
      active: 25,
      inactive: 75,
      stale: 10,
      staleDays: 2, // DEFAULT_STALE_DAYS
    });
  });

  it("uses custom staleDays parameter when provided", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      role: "TENANT_ADMIN",
      tbToken: "tb-token",
      tbRefreshToken: "tb-refresh",
    });

    const mockClient = {
      countDevices: vi.fn().mockResolvedValue(100),
      countDevicesByLastActivityTime: vi.fn().mockResolvedValue(25),
      countStaleDevices: vi.fn().mockResolvedValue(15),
    };
    mockCreateThingsboardClient.mockReturnValue(mockClient as never);

    const request = new NextRequest(
      "http://localhost/api/devices/stats?staleDays=7"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.staleDays).toBe(7);
    expect(mockClient.countStaleDevices).toHaveBeenCalledWith(7);
  });

  it("ignores invalid staleDays and uses default", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      role: "TENANT_ADMIN",
      tbToken: "tb-token",
      tbRefreshToken: "tb-refresh",
    });

    const mockClient = {
      countDevices: vi.fn().mockResolvedValue(100),
      countDevicesByLastActivityTime: vi.fn().mockResolvedValue(25),
      countStaleDevices: vi.fn().mockResolvedValue(10),
    };
    mockCreateThingsboardClient.mockReturnValue(mockClient as never);

    // Test negative value
    const request1 = new NextRequest(
      "http://localhost/api/devices/stats?staleDays=-5"
    );
    const response1 = await GET(request1);
    const data1 = await response1.json();
    expect(data1.staleDays).toBe(2);

    // Test non-numeric value
    const request2 = new NextRequest(
      "http://localhost/api/devices/stats?staleDays=abc"
    );
    const response2 = await GET(request2);
    const data2 = await response2.json();
    expect(data2.staleDays).toBe(2);

    // Test value over 365
    const request3 = new NextRequest(
      "http://localhost/api/devices/stats?staleDays=500"
    );
    const response3 = await GET(request3);
    const data3 = await response3.json();
    expect(data3.staleDays).toBe(2);
  });

  it("returns 502 when ThingsBoard API fails", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      role: "TENANT_ADMIN",
      tbToken: "tb-token",
      tbRefreshToken: "tb-refresh",
    });

    const mockClient = {
      countDevices: vi.fn().mockRejectedValue(new Error("ThingsBoard unavailable")),
      countDevicesByLastActivityTime: vi.fn(),
      countStaleDevices: vi.fn(),
    };
    mockCreateThingsboardClient.mockReturnValue(mockClient as never);

    const request = new NextRequest("http://localhost/api/devices/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.message).toBe("Failed to fetch device stats from ThingsBoard");
    expect(data.error).toBe("ThingsBoard unavailable");
  });

  it("handles zero devices correctly", async () => {
    mockGetSession.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      role: "TENANT_ADMIN",
      tbToken: "tb-token",
      tbRefreshToken: "tb-refresh",
    });

    const mockClient = {
      countDevices: vi.fn().mockResolvedValue(0),
      countDevicesByLastActivityTime: vi.fn().mockResolvedValue(0),
      countStaleDevices: vi.fn().mockResolvedValue(0),
    };
    mockCreateThingsboardClient.mockReturnValue(mockClient as never);

    const request = new NextRequest("http://localhost/api/devices/stats");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      total: 0,
      active: 0,
      inactive: 0,
      stale: 0,
      staleDays: 2,
    });
  });
});
