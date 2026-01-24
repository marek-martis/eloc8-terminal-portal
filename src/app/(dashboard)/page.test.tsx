import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/test/setup";
import DashboardPage from "./page";
import type { ReactNode } from "react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

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

describe("DashboardPage", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it("shows loading state initially", () => {
    server.use(
      http.get("/api/devices/stats", async () => {
        // Delay response to keep loading state
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          total: 100,
          active: 25,
          inactive: 75,
          stale: 10,
          staleDays: 2,
        });
      })
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    // Stats values should not be visible during loading
    expect(screen.queryByText("100")).not.toBeInTheDocument();

    // But page title should be visible
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders device stats cards after loading", async () => {
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

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    // Check all stats are displayed
    expect(screen.getByText("Total Devices")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();

    expect(screen.getByText("Active Devices")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();

    expect(screen.getByText("Inactive Devices")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();

    expect(screen.getByText("Stale Devices")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows staleDays in stale devices card", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.json({
          total: 50,
          active: 10,
          inactive: 40,
          stale: 5,
          staleDays: 7,
        });
      })
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/7\+ days/)).toBeInTheDocument();
    });
  });

  it("displays error message when API fails", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.json(
          { message: "Server error" },
          { status: 500 }
        );
      })
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load dashboard data")
      ).toBeInTheDocument();
    });
  });

  it("handles zero counts correctly", async () => {
    server.use(
      http.get("/api/devices/stats", () => {
        return HttpResponse.json({
          total: 0,
          active: 0,
          inactive: 0,
          stale: 0,
          staleDays: 2,
        });
      })
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // All zeroes should display
      const zeros = screen.getAllByText("0");
      expect(zeros.length).toBe(4); // total, active, inactive, stale
    });
  });

  it("renders quick action links", async () => {
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

    render(<DashboardPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    // Check quick action links
    expect(screen.getByText("Live Map")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Check links have correct hrefs
    expect(screen.getByRole("link", { name: /Live Map/i })).toHaveAttribute(
      "href",
      "/map"
    );
    expect(screen.getByRole("link", { name: /Analytics/i })).toHaveAttribute(
      "href",
      "/analytics"
    );
    expect(screen.getByRole("link", { name: /Settings/i })).toHaveAttribute(
      "href",
      "/settings"
    );
  });
});
