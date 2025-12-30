"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/providers/websocket-provider";
import { Wifi, WifiOff } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/map": "Live Tracking Map",
  "/analytics": "Analytics Dashboard",
  "/devices": "Device Management",
  "/stale-devices": "Stale Device Tracking",
  "/settings": "Settings",
};

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useWebSocket();
  const title = pageTitles[pathname] || "eLOC8 Terminal";

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-4">
        <Badge
          variant={isConnected ? "success" : "destructive"}
          className="flex items-center gap-1"
        >
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              Offline
            </>
          )}
        </Badge>
      </div>
    </header>
  );
}
