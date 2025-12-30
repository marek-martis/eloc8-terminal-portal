"use client";

import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Color palette for different data series
const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

interface TimeSeriesChartProps {
  data: Array<Record<string, number | string>>;
  dataKeys: string[];
  height?: number;
  showGrid?: boolean;
  formatTooltip?: (value: number, key: string) => string;
}

function formatTimestamp(ts: number): string {
  return format(new Date(ts), "MMM d, HH:mm");
}

function formatTooltipTimestamp(ts: number): string {
  return format(new Date(ts), "MMM d, yyyy HH:mm:ss");
}

export function TimeSeriesChart({
  data,
  dataKeys,
  height = 300,
  showGrid = true,
  formatTooltip,
}: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No data available for the selected time range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        <XAxis
          dataKey="ts"
          tickFormatter={formatTimestamp}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          labelFormatter={(label) => formatTooltipTimestamp(label as number)}
          formatter={(value, name) => {
            const numValue = typeof value === "number" ? value : 0;
            if (formatTooltip) {
              return [formatTooltip(numValue, name as string), name];
            }
            return [numValue.toFixed(2), name];
          }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Legend />
        {dataKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Multi-axis variant for different scales (e.g., speed in km/h vs battery in %)
interface MultiAxisTimeSeriesChartProps {
  data: Array<Record<string, number | string>>;
  leftAxisKeys: string[];
  rightAxisKeys: string[];
  leftAxisLabel?: string;
  rightAxisLabel?: string;
  height?: number;
}

export function MultiAxisTimeSeriesChart({
  data,
  leftAxisKeys,
  rightAxisKeys,
  leftAxisLabel,
  rightAxisLabel,
  height = 300,
}: MultiAxisTimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height }}
      >
        No data available for the selected time range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="ts"
          tickFormatter={formatTimestamp}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={60}
          label={
            leftAxisLabel
              ? { value: leftAxisLabel, angle: -90, position: "insideLeft" }
              : undefined
          }
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={60}
          label={
            rightAxisLabel
              ? { value: rightAxisLabel, angle: 90, position: "insideRight" }
              : undefined
          }
        />
        <Tooltip
          labelFormatter={(label) => formatTooltipTimestamp(label as number)}
          formatter={(value, name) => {
            const numValue = typeof value === "number" ? value : 0;
            return [numValue.toFixed(2), name];
          }}
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <Legend />
        {leftAxisKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            yAxisId="left"
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
        {rightAxisKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            yAxisId="right"
            stroke={COLORS[(leftAxisKeys.length + index) % COLORS.length]}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
