'use client';

import { Badge } from '@/components/ui/badge'; // Import Badge for visual indication
import { Button } from '@/components/ui/button'; // Import Button for trigger
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'; // Import Dropdown components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'; // Import Table components
import { KeywordVolumeItem, VolumeDistributionData } from '@/lib/schema';
import { formatVolume } from '@/lib/utils'; // Import formatVolume from utils
import { BarChartHorizontal, MoreHorizontal, Sigma } from 'lucide-react'; // Add MoreHorizontal icon
import React, { useMemo } from 'react';

interface KeywordDistributeProps {
  keywords: KeywordVolumeItem[]; // Use KeywordVolumeItem[]
}

// Helper function for formatting count numbers
const formatCount = (count: number): string => {
  return count.toLocaleString();
};

// Define Range Boundaries
const RANGES = {
  ZERO: { min: 0, max: 0, label: 'Volume 0' },
  R1: { min: 1, max: 10, label: '1 - 10' },
  R2: { min: 11, max: 1000, label: '11 - 1k' },
  R3: { min: 1001, max: 10000, label: '1k - 10k' },
  R4: { min: 10001, max: 100000, label: '10k - 100k' },
  R5: { min: 100001, max: Infinity, label: '> 100k' }
};

const KeywordDistribute: React.FC<KeywordDistributeProps> = ({ keywords }) => {
  const volumeDistribution: VolumeDistributionData = useMemo(() => {
    const counts = {
      countZero: 0,
      countRange1: 0,
      countRange2: 0,
      countRange3: 0,
      countRange4: 0,
      countRange5: 0
    };

    let minVolume = Infinity;
    let maxVolume = 0;
    let totalCount = 0;

    keywords.forEach(kw => {
      const volume = kw.searchVolume ?? 0;
      totalCount++;
      if (volume < minVolume) minVolume = volume;
      if (volume > maxVolume) maxVolume = volume;

      if (volume === 0) counts.countZero++;
      else if (volume >= RANGES.R1.min && volume <= RANGES.R1.max)
        counts.countRange1++;
      else if (volume >= RANGES.R2.min && volume <= RANGES.R2.max)
        counts.countRange2++;
      else if (volume >= RANGES.R3.min && volume <= RANGES.R3.max)
        counts.countRange3++;
      else if (volume >= RANGES.R4.min && volume <= RANGES.R4.max)
        counts.countRange4++;
      else if (volume >= RANGES.R5.min) counts.countRange5++;
    });

    // Map counts to the VolumeDistributionData array structure
    const distributionData: VolumeDistributionData = [
      { range: RANGES.ZERO.label, count: counts.countZero },
      { range: RANGES.R1.label, count: counts.countRange1 },
      { range: RANGES.R2.label, count: counts.countRange2 },
      { range: RANGES.R3.label, count: counts.countRange3 },
      { range: RANGES.R4.label, count: counts.countRange4 },
      { range: RANGES.R5.label, count: counts.countRange5 }
    ].filter(item => item.count > 0); // Optionally filter out ranges with zero count

    // Add min/max/totalCount as extra properties if needed elsewhere, but they are not part of VolumeDistributionData
    // return { ...counts, min: minVolume === Infinity ? 0 : minVolume, max: maxVolume, count: totalCount }; // Old return structure
    return distributionData; // Return the array conforming to the type
  }, [keywords]);

  const [selectedRangeLabel, setSelectedRangeLabel] = React.useState<
    string | null
  >(
    RANGES.R2.label // Default selected range remains '11 - 1k'
  );

  // Prepare data for the range cards and dropdown, now using the array
  const rangeCardData = useMemo(() => {
    const data = volumeDistribution.map(item => {
      let color = 'bg-gray-100 dark:bg-gray-800/50';
      let textColor = 'text-gray-600 dark:text-gray-400';
      if (item.range === RANGES.R1.label) {
        color = 'bg-sky-100 dark:bg-sky-900/50';
        textColor = 'text-sky-700 dark:text-sky-300';
      } else if (item.range === RANGES.R2.label) {
        color = 'bg-blue-100 dark:bg-blue-900/50';
        textColor = 'text-blue-700 dark:text-blue-300';
      } else if (item.range === RANGES.R3.label) {
        color = 'bg-indigo-100 dark:bg-indigo-900/50';
        textColor = 'text-indigo-700 dark:text-indigo-300';
      } else if (item.range === RANGES.R4.label) {
        color = 'bg-purple-100 dark:bg-purple-900/50';
        textColor = 'text-purple-700 dark:text-purple-300';
      } else if (item.range === RANGES.R5.label) {
        color = 'bg-fuchsia-100 dark:bg-fuchsia-900/50';
        textColor = 'text-fuchsia-700 dark:text-fuchsia-300';
      }
      return {
        label: item.range,
        count: item.count,
        color,
        textColor
      };
    });
    return data;
  }, [volumeDistribution]);

  // Calculate overall min/max/count separately if needed
  const overallStats = useMemo(() => {
    let minVolume = Infinity;
    let maxVolume = 0;
    let totalNonZeroCount = 0;
    let zeroCount = 0;
    keywords.forEach(kw => {
      const volume = kw.searchVolume ?? 0;
      if (volume === 0) {
        zeroCount++;
      } else {
        totalNonZeroCount++;
        if (volume < minVolume) minVolume = volume;
        if (volume > maxVolume) maxVolume = volume;
      }
    });
    return {
      min: minVolume === Infinity ? 0 : minVolume,
      max: maxVolume,
      count: totalNonZeroCount, // Count of keywords with volume > 0
      countZero: zeroCount // Count of keywords with volume == 0
    };
  }, [keywords]);

  // Function to check if a keyword volume falls within the selected range
  const isVolumeInRange = (
    volume: number,
    rangeLabel: string | null
  ): boolean => {
    if (!rangeLabel) return false; // No range selected

    const rangeKey = Object.keys(RANGES).find(
      key => RANGES[key as keyof typeof RANGES].label === rangeLabel
    );
    if (!rangeKey) return false;

    const range = RANGES[rangeKey as keyof typeof RANGES];
    const vol = volume ?? 0;

    if (rangeLabel === RANGES.ZERO.label) {
      return vol === 0;
    } else {
      return vol >= range.min && vol <= range.max;
    }
  };

  // Memoize the filtered keywords list
  const filteredKeywords = useMemo(() => {
    if (!selectedRangeLabel) {
      return []; // Return empty if no range is selected
    }
    return keywords.filter((kw: KeywordVolumeItem) =>
      isVolumeInRange(kw.searchVolume ?? 0, selectedRangeLabel)
    );
  }, [keywords, selectedRangeLabel]);

  // Find the data for the currently selected range
  const selectedRangeData = useMemo(() => {
    return rangeCardData.find(r => r.label === selectedRangeLabel);
  }, [selectedRangeLabel, rangeCardData]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Distribution Section */}
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChartHorizontal className="h-5 w-5 text-indigo-500" />
          搜索量分布
          <span className="text-sm font-normal text-muted-foreground">
            (總共 {formatCount(overallStats.count + overallStats.countZero)}{' '}
            個關鍵詞)
          </span>
        </h3>
        {/* Grid for Stats and Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Overall Range Block */}
          <div className="p-3 bg-muted/50 col-span-1 flex flex-col justify-center text-center rounded-md">
            <p className="text-xs text-muted-foreground">整體範圍</p>
            <p className="text-lg font-semibold">
              {formatVolume(overallStats.min)} -{' '}
              {formatVolume(overallStats.max)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">(Min - Max)</p>
          </div>

          {/* Selected Range Stats Block with Dropdown Trigger */}
          <div
            className={`relative col-span-1 flex flex-col justify-center text-center p-3 transition-colors duration-200 rounded-md ${
              selectedRangeData ? selectedRangeData.color : 'bg-muted/50'
            }`}
          >
            {/* Dropdown Menu Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="absolute top-1 right-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">選擇範圍</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {rangeCardData.map(range => (
                  <DropdownMenuItem
                    key={range.label}
                    onSelect={() => setSelectedRangeLabel(range.label)}
                    className={
                      selectedRangeLabel === range.label ? 'bg-accent' : ''
                    }
                  >
                    範圍 {range.label} ({formatCount(range.count)} 個詞)
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onSelect={() => setSelectedRangeLabel(null)}
                  className="text-muted-foreground"
                >
                  清除選擇
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Display selected range info */}
            {selectedRangeData ? (
              <>
                <p
                  className={`text-xs font-medium ${selectedRangeData.textColor}`}
                >
                  範圍 {selectedRangeData.label}
                </p>
                <p
                  className={`text-lg font-semibold ${selectedRangeData.textColor}`}
                >
                  {formatCount(selectedRangeData.count)} 個詞
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">未選擇範圍</p>
                <p className="text-lg font-semibold text-muted-foreground">-</p>
              </>
            )}
          </div>

          {/* Total Count Block */}
          <div className="p-3 bg-green-50 dark:bg-green-900/30 col-span-1 flex flex-col justify-center text-center rounded-md">
            <p className="text-xs text-green-700 dark:text-green-300 flex items-center justify-center gap-1">
              <Sigma size={14} /> 有效詞總數
            </p>
            <p className="text-lg font-semibold text-green-800 dark:text-green-200">
              {formatCount(overallStats.count)}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              (Volume ≥ 1)
            </p>
          </div>
        </div>
      </div>

      {/* Filtered Keywords List Section */}
      {selectedRangeLabel && (
        <div className="bg-card border rounded-lg">
          <h4 className="text-md font-semibold p-4 border-b flex items-center gap-2">
            關鍵詞列表
            <Badge variant="secondary">
              {formatCount(filteredKeywords.length)} 個
            </Badge>
            <button
              onClick={() => setSelectedRangeLabel(null)}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              (清除選擇)
            </button>
          </h4>
          {filteredKeywords.length > 0 ? (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[70%] font-medium text-muted-foreground">
                      關鍵詞
                    </TableHead>
                    <TableHead className="text-right font-medium text-muted-foreground">
                      搜索量
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeywords.map(
                    (keyword: KeywordVolumeItem, index: number) => (
                      <TableRow key={`${keyword.text}-${index}`}>
                        <TableCell className="font-medium">
                          {keyword.text}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatVolume(keyword.searchVolume ?? 0)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="p-4 text-center text-muted-foreground italic">
              此範圍內沒有關鍵詞。
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default KeywordDistribute;
