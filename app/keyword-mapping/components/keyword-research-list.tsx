'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';

import type { KeywordResearchListItemWithTotalVolume } from '@/app/actions';
import { deleteKeywordResearch } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { formatVolume } from '@/lib/utils';
import { Clock, RefreshCw, Sigma, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
  initialResearches?: KeywordResearchListItemWithTotalVolume[];
}

export default function KeywordResearchList({
  hideRefreshButton = false,
  initialResearches = []
}: KeywordResearchListProps) {
  const router = useRouter();

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 處理研究記錄點擊 - Removed, will use Link instead
  // const handleResearchClick = (researchId: string) => {
  //   console.log(
  //     `${COMPONENT_LOG_PREFIX} Navigating to results page for ID:`,
  //     researchId
  //   );
  //   router.push(`/keyword-mapping/${researchId}`);
  // };

  // 處理刪除研究記錄 - Call Server Action directly and refresh
  const handleDelete = async (
    e: React.MouseEvent<HTMLButtonElement>,
    researchId: string
  ) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(researchId);
    try {
      console.log(
        `${COMPONENT_LOG_PREFIX} Calling deleteKeywordResearch Server Action for ID:`,
        researchId
      );
      const result = await deleteKeywordResearch(researchId);

      if (result.success) {
        console.log(`${COMPONENT_LOG_PREFIX} Server Action successful`);
        toast.success(UI_STRINGS.deleteSuccess);
        router.refresh();
      } else {
        throw new Error(result.error || UI_STRINGS.deleteError);
      }
    } catch (err) {
      console.error(
        `${COMPONENT_LOG_PREFIX} Error calling deleteKeywordResearch Server Action:`,
        err
      );
      toast.error(err instanceof Error ? err.message : UI_STRINGS.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  // 刷新处理 - Changed to use router.refresh()
  const handleRefresh = () => {
    console.log(
      `${COMPONENT_LOG_PREFIX} Manual refresh triggered with router.refresh()`
    );
    router.refresh();
  };

  // 渲染内容 - 简化为三个主要部分
  return (
    <div className="flex flex-col w-full max-w-full">
      {/* 1. 刷新按钮 - Keep hidden based on prop */}
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

      {/* 2. 内容区域 (空状态或研究列表) */}
      {initialResearches.length === 0 ? (
        // 空状态
        <div className="text-center py-8 px-2">
          <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-muted-foreground">{UI_STRINGS.emptyState}</p>
        </div>
      ) : (
        // 研究记录列表
        <div className="space-y-0 px-0">
          {initialResearches.map(research => {
            return (
              // Wrap the clickable area with Link
              <Link
                key={research.id}
                href={`/keyword-mapping/${research.id}`}
                className={`group py-2 px-2 cursor-pointer flex items-center max-w-full border-b border-border/50 last:border-b-0 rounded-sm hover:bg-accent/50`}
                // Remove onClick for navigation
              >
                {/* Query Text and Region */}
                <div className="min-w-0 flex-1 overflow-hidden mr-1.5 ml-1 flex items-baseline">
                  <h3
                    className={`text-sm leading-tight truncate font-medium mr-1.5`}
                  >
                    {research.query}
                  </h3>
                  {/* Display Region Code */}
                  {research.region && (
                    <span className="text-xs text-muted-foreground truncate flex-shrink-0">
                      ({research.region})
                    </span>
                  )}
                </div>

                {/* Total Volume (Right Aligned) */}
                {typeof research.totalVolume === 'number' && (
                  <div className="flex items-center text-xs text-muted-foreground mr-2 flex-shrink-0">
                    <Sigma size={12} className="mr-0.5" />
                    {formatVolume(research.totalVolume)}
                  </div>
                )}

                {/* Delete Button - Stop propagation to prevent Link navigation */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  onClick={e => {
                    e.preventDefault(); // Prevent Link navigation
                    e.stopPropagation(); // Stop propagation
                    handleDelete(e, research.id);
                  }}
                  disabled={deletingId === research.id}
                  aria-label={`刪除研究記錄: ${research.query}`}
                >
                  {deletingId === research.id ? (
                    <div className="h-3 w-3 border-t-2 border-b-2 border-destructive/50 rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
