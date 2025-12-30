"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import { cn } from "@/lib/utils";
import type { Device } from "@/hooks/use-devices";

const activeIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#22c55e" width="32" height="32">
      <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const inactiveIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af" width="32" height="32">
      <circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const selectedIcon = new L.Icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" width="40" height="40">
      <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface LeafletMapProps {
  devices: Device[];
  selectedDeviceId?: string;
  onDeviceSelect?: (deviceId: string) => void;
  className?: string;
}

function MapController({
  selectedDeviceId,
  devices,
}: {
  selectedDeviceId?: string;
  devices: Device[];
}) {
  const map = useMap();
  const initialFitDone = useRef(false);

  // Fly to selected device
  useEffect(() => {
    if (selectedDeviceId) {
      const device = devices.find((d) => d.id === selectedDeviceId);
      if (device?.location) {
        map.flyTo([device.location.lat, device.location.lng], 16, {
          duration: 1.5,
        });
      }
    }
  }, [selectedDeviceId, devices, map]);

  // Initial fit to bounds - only once when devices first load
  useEffect(() => {
    if (initialFitDone.current) return;

    const devicesWithLocation = devices.filter((d) => d.location);
    if (devicesWithLocation.length > 0) {
      const bounds = L.latLngBounds(
        devicesWithLocation.map((d) => [d.location!.lat, d.location!.lng])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      initialFitDone.current = true;
    }
  }, [devices, map]);

  return null;
}

export function LeafletMap({
  devices,
  selectedDeviceId,
  onDeviceSelect,
  className,
}: LeafletMapProps) {
  const devicesWithLocation = devices.filter((d) => d.location);
  const defaultCenter: [number, number] =
    devicesWithLocation.length > 0
      ? [devicesWithLocation[0].location!.lat, devicesWithLocation[0].location!.lng]
      : [51.505, -0.09];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className={cn("w-full h-full rounded-lg", className)}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {devicesWithLocation.map((device) => {
        const isSelected = device.id === selectedDeviceId;
        const icon = isSelected
          ? selectedIcon
          : device.isActive
            ? activeIcon
            : inactiveIcon;

        return (
          <Marker
            key={device.id}
            position={[device.location!.lat, device.location!.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onDeviceSelect?.(device.id),
            }}
          >
            <Popup>
              <div className="min-w-[150px]">
                <h3 className="font-semibold">{device.name}</h3>
                <p className="text-sm text-gray-500">{device.type}</p>
                <p className="text-xs mt-1">
                  Status:{" "}
                  <span
                    className={device.isActive ? "text-green-600" : "text-gray-500"}
                  >
                    {device.isActive ? "Active" : "Inactive"}
                  </span>
                </p>
                {device.lastTelemetryAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Last update: {new Date(device.lastTelemetryAt).toLocaleString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      <MapController selectedDeviceId={selectedDeviceId} devices={devices} />
    </MapContainer>
  );
}
