import { useQuery } from "@tanstack/react-query";

export interface DeviceProfile {
  id: string;
  name: string;
}

async function fetchDeviceProfiles(): Promise<DeviceProfile[]> {
  const response = await fetch("/api/stale-devices/profiles");
  if (!response.ok) {
    throw new Error("Failed to fetch device profiles");
  }
  return response.json();
}

export function useDeviceProfiles() {
  return useQuery<DeviceProfile[], Error>({
    queryKey: ["device-profiles"],
    queryFn: fetchDeviceProfiles,
  });
}
