"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, unit, trend, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && (
            <span className="text-sm text-muted-foreground">{unit}</span>
          )}
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-sm mt-1",
              trend.direction === "up" && "text-green-600",
              trend.direction === "down" && "text-red-600",
              trend.direction === "neutral" && "text-muted-foreground"
            )}
          >
            {trend.direction === "up" && <TrendingUp className="h-4 w-4" />}
            {trend.direction === "down" && <TrendingDown className="h-4 w-4" />}
            {trend.direction === "neutral" && <Minus className="h-4 w-4" />}
            <span>{trend.value}%</span>
            {trend.label && (
              <span className="text-muted-foreground">{trend.label}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
