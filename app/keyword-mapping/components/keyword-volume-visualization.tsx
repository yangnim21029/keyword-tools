'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { type KeywordVolumeItem } from '@/app/services/firebase/types';
import { cn } from '@/lib/utils';
import { BarChart3, X } from 'lucide-react';
import React from 'react';

// Define filter types
export type VolumeFilterType = 'high' | 'medium' | 'low' | 'all';

interface KeywordVolumeVisualizationProps {
  keywords: KeywordVolumeItem[];
  currentFilter: VolumeFilterType;
  onFilterChange: (filter: VolumeFilterType) => void;
}

// Define fixed thresholds
const HIGH_VOLUME_THRESHOLD = 10000;
const MEDIUM_VOLUME_THRESHOLD = 500;

const KeywordVolumeVisualization: React.FC<KeywordVolumeVisualizationProps> = ({
  keywords,
  currentFilter,
  onFilterChange
}) => {
  const distribution = React.useMemo(() => {
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    keywords.forEach(kw => {
      const volume = kw.searchVolume;
      // Handle null/undefined as zero
      const cleanVolume = volume ?? 0;

      if (cleanVolume >= HIGH_VOLUME_THRESHOLD) {
        highCount++;
      } else if (cleanVolume >= MEDIUM_VOLUME_THRESHOLD) {
        mediumCount++;
      } else if (cleanVolume > 0) {
        lowCount++;
      }
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
        percentage: totalNonZeroCount > 0 ? (lowCount / totalNonZeroCount) * 100 : 0
      },
      total: keywords.length,
    };
  }, [keywords]);

  const handleFilterClick = (filter: VolumeFilterType) => {
    // If clicking the already active filter, clear it
    onFilterChange(currentFilter === filter ? 'all' : filter);
  };

  // Simple visual representation using colored bars
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="flex items-center text-lg font-semibold">
            <BarChart3 className="mr-2 h-5 w-5" /> 點擊分類篩選關鍵字 - 快速查看不同搜索量級
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            點擊下方 高 / 中 / 低 分類，即可篩選出對應搜索量範圍的關鍵字。
          </p>
        </div>
        {currentFilter !== 'all' && (
          <button
            onClick={() => onFilterChange('all')}
            className="text-xs text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted transition-colors"
            title="清除過濾器"
          >
            <X size={16} />
          </button>
        )}
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
                  onClick={() => handleFilterClick('high')}
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
                  onClick={() => handleFilterClick('medium')}
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
                  onClick={() => handleFilterClick('low')}
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
                  onClick={() => handleFilterClick('zero')}
                >
                  {distribution.zero.percentage >= 10 && `${distribution.zero.percentage.toFixed(0)}%`}
                </div>
              </div>
            )}
            */}

            {/* Legend / Counts - Added cursor-pointer and active state */}
            <div className="flex flex-wrap justify-around gap-4 text-sm text-muted-foreground pt-2">
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors flex flex-col items-center',
                  currentFilter === 'high' && 'bg-red-100 dark:bg-red-900/30'
                )}
                onClick={() => handleFilterClick('high')}
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
                onClick={() => handleFilterClick('medium')}
              >
                <p className="font-semibold text-yellow-500">
                  {distribution.medium.count}
                </p>
                <p className="text-xs">
                  中 ({`${MEDIUM_VOLUME_THRESHOLD.toLocaleString()}-${(HIGH_VOLUME_THRESHOLD - 1).toLocaleString()}`})
                </p>
              </div>
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors flex flex-col items-center',
                  currentFilter === 'low' && 'bg-green-100 dark:bg-green-900/30'
                )}
                onClick={() => handleFilterClick('low')}
              >
                <p className="font-semibold text-green-600">
                  {distribution.low.count}
                </p>
                <p className="text-xs">
                  低 ({`1-${(MEDIUM_VOLUME_THRESHOLD - 1).toLocaleString()}`})
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KeywordVolumeVisualization;
