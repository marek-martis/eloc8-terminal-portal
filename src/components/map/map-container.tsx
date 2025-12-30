"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { Device } from "@/hooks/use-devices";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  {
    loading: () => <Skeleton className="w-full h-full rounded-lg" />,
    ssr: false,
  }
);

interface MapContainerProps {
  devices: Device[];
  selectedDeviceId?: string;
  onDeviceSelect?: (deviceId: string) => void;
  className?: string;
}

export function MapContainer({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  className,
}: MapContainerProps) {
  return (
    <LeafletMap
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      onDeviceSelect={onDeviceSelect}
      className={className}
    />
  );
}
