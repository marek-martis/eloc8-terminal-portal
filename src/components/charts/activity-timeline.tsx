"use client";

import { format } from "date-fns";
import { Circle, Wifi, WifiOff, Activity, AlertCircle } from "lucide-react";

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: string;
  deviceId: string;
  details: Record<string, unknown>;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  isLoading?: boolean;
}

function getEventIcon(event: TimelineEvent) {
  const eventType = event.details.event as string;

  switch (eventType) {
    case "CONNECT":
      return <Wifi className="h-4 w-4 text-green-500" />;
    case "DISCONNECT":
      return <WifiOff className="h-4 w-4 text-red-500" />;
    case "ACTIVITY":
      return <Activity className="h-4 w-4 text-blue-500" />;
    case "INACTIVITY":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

function getEventColor(event: TimelineEvent): string {
  const eventType = event.details.event as string;

  switch (eventType) {
    case "CONNECT":
      return "bg-green-500";
    case "DISCONNECT":
      return "bg-red-500";
    case "ACTIVITY":
      return "bg-blue-500";
    case "INACTIVITY":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

function getEventLabel(event: TimelineEvent): string {
  const eventType = event.details.event as string;

  switch (eventType) {
    case "CONNECT":
      return "Connected";
    case "DISCONNECT":
      return "Disconnected";
    case "ACTIVITY":
      return "Activity";
    case "INACTIVITY":
      return "Inactive";
    default:
      return eventType || "Event";
  }
}

export function ActivityTimeline({ events, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-4 h-4 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        No events found for the selected time range
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

      <div className="space-y-4">
        {events.map((event, index) => (
          <div key={event.id} className="relative flex gap-4 pl-6">
            {/* Timeline dot */}
            <div
              className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-background ${getEventColor(
                event
              )}`}
            />

            {/* Event content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                {getEventIcon(event)}
                <span className="font-medium text-sm">{getEventLabel(event)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(event.timestamp), "MMM d, yyyy 'at' HH:mm:ss")}
              </p>
              {event.details.success === false && (
                <p className="text-xs text-red-500 mt-1">
                  Error: {String(event.details.error || "Unknown error")}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
