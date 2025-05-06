"use client";

import { KeywordVolumeItem } from "@/app/services/firebase/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import React from "react";
// Import thresholds from global config
import {
  HIGH_VOLUME_THRESHOLD,
  MEDIUM_VOLUME_THRESHOLD,
} from "@/app/global-config";

// Define filter types
export type VolumeFilterType = "all" | "high" | "medium" | "low";

interface VolumeFilterProps {
  keywords: KeywordVolumeItem[] | undefined | null; // Accept potentially null/undefined
  currentFilter: VolumeFilterType;
  onFilterChange: (newFilter: VolumeFilterType) => void; // Add callback prop
}

// Define NEW fixed thresholds
// const HIGH_VOLUME_THRESHOLD = 400; // Removed - Defined globally
// const MEDIUM_VOLUME_THRESHOLD = 100; // Removed - Defined globally
// Low is implicitly < 100

export default function VolumeFilter({
  keywords,
  currentFilter,
  onFilterChange, // Use the callback prop
}: VolumeFilterProps) {
  // Remove commented out hooks

  // Use the passed callback directly
  const handleFilterChange = (newFilter: VolumeFilterType) => {
    onFilterChange(newFilter);
  };

  // --- UPDATED: Calculate counts for SelectItem display only ---
  const validKeywords = Array.isArray(keywords) ? keywords : [];
  const counts = React.useMemo(() => {
    return {
      high: validKeywords.filter(
        (kw) => (kw.searchVolume ?? 0) >= HIGH_VOLUME_THRESHOLD,
      ).length,
      medium: validKeywords.filter(
        (kw) =>
          (kw.searchVolume ?? 0) >= MEDIUM_VOLUME_THRESHOLD &&
          (kw.searchVolume ?? 0) < HIGH_VOLUME_THRESHOLD,
      ).length,
      low: validKeywords.filter(
        (kw) => (kw.searchVolume ?? 0) < MEDIUM_VOLUME_THRESHOLD,
      ).length,
    };
  }, [validKeywords, HIGH_VOLUME_THRESHOLD, MEDIUM_VOLUME_THRESHOLD]);
  const totalCount = validKeywords.length;

  // Simple visual representation using colored bars
  return (
    <div className="flex items-center justify-between border rounded-lg p-4 bg-card">
      <h3 className="text-base font-medium text-muted-foreground">
        搜索量篩選
      </h3>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={currentFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="篩選搜索量" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 ({totalCount})</SelectItem>
            <SelectItem value="high">
              高量 (&gt;= {HIGH_VOLUME_THRESHOLD.toLocaleString()}) (
              {counts.high})
            </SelectItem>
            <SelectItem value="medium">
              中量 ({MEDIUM_VOLUME_THRESHOLD.toLocaleString()}-
              {(HIGH_VOLUME_THRESHOLD - 1).toLocaleString()}) ({counts.medium})
            </SelectItem>
            <SelectItem value="low">
              低量 (&lt; {MEDIUM_VOLUME_THRESHOLD.toLocaleString()}) (
              {counts.low})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
