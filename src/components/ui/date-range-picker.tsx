"use client";

import * as React from "react";
import { format, subHours, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DATE_RANGE_PRESETS } from "@/lib/constants";

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  className,
  align = "start",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handlePresetClick = (preset: keyof typeof DATE_RANGE_PRESETS) => {
    const now = new Date();
    const config = DATE_RANGE_PRESETS[preset];
    let from: Date;

    if ("hours" in config) {
      from = subHours(now, config.hours);
    } else {
      from = subDays(now, config.days);
    }

    onChange?.({ from, to: now });
    setOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y")} -{" "}
                  {format(value.to, "LLL dd, y")}
                </>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex">
            <div className="border-r p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Presets
              </p>
              {Object.entries(DATE_RANGE_PRESETS).map(([key, config]) => (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() =>
                    handlePresetClick(key as keyof typeof DATE_RANGE_PRESETS)
                  }
                >
                  {config.label}
                </Button>
              ))}
            </div>
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onChange}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
