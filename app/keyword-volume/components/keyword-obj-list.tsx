// import Link from 'next/link';
// import { useCallback, useMemo } from 'react';

import Link from 'next/link';

import { DeleteKeywordVolumeButton } from '@/app/actions/actions-buttons';
import { MEDIASITE_DATA } from '@/app/global-config'; // Import media site data
import { KeywordVolumeListItem } from '@/app/services/firebase/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { cn, formatVolume } from '@/lib/utils';
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Loader2,
  Sigma,
  Trash2
} from 'lucide-react';

// --- Date Grouping Helper ---
const getRelativeDateGroup = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const inputDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  if (inputDate.getTime() === today.getTime()) {
    return '今天'; // Today
  }
  if (inputDate.getTime() === yesterday.getTime()) {
    return '昨天'; // Yesterday
  }
  // Format as YYYY/MM/DD for older dates
  return inputDate.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// --- Formatter ---
const formatDateTime = (date: Date | string | undefined): string => {
  if (!date) return 'N/A';
  try {
    return new Date(date).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
};

// Helper function for matching sites (moved outside component, no useCallback needed)
const getMatchingSites = (language?: string, region?: string) => {
  // Filter only by region now
  if (!region) return [];
  // Convert incoming region to lowercase for case-insensitive comparison
  const lowerCaseRegion = region.toLowerCase();
  // console.log( // Remove console.log or adapt for server-side logging if needed
  //   `[getMatchingSites] Called with language: ${language}, region: ${region} (matching as ${lowerCaseRegion})`
  // );
  return MEDIASITE_DATA.filter(
    site => site.region?.toLowerCase() === lowerCaseRegion
  );
};

export default function KeywordVolumeObjectList({
  keywordVolumeObjectList
}: {
  keywordVolumeObjectList: KeywordVolumeListItem[];
}) {
  // --- Group Researches by Date (Directly calculate, no useMemo) ---
  const groupedResearches = (() => {
    // Use IIFE to scope calculation
    const groups = new Map<
      string,
      (KeywordVolumeListItem & {
        status?: 'pending' | 'completed' | 'failed';
      })[]
    >();
    // Sort researches by date descending first (might already be sorted)
    const sortedResearches = [...keywordVolumeObjectList].sort(
      (a, b) =>
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) - // Add null check
        (a.createdAt ? new Date(a.createdAt).getTime() : 0) // Add null check
    );

    sortedResearches.forEach(research => {
      // Ensure createdAt is valid before grouping
      let groupTitle = 'Invalid Date';
      try {
        // Add check for research.createdAt existence
        if (research.createdAt) {
          const createdAtDate = new Date(research.createdAt);
          if (!isNaN(createdAtDate.getTime())) {
            // Check if date is valid
            groupTitle = getRelativeDateGroup(createdAtDate);
          }
        }
      } catch {
        /* ignore error, keep default title */
      }

      if (!groups.has(groupTitle)) {
        groups.set(groupTitle, []);
      }
      groups.get(groupTitle)?.push(research);
    });
    return groups;
  })(); // Immediately invoke

  // 渲染内容
  return (
    <div className="flex flex-col w-full max-w-full">
      {/* 内容区域 */}
      {keywordVolumeObjectList.length === 0 ? (
        <div className="text-center py-8 px-2">
          <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-muted-foreground">{'暫無研究記錄'}</p>
        </div>
      ) : (
        // --- Waterfall Container ---
        <div className="relative h-[65vh] overflow-y-auto pr-1">
          {' '}
          {/* Add relative, height, overflow */}
          {/* Top Fade */}
          <div className="sticky top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none" />
          {/* Grouped List Content */}
          <div className="px-0 space-y-1">
            {' '}
            {/* Adjusted spacing slightly */}
            {Array.from(groupedResearches.entries()).map(
              ([dateGroupTitle, researchesInGroup]) => (
                <div key={dateGroupTitle} className="mb-2 last:mb-0">
                  {' '}
                  {/* Adjusted spacing */}
                  {/* Date Group Header */}
                  <h4 className="sticky top-6 z-10 bg-background/95 backdrop-blur-sm text-xs font-medium text-muted-foreground mb-1.5 pt-1 pb-1 px-3 flex items-center">
                    {' '}
                    {/* Adjusted sticky top */}
                    <CalendarDays size={13} className="mr-1.5" />
                    {dateGroupTitle}
                  </h4>
                  {/* Items within the group */}
                  <div className="space-y-0">
                    {researchesInGroup.map(research => {
                      const isPending = research.status === 'pending';
                      const isFailed = research.status === 'failed';
                      const isCompleted = !isPending && !isFailed;

                      return isCompleted ? (
                        <Link
                          key={research.id}
                          href={`/keyword-mapping/${research.id}`}
                          className={cn(
                            `relative group flex items-center justify-between py-2.5 pb-3 px-3 max-w-full border-b border-border/40 last:border-b-0 rounded-sm transition-colors duration-150`,
                            'cursor-pointer hover:bg-accent/50'
                          )}
                        >
                          {/* Left Column - Increase text size */}
                          <div className="min-w-0 flex-1 overflow-hidden mr-4">
                            <h3 className="text-base font-medium truncate">
                              {' '}
                              {/* text-sm -> text-base */}
                              {/* Display Region before Query */}
                              {research.region && (
                                <span className="text-xs font-normal text-muted-foreground mr-1.5 px-1 py-0.5 bg-muted rounded-sm">
                                  {research.region.toUpperCase()}
                                </span>
                              )}
                              {research.query}
                            </h3>
                          </div>
                          {/* Right Column */}
                          <div className="flex items-center flex-shrink-0 space-x-2">
                            {/* Volume - Increase text size */}
                            <div className="flex items-center text-base font-medium text-foreground/90">
                              {' '}
                              {/* text-sm -> text-base */}
                              <Sigma
                                size={14}
                                className="mr-1 flex-shrink-0 text-muted-foreground"
                              />{' '}
                              {/* Slightly larger icon */}
                              {formatVolume(research.totalVolume)}
                            </div>
                            {/* Delete Button - Replace with new component */}
                            <DeleteKeywordVolumeButton
                              researchId={research.id!}
                              ariaLabel={`刪除研究記錄: ${research.query}`}
                              className={cn(
                                'h-7 w-0 p-0', // Ensure padding is zero
                                'overflow-hidden group-hover:w-7', // Show on hover
                                'transition-all duration-200 ease-in-out' // Animation
                              )}
                              variant="ghost"
                              size="sm"
                            />
                          </div>

                          {/* Hover Icons */}
                          <div className="absolute top-1 right-10 z-10 flex items-center gap-1.5 p-1 rounded-md bg-background/80 shadow-sm border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                            {(() => {
                              // Use IIFE to calculate and log before mapping
                              const matchingSites = getMatchingSites(
                                research.language,
                                research.region
                              );
                              // Log the region and the number of sites found for this item
                              // console.log( // Remove console log or adapt for server
                              //   `[Icon Match Debug] Research ID: ${research.id}, Region: ${research.region}, Matched Sites: ${matchingSites.length}`
                              // );

                              // Return the elements to render
                              return (
                                <>
                                  {matchingSites.map(site => (
                                    <SiteFavicon
                                      key={site.name}
                                      siteName={site.name}
                                      siteUrl={site.url}
                                    />
                                  ))}
                                  {/* Show message if no sites match */}
                                  {matchingSites.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic px-1">
                                      No matching sites
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </Link>
                      ) : (
                        // --- Pending/Failed Item Layout ---
                        <div
                          key={research.id}
                          className={cn(
                            `group flex items-center justify-between py-2.5 px-3 max-w-full border-b border-border/50 last:border-b-0 rounded-sm transition-colors duration-150`,
                            isPending &&
                              'opacity-70 bg-muted/30 cursor-default', // Adjusted pending style
                            isFailed &&
                              'bg-destructive/10 border-l-2 border-destructive cursor-default' // Adjusted failed style
                          )}
                        >
                          {/* Left Column - Increase text size */}
                          <div className="min-w-0 flex-1 overflow-hidden mr-4">
                            <h3 className="text-base font-medium truncate mb-1.5">
                              {' '}
                              {/* text-sm -> text-base */}
                              {/* Display Region before Query */}
                              {research.region && (
                                <span className="text-xs font-normal text-muted-foreground mr-1.5 px-1 py-0.5 bg-muted rounded-sm">
                                  {research.region.toUpperCase()}
                                </span>
                              )}
                              {research.query}
                            </h3>
                            {/* Metadata Row */}
                            <div className="flex items-center gap-x-2 text-xs">
                              <span
                                className="flex items-center text-muted-foreground"
                                title={formatDateTime(research.createdAt)}
                              >
                                <Clock
                                  size={12}
                                  className="mr-1 flex-shrink-0"
                                />
                                {formatDateTime(research.createdAt)}
                              </span>
                              {isPending && (
                                <Badge
                                  variant="secondary"
                                  className="font-normal py-0.5 px-1.5 text-xs border border-primary/20"
                                >
                                  <Loader2
                                    size={11}
                                    className="mr-1 animate-spin"
                                  />
                                  處 理 中...
                                </Badge>
                              )}
                              {isFailed && (
                                <Badge
                                  variant="destructive"
                                  className="font-normal py-0.5 px-1.5 text-xs"
                                >
                                  <AlertTriangle size={11} className="mr-1" />
                                  處理失敗
                                </Badge>
                              )}
                            </div>
                          </div>
                          {/* Right Column */}
                          <div className="flex items-center flex-shrink-0 space-x-2">
                            {/* Placeholder Volume */}
                            <div className="flex items-center text-sm font-medium text-transparent">
                              <Sigma size={13} className="mr-0.5" />0
                            </div>
                            {/* Use a disabled Button for placeholder */}
                            <Button
                              variant="ghost"
                              size="icon" // Use 'icon' size for Button if available
                              className={cn(
                                'h-7 w-7 flex-shrink-0',
                                'text-muted-foreground/50 cursor-not-allowed p-0'
                              )}
                              disabled={true}
                              aria-label={`刪除研究記錄: ${research.query} (進行中/失敗)`}
                              // remove onClick for server component
                              /*
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              */
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground/50" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
          {/* Bottom Fade */}
          <div className="sticky bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
}
