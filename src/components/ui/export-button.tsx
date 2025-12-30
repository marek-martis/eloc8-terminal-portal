"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";

interface ExportButtonProps {
  deviceId?: string;
  deviceName?: string;
  dateRange?: DateRange;
  keys?: string[];
  disabled?: boolean;
}

export function ExportButton({
  deviceId,
  deviceName = "device",
  dateRange,
  keys = ["speed", "battery", "signal"],
  disabled = false,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleExportCSV = async () => {
    if (!deviceId || !dateRange?.from || !dateRange?.to) {
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        deviceId,
        deviceName,
        keys: keys.join(","),
        startTs: String(dateRange.from.getTime()),
        endTs: String(dateRange.to.getTime()),
      });

      const response = await fetch(`/api/export/csv?${params}`);
      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!deviceId || !dateRange?.from || !dateRange?.to) {
      return;
    }

    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        deviceId,
        deviceName,
        keys: keys.join(","),
        startTs: String(dateRange.from.getTime()),
        endTs: String(dateRange.to.getTime()),
      });

      const response = await fetch(`/api/export/pdf?${params}`);
      if (!response.ok) {
        throw new Error("PDF export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") || "export.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setOpen(false);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = disabled || !deviceId || !dateRange?.from || !dateRange?.to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export as CSV
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
