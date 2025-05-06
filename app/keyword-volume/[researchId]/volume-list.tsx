'use client';

import { KeywordVolumeItem } from '@/app/services/firebase/schema';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatVolume } from '@/lib/utils';
import { useMemo, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import VolumeFilter, { type VolumeFilterType } from './volume-filter';
import { PaginationControls } from './volume-list-pagination-control';
// Import thresholds from global config
import {
  HIGH_VOLUME_THRESHOLD,
  MEDIUM_VOLUME_THRESHOLD
} from '@/app/global-config';

// Define NEW constants to match VolumeFilter
// const HIGH_VOLUME_THRESHOLD = 400; // Removed - Defined globally
// const MEDIUM_VOLUME_THRESHOLD = 100; // Removed - Defined globally
// Low is implicitly < 100
const ROWS_PER_PAGE = 12;

interface VolumeListProps {
  keywords: KeywordVolumeItem[]; // Expecting the full, sorted list
  researchId: string; // Needed for PaginationControls base path (can be adjusted)
}

export default function VolumeList({
  keywords: initialKeywords, // Rename prop for clarity
  researchId
}: VolumeListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilterType>('all');
  const [isCopied, setIsCopied] = useState(false);

  // Memoize filtered and paginated keywords (using NEW thresholds)
  const {
    keywordsForCurrentPage,
    totalPages,
    totalKeywords,
    maxOverallVolume
  } = useMemo(() => {
    const filteredKeywords = initialKeywords.filter(kw => {
      const volume = kw.searchVolume ?? 0;
      switch (volumeFilter) {
        case 'high':
          return volume >= HIGH_VOLUME_THRESHOLD; // >= 400
        case 'medium':
          return (
            volume >= MEDIUM_VOLUME_THRESHOLD && // >= 100
            volume < HIGH_VOLUME_THRESHOLD // < 400
          );
        case 'low':
          return volume < MEDIUM_VOLUME_THRESHOLD; // < 100
        default:
          return true; // 'all'
      }
    });

    const totalKeywords = filteredKeywords.length;
    const totalPages = Math.ceil(totalKeywords / ROWS_PER_PAGE);
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const keywordsForCurrentPage = filteredKeywords.slice(startIndex, endIndex);

    // Calculate max volume from *all* keywords
    const maxOverallVolume = Math.max(
      0,
      ...initialKeywords.map(kw => kw.searchVolume ?? 0)
    );

    return {
      keywordsForCurrentPage,
      totalPages,
      totalKeywords,
      maxOverallVolume
    };
  }, [initialKeywords, volumeFilter, currentPage]);

  // Handlers to update state
  const handleFilterChange = (newFilter: VolumeFilterType) => {
    setVolumeFilter(newFilter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Function to copy all unique keywords
  const handleCopyAll = useCallback(() => {
    if (!initialKeywords || initialKeywords.length === 0) return;

    // 1. Extract, trim, filter empty, and deduplicate
    const uniqueKeywords = Array.from(
      new Set(
        initialKeywords
          .map(kw => kw.text.replace(/\s+/g, '')) // Replace all whitespace
          .filter(text => text.length > 0) // Remove empty strings
      )
    );

    // 2. Join with newlines
    const keywordsString = uniqueKeywords.join('\n');

    // 3. Copy to clipboard
    navigator.clipboard.writeText(keywordsString).then(() => {
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset icon after 2 seconds
    }).catch(err => {
      console.error('Failed to copy keywords:', err);
      // Optionally: Show an error message to the user
    });
  }, [initialKeywords]); // Dependency: initialKeywords

  return (
    <div className="space-y-6">
      {/* Section 1: Filters and Actions */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <VolumeFilter
          keywords={initialKeywords} // Pass the full list for counts
          currentFilter={volumeFilter}
          onFilterChange={handleFilterChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAll}
          disabled={!initialKeywords || initialKeywords.length === 0 || isCopied}
        >
          {isCopied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              已複製！
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              複製所有關鍵字
            </>
          )}
        </Button>
      </div>

      {/* Section 3: Keywords Table */}
      <div className="md:col-span-1 space-y-3">
        {totalKeywords > 0 ? (
          <>
            <Table className="w-full">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-medium">關鍵字</TableHead>
                  <TableHead className="text-right pr-4 font-medium w-24">
                    月搜索量
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywordsForCurrentPage.map((kw, index) => {
                  const volume = kw.searchVolume ?? 0;
                  // Calculate bar width percentage using overall max
                  const barWidthPercent =
                    maxOverallVolume > 0
                      ? (volume / maxOverallVolume) * 100
                      : 0;

                  return (
                    // Remove relative positioning from the row
                    <TableRow key={`${kw.text}-${index}`}>
                      {/* Keyword Cell with Bar */}
                      <TableCell className="font-medium truncate pr-2 relative py-2.5">
                        {/* Background bar div (now inside the cell) */}
                        <div
                          className="absolute top-0 left-0 bottom-0 bg-blue-100/50 dark:bg-blue-900/30 -z-10"
                          style={{ width: `${barWidthPercent}%` }}
                          aria-hidden="true"
                        />
                        {/* Keyword text wrapper (relative position to stay above bar) */}
                        <span className="relative z-10">{kw.text}</span>
                      </TableCell>
                      {/* Volume Cell */}
                      <TableCell className="text-right pr-4 w-24 py-2.5">
                        {formatVolume(volume)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            {volumeFilter === 'all'
              ? '沒有找到關鍵字數據。'
              : '沒有找到符合當前條件的關鍵字。'}
          </p>
        )}
      </div>
    </div>
  );
}
