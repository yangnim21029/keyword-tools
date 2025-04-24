'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useMemo, useCallback, useState } from 'react';

import { SiteFavicon } from '@/components/ui/site-favicon';
import { requestDeleteKeywordResearch } from '@/app/actions';
import { MEDIASITE_DATA } from '@/app/global-config'; // Import media site data
import type { KeywordResearchSummaryItem } from '@/app/services/firebase/db-keyword-research';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatVolume } from '@/lib/utils';
import {
  Clock,
  RefreshCw,
  Sigma,
  Trash2,
  Loader2,
  AlertTriangle,
  CalendarDays
} from 'lucide-react';
import { toast } from 'sonner';

// 定義常量以提高可維護性
const COMPONENT_LOG_PREFIX = '[KeywordResearchList]';
const UI_STRINGS = {
  emptyState: '暫無研究記錄',
  deleteSuccess: '研究記錄已刪除',
  deleteError: '刪除研究記錄失敗'
};

interface KeywordResearchListProps {
  hideRefreshButton?: boolean;
  initialResearches: KeywordResearchSummaryItem[];
}

// --- Date Grouping Helper ---
const getRelativeDateGroup = (date: Date): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

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

export default function KeywordResearchList({
  hideRefreshButton = false,
  initialResearches = []
}: KeywordResearchListProps) {
  const router = useRouter();

  // Filter media sites based on language and region
  const getMatchingSites = useCallback((language?: string, region?: string) => {
    // Filter only by region now
    if (!region) return [];
    // Convert incoming region to lowercase for case-insensitive comparison
    const lowerCaseRegion = region.toLowerCase();
    console.log(`[getMatchingSites] Called with language: ${language}, region: ${region} (matching as ${lowerCaseRegion})`);
    return MEDIASITE_DATA.filter(
      site => site.region?.toLowerCase() === lowerCaseRegion
    );
  }, []);

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- Group Researches by Date using useMemo ---
  const groupedResearches = useMemo(() => {
    const groups = new Map<string, (KeywordResearchSummaryItem & { status?: 'pending' | 'completed' | 'failed' })[]>();
    // Sort researches by date descending first (might already be sorted)
    const sortedResearches = [...initialResearches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    sortedResearches.forEach(research => {
      // Ensure createdAt is valid before grouping
      let groupTitle = 'Invalid Date';
      try {
          const createdAtDate = new Date(research.createdAt);
          if (!isNaN(createdAtDate.getTime())) { // Check if date is valid
              groupTitle = getRelativeDateGroup(createdAtDate);
          }
      } catch { /* ignore error, keep default title */ }

      if (!groups.has(groupTitle)) {
        groups.set(groupTitle, []);
      }
      groups.get(groupTitle)?.push(research);
    });
    return groups;
  }, [initialResearches]); // Recalculate only if initialResearches changes

  // 處理刪除研究記錄
  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    researchId: string
  ) => {
    e.stopPropagation();
    e.preventDefault(); // Ensure link is not followed on delete
    if (deletingId) return;

    setDeletingId(researchId);
    try {
      console.log(
        `${COMPONENT_LOG_PREFIX} Calling requestDeleteKeywordResearch Server Action for ID:`,
        researchId
      );
      const result = await requestDeleteKeywordResearch(researchId);

      if (result.success) {
        console.log(`${COMPONENT_LOG_PREFIX} Server Action successful`);
        toast.success(UI_STRINGS.deleteSuccess);
        router.refresh(); // Re-fetches data, which updates initialResearches and triggers useMemo
      } else {
        throw new Error(result.error || UI_STRINGS.deleteError);
      }
    } catch (err) {
      console.error(
        `${COMPONENT_LOG_PREFIX} Error calling requestDeleteKeywordResearch Server Action:`,
        err
      );
      toast.error(err instanceof Error ? err.message : UI_STRINGS.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  // 刷新处理
  const handleRefresh = () => {
    console.log(
      `${COMPONENT_LOG_PREFIX} Manual refresh triggered with router.refresh()`
    );
    router.refresh();
  };

  // 渲染内容
  return (
    <div className="flex flex-col w-full max-w-full">
      {/* 刷新按钮 */}
      {!hideRefreshButton && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-foreground/50 hover:text-foreground self-end mb-2 mr-2"
          onClick={handleRefresh}
          aria-label="刷新研究記錄"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}

      {/* 内容区域 */}
      {initialResearches.length === 0 ? (
        <div className="text-center py-8 px-2">
          <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-muted-foreground">{UI_STRINGS.emptyState}</p>
        </div>
      ) : (
        // --- Waterfall Container --- 
        <div className="relative h-[65vh] overflow-y-auto pr-1"> {/* Add relative, height, overflow */}
           {/* Top Fade */} 
           <div className="sticky top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent pointer-events-none" />
           {/* Grouped List Content */}
          <div className="px-0 space-y-1"> {/* Adjusted spacing slightly */} 
            {Array.from(groupedResearches.entries()).map(([dateGroupTitle, researchesInGroup]) => (
              <div key={dateGroupTitle} className="mb-2 last:mb-0"> {/* Adjusted spacing */}
                {/* Date Group Header */} 
                 <h4 className="sticky top-6 z-10 bg-background/95 backdrop-blur-sm text-xs font-medium text-muted-foreground mb-1.5 pt-1 pb-1 px-3 flex items-center"> {/* Adjusted sticky top */}
                   <CalendarDays size={13} className="mr-1.5" />
                   {dateGroupTitle}
                 </h4>
                 {/* Items within the group */} 
                <div className='space-y-0'>
                  {researchesInGroup.map(research => {
                    const isPending = research.status === 'pending';
                    const isFailed = research.status === 'failed';
                    const isCompleted = !isPending && !isFailed;

                    return (
                      isCompleted ? (
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
                            <h3 className="text-base font-medium truncate"> {/* text-sm -> text-base */} 
                              {research.query}
                            </h3>
                          </div>
                          {/* Right Column */}
                          <div className="flex items-center flex-shrink-0 space-x-2">
                            {/* Volume - Increase text size */}
                            <div className="flex items-center text-base font-medium text-foreground/90"> {/* text-sm -> text-base */}
                              <Sigma size={14} className="mr-1 flex-shrink-0 text-muted-foreground" /> {/* Slightly larger icon */}
                              {formatVolume(research.totalVolume)}
                             </div>
                            {/* Delete Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-0", // Adjusted size slightly
                                "flex-shrink-0 text-muted-foreground hover:text-destructive",
                                "overflow-hidden group-hover:w-7",
                                "transition-all duration-200 ease-in-out"
                               )}
                              onClick={e => handleDelete(e, research.id)}
                              disabled={deletingId === research.id}
                              aria-label={`刪除研究記錄: ${research.query}`}
                            >
                             {deletingId === research.id ? (
                               <div className="h-3.5 w-3.5 border-t-2 border-b-2 border-destructive/50 rounded-full animate-spin"></div>
                             ) : (
                               <Trash2 className="h-4 w-4" />
                             )}
                            </Button>
                          </div>

                          {/* Hover Icons */}
                          <div className="absolute top-1 right-10 z-10 flex items-center gap-1.5 p-1 rounded-md bg-background/80 shadow-sm border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                            {(() => { // Use IIFE to calculate and log before mapping
                              const matchingSites = getMatchingSites(research.language, research.region);
                              // Log the region and the number of sites found for this item
                              console.log(`[Icon Match Debug] Research ID: ${research.id}, Region: ${research.region}, Matched Sites: ${matchingSites.length}`);
                              
                              // Return the elements to render
                              return (
                                <>
                                  {matchingSites.map(site => (
                                    <SiteFavicon key={site.name} siteName={site.name} siteUrl={site.url} />
                                  ))}
                                  {/* Show message if no sites match */} 
                                  {matchingSites.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic px-1">No matching sites</span> 
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
                            isPending && 'opacity-70 bg-muted/30 cursor-default', // Adjusted pending style
                            isFailed && 'bg-destructive/10 border-l-2 border-destructive cursor-default' // Adjusted failed style
                          )}
                        >
                           {/* Left Column - Increase text size */}
                           <div className="min-w-0 flex-1 overflow-hidden mr-4">
                            <h3 className="text-base font-medium truncate mb-1.5"> {/* text-sm -> text-base */} 
                               {research.query}
                             </h3>
                             {/* Metadata Row */}
                             <div className="flex items-center gap-x-2 text-xs">
                               <span className="flex items-center text-muted-foreground" title={formatDateTime(research.createdAt)}>
                                 <Clock size={12} className="mr-1 flex-shrink-0" />
                                 {formatDateTime(research.createdAt)}
                               </span>
                               {isPending && (
                                 <Badge variant="secondary" className="font-normal py-0.5 px-1.5 text-xs border border-primary/20">
                                   <Loader2 size={11} className="mr-1 animate-spin" />處 理 中...
                                 </Badge>
                               )}
                               {isFailed && (
                                 <Badge variant="destructive" className="font-normal py-0.5 px-1.5 text-xs">
                                   <AlertTriangle size={11} className="mr-1" />處理失敗
                                 </Badge>
                               )}
                             </div>
                          </div>
                          {/* Right Column */}
                          <div className="flex items-center flex-shrink-0 space-x-2">
                            {/* ... Placeholder ... */} 
                            {/* ... Disabled Delete Button ... */} 
                            <div className="flex items-center text-sm font-medium text-transparent">
                              <Sigma size={13} className="mr-0.5" />0
                             </div>
                             <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-6 w-6 flex-shrink-0 text-muted-foreground/50 transition-opacity duration-150", "cursor-not-allowed")}
                                onClick={e => {e.stopPropagation(); e.preventDefault();}}
                                disabled={true} 
                                aria-label={`刪除研究記錄: ${research.query}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                              </Button>
                          </div>
                        </div>
                      )
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
           {/* Bottom Fade */} 
           <div className="sticky bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
}
