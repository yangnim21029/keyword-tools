'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';

import { deleteKeywordResearch } from '@/app/actions';
import type { KeywordResearchSummaryItem } from '@/app/services/firebase/db-keyword-research';
import { Button } from '@/components/ui/button';
import { formatVolume } from '@/lib/utils';
import {
  Clock,
  Globe,
  Languages,
  RefreshCw,
  Sigma,
  Trash2
} from 'lucide-react';
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
  initialResearches: KeywordResearchSummaryItem[];
}

// Helper to format date/time nicely (Consider moving to utils if used elsewhere)
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

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        <div className="space-y-0 px-0">
          {initialResearches.map(research => (
            <Link
              key={research.id}
              href={`/keyword-mapping/${research.id}`}
              className={`group py-3 px-3 cursor-pointer flex flex-col sm:flex-row sm:items-center max-w-full border-b border-border/50 last:border-b-0 rounded-sm hover:bg-accent/50 transition-colors duration-150`}
            >
              {/* Left Side: Query and Details */}
              <div className="min-w-0 flex-1 overflow-hidden mb-2 sm:mb-0 sm:mr-4">
                <h3 className="text-sm font-medium truncate mb-1">
                  {research.query}
                </h3>
                <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                  <span className="flex items-center">
                    <Clock size={12} className="mr-1 flex-shrink-0" />
                    {formatDateTime(research.createdAt)}
                  </span>
                  {research.region && (
                    <span className="flex items-center">
                      <Globe size={12} className="mr-1 flex-shrink-0" />
                      {research.region}
                    </span>
                  )}
                  {research.language && (
                    <span className="flex items-center">
                      <Languages size={12} className="mr-1 flex-shrink-0" />
                      {research.language}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Side: Volume and Delete Button */}
              <div className="flex items-center justify-end sm:justify-normal flex-shrink-0">
                {/* Total Volume */}
                <div className="flex items-center text-xs text-muted-foreground mr-2">
                  <Sigma size={12} className="mr-0.5 flex-shrink-0" />
                  {formatVolume(research.totalVolume)}
                </div>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  onClick={e => handleDelete(e, research.id)}
                  disabled={deletingId === research.id}
                  aria-label={`刪除研究記錄: ${research.query}`}
                >
                  {deletingId === research.id ? (
                    <div className="h-3 w-3 border-t-2 border-b-2 border-destructive/50 rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
