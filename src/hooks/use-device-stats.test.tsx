import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/setup";
import { useDeviceStats } from "./use-device-stats";
import { DEFAULT_STALE_DAYS } from "@/lib/constants";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useDeviceStats", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("fetches device stats successfully", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.json({
          total: 100,
          active: 25,
          inactive: 75,
          stale: 10,
          staleDays: 2,
        });
      })
    );

    const { result } = renderHook(() => useDeviceStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      total: 100,
      active: 25,
      inactive: 75,
      stale: 10,
      staleDays: 2,
    });
  });

  it("uses default staleDays when not provided", async () => {
    let requestedStaleDays: string | null = null;

    server.use(
      http.get("/api/devices/stats", ({ request }) => {
        const url = new URL(request.url);
        requestedStaleDays = url.searchParams.get("staleDays");
        return HttpResponse.json({
          total: 50,
          active: 10,
          inactive: 40,
          stale: 5,
          staleDays: DEFAULT_STALE_DAYS,
        });
      })
    );

    const { result } = renderHook(() => useDeviceStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(requestedStaleDays).toBe(String(DEFAULT_STALE_DAYS));
  });

  it("uses custom staleDays when provided", async () => {
    let requestedStaleDays: string | null = null;

    server.use(
      http.get("/api/devices/stats", ({ request }) => {
        const url = new URL(request.url);
        requestedStaleDays = url.searchParams.get("staleDays");
        return HttpResponse.json({
          total: 50,
          active: 10,
          inactive: 40,
          stale: 15,
          staleDays: 7,
        });
      })
    );

    const { result } = renderHook(() => useDeviceStats(7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(requestedStaleDays).toBe("7");
    expect(result.current.data?.staleDays).toBe(7);
  });

  it("handles error response", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.json(
          { message: "Unauthorized" },
          { status: 401 }
        );
      })
    );

    const { result } = renderHook(() => useDeviceStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("Unauthorized");
  });

  it("handles network error", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.error();
      })
    );

    const { result } = renderHook(() => useDeviceStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it("includes staleDays in query key for caching", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    server.use(
      http.get("/api/devices/stats", ({ request }) => {
        const url = new URL(request.url);
        const staleDays = url.searchParams.get("staleDays");
        return HttpResponse.json({
          total: 100,
          active: 25,
          inactive: 75,
          stale: staleDays === "7" ? 20 : 10,
          staleDays: Number(staleDays),
        });
      })
    );

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    }

    // Fetch with staleDays=2
    const { result: result1 } = renderHook(() => useDeviceStats(2), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
    });

    expect(result1.current.data?.stale).toBe(10);

    // Fetch with staleDays=7 (different query key, should make new request)
    const { result: result2 } = renderHook(() => useDeviceStats(7), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result2.current.isSuccess).toBe(true);
    });

    expect(result2.current.data?.stale).toBe(20);
  });
});
