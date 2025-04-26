'use client';

import { KeywordVolumeItem } from '@/app/services/firebase/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BarChart, Filter } from 'lucide-react';
import React from 'react';
// Import thresholds from global config
import {
  HIGH_VOLUME_THRESHOLD,
  MEDIUM_VOLUME_THRESHOLD
} from '@/app/global-config';

// Define filter types
export type VolumeFilterType = 'all' | 'high' | 'medium' | 'low';

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
  onFilterChange // Use the callback prop
}: VolumeFilterProps) {
  // Remove commented out hooks

  // Use the passed callback directly
  const handleFilterChange = (newFilter: VolumeFilterType) => {
    onFilterChange(newFilter);
  };

  // Calculate counts based on the received keywords (Using NEW thresholds)
  const validKeywords = Array.isArray(keywords) ? keywords : [];
  const highVolumeCount = validKeywords.filter(
    kw => (kw.searchVolume ?? 0) >= HIGH_VOLUME_THRESHOLD // >= 400
  ).length;
  const mediumVolumeCount = validKeywords.filter(
    kw =>
      (kw.searchVolume ?? 0) >= MEDIUM_VOLUME_THRESHOLD && // >= 100
      (kw.searchVolume ?? 0) < HIGH_VOLUME_THRESHOLD // < 400
  ).length;
  const lowVolumeCount = validKeywords.filter(
    kw => (kw.searchVolume ?? 0) < MEDIUM_VOLUME_THRESHOLD // < 100
  ).length;
  const totalCount = validKeywords.length;

  const distribution = React.useMemo(() => {
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    validKeywords.forEach(kw => {
      const volume = kw.searchVolume;
      const cleanVolume = volume ?? 0;

      // Apply NEW thresholds
      if (cleanVolume >= HIGH_VOLUME_THRESHOLD) {
        // >= 400
        highCount++;
      } else if (cleanVolume >= MEDIUM_VOLUME_THRESHOLD) {
        // 100 - 399
        mediumCount++;
      } else if (cleanVolume > 0) {
        // 1 - 99 (Assuming low means > 0 and < 100)
        lowCount++;
      }
      // Note: cleanVolume === 0 is excluded from percentages but included in total
    });

    // Total for percentage is only non-zero volumes
    const totalNonZeroCount = highCount + mediumCount + lowCount;

    return {
      high: {
        count: highCount,
        percentage:
          totalNonZeroCount > 0 ? (highCount / totalNonZeroCount) * 100 : 0
      },
      medium: {
        count: mediumCount,
        percentage:
          totalNonZeroCount > 0 ? (mediumCount / totalNonZeroCount) * 100 : 0
      },
      low: {
        count: lowCount,
        percentage:
          totalNonZeroCount > 0 ? (lowCount / totalNonZeroCount) * 100 : 0
      },
      total: validKeywords.length
    };
  }, [validKeywords]);

  // Simple visual representation using colored bars
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <BarChart className="mr-2 h-5 w-5" /> 關鍵字數量與搜索量分佈
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
                {highVolumeCount})
              </SelectItem>
              <SelectItem value="medium">
                中量 ({MEDIUM_VOLUME_THRESHOLD.toLocaleString()}-
                {(HIGH_VOLUME_THRESHOLD - 1).toLocaleString()}) (
                {mediumVolumeCount})
              </SelectItem>
              <SelectItem value="low">
                低量 (&lt; {MEDIUM_VOLUME_THRESHOLD.toLocaleString()}) (
                {lowVolumeCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        {distribution.total === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            無關鍵字數據可供分析。
          </p>
        ) : (
          <div className="space-y-4">
            {/* Bar Visualization - Added cursor-pointer and active state */}
            {distribution.total > 0 && (
              <div className="w-full h-8 flex rounded overflow-hidden bg-muted cursor-pointer">
                <div
                  className={cn(
                    'h-full bg-red-500 hover:bg-red-600 transition-all duration-200 flex items-center justify-center text-white text-xs font-medium',
                    currentFilter !== 'all' &&
                      currentFilter !== 'high' &&
                      'opacity-50',
                    currentFilter === 'high' &&
                      'ring-2 ring-offset-2 ring-red-500'
                  )}
                  style={{ width: `${distribution.high.percentage}%` }}
                  title={`高量級 (${distribution.high.count}) - 點擊過濾`}
                >
                  {distribution.high.percentage >= 10 &&
                    `${distribution.high.percentage.toFixed(0)}%`}
                </div>
                <div
                  className={cn(
                    'h-full bg-yellow-400 hover:bg-yellow-500 transition-all duration-200 flex items-center justify-center text-gray-800 text-xs font-medium',
                    currentFilter !== 'all' &&
                      currentFilter !== 'medium' &&
                      'opacity-50',
                    currentFilter === 'medium' &&
                      'ring-2 ring-offset-2 ring-yellow-400'
                  )}
                  style={{ width: `${distribution.medium.percentage}%` }}
                  title={`中量級 (${distribution.medium.count}) - 點擊過濾`}
                >
                  {distribution.medium.percentage >= 10 &&
                    `${distribution.medium.percentage.toFixed(0)}%`}
                </div>
                <div
                  className={cn(
                    'h-full bg-green-500 hover:bg-green-600 transition-all duration-200 flex items-center justify-center text-white text-xs font-medium',
                    currentFilter !== 'all' &&
                      currentFilter !== 'low' &&
                      'opacity-50',
                    currentFilter === 'low' &&
                      'ring-2 ring-offset-2 ring-green-500'
                  )}
                  style={{ width: `${distribution.low.percentage}%` }}
                  title={`低量級 (${distribution.low.count}) - 點擊過濾`}
                >
                  {distribution.low.percentage >= 10 &&
                    `${distribution.low.percentage.toFixed(0)}%`}
                </div>
              </div>
            )}

            {/* Bar for Zero Count (Optional Visualization) */}
            {/* Consider if showing a zero bar is useful or just use the legend */}
            {/* Example: 
            {distribution.zero.count > 0 && (
              <div className="w-full h-4 flex rounded overflow-hidden bg-gray-300 dark:bg-gray-700 mt-1">
                <div 
                  className={cn(
                    'h-full bg-gray-400 dark:bg-gray-600 transition-all duration-200 flex items-center justify-center text-white text-xs font-medium',
                    currentFilter !== 'all' && currentFilter !== 'zero' && 'opacity-50',
                    currentFilter === 'zero' && 'ring-2 ring-offset-2 ring-gray-400'
                  )}
                  style={{ width: `${distribution.zero.percentage}%` }}
                  title={`零量級 (${distribution.zero.count}) - 點擊過濾`}
                  onClick={() => handleFilterChange('zero')}
                >
                  {distribution.zero.percentage >= 10 && `${distribution.zero.percentage.toFixed(0)}%`}
                </div>
              </div>
            )}
            */}

            {/* Legend / Counts - Update labels */}
            <div className="flex flex-wrap justify-around gap-4 text-sm text-muted-foreground pt-2">
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors flex flex-col items-center',
                  currentFilter === 'high' && 'bg-red-100 dark:bg-red-900/30'
                )}
              >
                <p className="font-semibold text-red-600">
                  {distribution.high.count}
                </p>
                <p className="text-xs">
                  高 ({`>=${HIGH_VOLUME_THRESHOLD.toLocaleString()}`})
                </p>
              </div>
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors flex flex-col items-center',
                  currentFilter === 'medium' &&
                    'bg-yellow-100 dark:bg-yellow-900/30'
                )}
              >
                <p className="font-semibold text-yellow-500">
                  {distribution.medium.count}
                </p>
                <p className="text-xs">
                  中 (
                  {`${MEDIUM_VOLUME_THRESHOLD.toLocaleString()}-${(
                    HIGH_VOLUME_THRESHOLD - 1
                  ).toLocaleString()}`}
                  )
                </p>
              </div>
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors flex flex-col items-center',
                  currentFilter === 'low' && 'bg-green-100 dark:bg-green-900/30'
                )}
              >
                <p className="font-semibold text-green-600">
                  {distribution.low.count}
                </p>
                <p className="text-xs">
                  低 ({`<${MEDIUM_VOLUME_THRESHOLD.toLocaleString()}`})
                  {/* Adjusted low label slightly for clarity */}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
