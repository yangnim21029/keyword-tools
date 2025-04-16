'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { type KeywordVolumeItem } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { BarChart3, X } from 'lucide-react';
import React from 'react';

// Define filter types
export type VolumeFilterType = 'high' | 'medium' | 'low' | 'na' | 'all';

interface KeywordVolumeVisualizationProps {
  keywords: KeywordVolumeItem[];
  highVolumeThreshold?: number;
  mediumVolumeThreshold?: number;
  currentFilter: VolumeFilterType;
  onFilterChange: (filter: VolumeFilterType) => void;
}

const KeywordVolumeVisualization: React.FC<KeywordVolumeVisualizationProps> = ({
  keywords,
  highVolumeThreshold = 10000,
  mediumVolumeThreshold = 1000,
  currentFilter,
  onFilterChange
}) => {
  const distribution = React.useMemo(() => {
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let naCount = 0;

    keywords.forEach(kw => {
      const volume = kw.searchVolume;
      if (volume === null || volume === undefined) {
        naCount++;
      } else if (volume >= highVolumeThreshold) {
        highCount++;
      } else if (volume >= mediumVolumeThreshold) {
        mediumCount++;
      } else if (volume > 0) {
        lowCount++;
      }
    });

    const totalWithVolume = highCount + mediumCount + lowCount;
    return {
      high: {
        count: highCount,
        percentage:
          totalWithVolume > 0 ? (highCount / totalWithVolume) * 100 : 0
      },
      medium: {
        count: mediumCount,
        percentage:
          totalWithVolume > 0 ? (mediumCount / totalWithVolume) * 100 : 0
      },
      low: {
        count: lowCount,
        percentage: totalWithVolume > 0 ? (lowCount / totalWithVolume) * 100 : 0
      },
      na: naCount,
      total: keywords.length,
      totalWithVolume: totalWithVolume,
      thresholds: { high: highVolumeThreshold, medium: mediumVolumeThreshold }
    };
  }, [keywords, highVolumeThreshold, mediumVolumeThreshold]);

  const handleFilterClick = (filter: VolumeFilterType) => {
    // If clicking the already active filter, clear it
    onFilterChange(currentFilter === filter ? 'all' : filter);
  };

  // Simple visual representation using colored bars
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center text-lg">
              <BarChart3 className="mr-2 h-5 w-5" /> 搜索量級分佈
            </CardTitle>
            <CardDescription>
              點擊下方色塊或數字以過濾關鍵字列表。
            </CardDescription>
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
      </CardHeader>
      <CardContent>
        {distribution.total === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            無關鍵字數據可供分析。
          </p>
        ) : (
          <div className="space-y-4">
            {/* Bar Visualization - Added cursor-pointer and active state */}
            {distribution.totalWithVolume > 0 && (
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

            {/* Legend / Counts - Added cursor-pointer and active state */}
            <div className="flex flex-wrap justify-around gap-4 text-sm text-muted-foreground pt-2">
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors',
                  currentFilter === 'high' && 'bg-red-100 dark:bg-red-900/30'
                )}
                onClick={() => handleFilterClick('high')}
              >
                <p className="font-semibold text-red-600">
                  {distribution.high.count}
                </p>
                <p className="text-xs">
                  高量級 ({`>=${distribution.thresholds.high.toLocaleString()}`}
                  )
                </p>
              </div>
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors',
                  currentFilter === 'medium' &&
                    'bg-yellow-100 dark:bg-yellow-900/30'
                )}
                onClick={() => handleFilterClick('medium')}
              >
                <p className="font-semibold text-yellow-500">
                  {distribution.medium.count}
                </p>
                <p className="text-xs">
                  中量級 (
                  {`${distribution.thresholds.medium.toLocaleString()}-${(
                    distribution.thresholds.high - 1
                  ).toLocaleString()}`}
                  )
                </p>
              </div>
              <div
                className={cn(
                  'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors',
                  currentFilter === 'low' && 'bg-green-100 dark:bg-green-900/30'
                )}
                onClick={() => handleFilterClick('low')}
              >
                <p className="font-semibold text-green-600">
                  {distribution.low.count}
                </p>
                <p className="text-xs">
                  低量級 (
                  {`> 0 & < ${distribution.thresholds.medium.toLocaleString()}`}
                  )
                </p>
              </div>
              {distribution.na > 0 && (
                <div
                  className={cn(
                    'text-center p-1 rounded cursor-pointer hover:bg-muted transition-colors',
                    currentFilter === 'na' && 'bg-gray-100 dark:bg-gray-700/30'
                  )}
                  onClick={() => handleFilterClick('na')}
                >
                  <p className="font-semibold">{distribution.na}</p>
                  <p className="text-xs">無數據</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KeywordVolumeVisualization;
