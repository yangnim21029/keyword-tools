'use client';

import type { Keyword } from '@/app/types'; // Import Keyword type
import { Badge } from '@/components/ui/badge'; // Import Badge for visual indication
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'; // Import Table components
import { BarChartHorizontal, Sigma } from 'lucide-react';
import { useMemo, useState } from 'react'; // Import hooks

// Define the expected prop type (matching the one calculated in page.tsx)
// Updated for Fixed Volume Ranges
interface VolumeDistributionData {
  min: number; // Overall min volume (>= 0)
  max: number; // Overall max volume
  count: number; // Total count of keywords with volume >= 1
  countZero: number; // Count of keywords with volume 0
  countRange1: number; // Count in [1, 10]
  countRange2: number; // Count in [11, 1000]
  countRange3: number; // Count in [1001, 10000]
  countRange4: number; // Count in [10001, 100000]
  countRange5: number; // Count in >= 100001
}

interface KeywordDistributeProps {
  volumeDistribution: VolumeDistributionData; // Use the updated interface
  keywords: Keyword[]; // Add keywords prop
}

// Helper function for formatting volume numbers (copied from KeywordResearchDetail)
const formatVolume = (volume: number): string => {
  if (volume >= 10000) return `${(volume / 1000).toFixed(0)}k`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return volume.toLocaleString();
};

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

export default function KeywordDistribute({
  volumeDistribution,
  keywords // Destructure keywords prop
}: KeywordDistributeProps) {
  const [selectedRangeLabel, setSelectedRangeLabel] = useState<string | null>(
    RANGES.R2.label // Set default selected range to '11 - 1k'
  );

  // Prepare data for the range cards
  const rangeCardData = [
    {
      label: RANGES.R1.label,
      count: volumeDistribution.countRange1,
      color: 'bg-sky-100 dark:bg-sky-900/50',
      textColor: 'text-sky-700 dark:text-sky-300'
    },
    {
      label: RANGES.R2.label,
      count: volumeDistribution.countRange2,
      color: 'bg-blue-100 dark:bg-blue-900/50',
      textColor: 'text-blue-700 dark:text-blue-300'
    },
    {
      label: RANGES.R3.label,
      count: volumeDistribution.countRange3,
      color: 'bg-indigo-100 dark:bg-indigo-900/50',
      textColor: 'text-indigo-700 dark:text-indigo-300'
    },
    {
      label: RANGES.R4.label,
      count: volumeDistribution.countRange4,
      color: 'bg-purple-100 dark:bg-purple-900/50',
      textColor: 'text-purple-700 dark:text-purple-300'
    },
    {
      label: RANGES.R5.label,
      count: volumeDistribution.countRange5,
      color: 'bg-fuchsia-100 dark:bg-fuchsia-900/50',
      textColor: 'text-fuchsia-700 dark:text-fuchsia-300'
    }
  ];

  // Add the 'Volume 0' card if needed
  if (volumeDistribution.countZero > 0) {
    rangeCardData.unshift({
      label: RANGES.ZERO.label,
      count: volumeDistribution.countZero,
      color: 'bg-gray-100 dark:bg-gray-800/50',
      textColor: 'text-gray-600 dark:text-gray-400'
    });
  }

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
    return keywords.filter(kw =>
      isVolumeInRange(kw.searchVolume ?? 0, selectedRangeLabel)
    );
  }, [keywords, selectedRangeLabel]);

  // Handle card click
  const handleCardClick = (label: string) => {
    setSelectedRangeLabel(prevLabel => (prevLabel === label ? null : label));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Distribution Cards Section - Remove border and rounded-lg */}
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChartHorizontal className="h-5 w-5 text-indigo-500" />
          搜索量分布
          <span className="text-sm font-normal text-muted-foreground">
            (總共{' '}
            {formatCount(
              volumeDistribution.count + volumeDistribution.countZero
            )}{' '}
            個關鍵詞)
          </span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-center">
          {/* Min/Max Block - Remove rounded-md */}
          <div className="p-3 bg-muted/50 col-span-1 sm:col-span-2 md:col-span-1 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground">整體範圍</p>
            <p className="text-lg font-semibold">
              {formatVolume(volumeDistribution.min)} -{' '}
              {formatVolume(volumeDistribution.max)}
            </p>
            <p className="text-xs text-muted-foreground mt-1"> (Min - Max)</p>
          </div>

          {/* Clickable Range Blocks - Remove rounded-md */}
          {rangeCardData.map(range => (
            <div
              key={range.label}
              className={`p-3 flex flex-col justify-center cursor-pointer transition-all duration-200 ease-in-out ${
                range.color
              } ${
                selectedRangeLabel === range.label
                  ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-indigo-400'
                  : 'hover:opacity-80'
              }`}
              onClick={() => handleCardClick(range.label)}
            >
              <p className={`text-xs font-medium ${range.textColor}`}>
                範圍 {range.label}
              </p>
              <p className={`text-lg font-semibold ${range.textColor}`}>
                {formatCount(range.count)} 個詞
              </p>
            </div>
          ))}

          {/* Total Count Block - Remove rounded-md */}
          <div className="p-3 bg-green-50 dark:bg-green-900/30 col-span-1 sm:col-span-2 md:col-span-1 flex flex-col justify-center">
            <p className="text-xs text-green-700 dark:text-green-300 flex items-center justify-center gap-1">
              <Sigma size={14} /> 有效詞總數
            </p>
            <p className="text-lg font-semibold text-green-800 dark:text-green-200">
              {formatCount(volumeDistribution.count)}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              (Volume ≥ 1)
            </p>
          </div>
        </div>
      </div>

      {/* Filtered Keywords List Section */}
      {selectedRangeLabel && (
        // Remove max-h and overflow from the list container, remove sticky from header
        <div className="bg-card">
          {' '}
          {/* Removed max-h-[500px] overflow-y-auto */}
          <h4 className="text-md font-semibold p-4 border-b flex items-center gap-2">
            關鍵詞列表
            <Badge variant="secondary">
              {formatCount(filteredKeywords.length)} 個
            </Badge>
            <button
              onClick={() => setSelectedRangeLabel(null)} // Clear selection button
              className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              (清除選擇)
            </button>
          </h4>
          {filteredKeywords.length > 0 ? (
            <Table>
              <TableHeader>
                {/* Add background to header row for distinction */}
                <TableRow className="bg-muted/50 hover:bg-muted/50"> 
                  {/* Adjust header text style */}
                  <TableHead className="w-[70%] font-medium text-muted-foreground">關鍵詞</TableHead>
                  <TableHead className="text-right font-medium text-muted-foreground">搜索量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeywords.map((keyword, index) => (
                  <TableRow key={`${keyword.text}-${index}`}>
                    <TableCell className="font-medium">
                      {keyword.text}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatVolume(keyword.searchVolume ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-4 text-center text-muted-foreground italic">
              此範圍內沒有關鍵詞。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
