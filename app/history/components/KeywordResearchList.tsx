"use client"

import type React from "react"
import { useRouter } from 'next/navigation';

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ResearchStore } from "@/store/keywordResearchStore"
import { useResearchStore } from "@/store/keywordResearchStore"
import { Clock, FileText, RefreshCw, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { KeywordResearchListItem } from "@/app/types";

// 定義常量以提高可維護性
const COMPONENT_LOG_PREFIX = "[KeywordResearchList]"
const UI_STRINGS = {
  emptyState: "暫無研究記錄",
  deleteSuccess: "研究記錄已刪除",
  deleteError: "刪除研究記錄失敗",
}

interface KeywordResearchListProps {
  hideRefreshButton?: boolean;
  initialResearches?: KeywordResearchListItem[];
}

export default function KeywordResearchList({ 
  hideRefreshButton = false,
  initialResearches = []
}: KeywordResearchListProps) {
  const router = useRouter();

  // --- 從 Zustand Store 讀取狀態 ---
  const researches = useResearchStore((store: ResearchStore) => store.state.researches)
  const loading = useResearchStore((store: ResearchStore) => store.state.loading)
  const selectedResearchId = useResearchStore((store: ResearchStore) => store.state.selectedResearchId)
  const {
    deleteResearch,
    fetchResearches,
    _handleResearchSavedOrUpdated,
  } = useResearchStore((store: ResearchStore) => store.actions)

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Demand: Load initial research list on component mount.
  useEffect(() => {
    console.log(`${COMPONENT_LOG_PREFIX} useEffect hook fired.`);
    // Check if researches are already loaded to avoid unnecessary fetches
    if (!researches || researches.length === 0) {
        console.log(`${COMPONENT_LOG_PREFIX} Researches not loaded, using initialResearches or fetching...`);
        if (initialResearches.length > 0) {
          // Initialize store with server-fetched data
          initialResearches.forEach(research => {
            _handleResearchSavedOrUpdated(research);
          });
        } else {
          fetchResearches(); // Call without forceRefresh initially
        }
    } else {
        console.log(`${COMPONENT_LOG_PREFIX} Researches already loaded (${researches.length} items), skipping initial fetch.`);
    }
  }, [fetchResearches, initialResearches, _handleResearchSavedOrUpdated]);

  // Demand: Automatically refresh list when new research is saved (via 'researchSaved' event).
  useEffect(() => {
    const handleResearchSaved = (event: Event) => {
      console.log(`${COMPONENT_LOG_PREFIX} 檢測到研究記錄通過事件保存，刷新列表...`, (event as CustomEvent).detail);
      fetchResearches(true); // 刷新列表
    };

    console.log(`${COMPONENT_LOG_PREFIX} 添加 researchSaved 事件監聽器`);
    window.addEventListener('researchSaved', handleResearchSaved);

    // 清理函數
    return () => {
      console.log(`${COMPONENT_LOG_PREFIX} 移除 researchSaved 事件監聽器`);
      window.removeEventListener('researchSaved', handleResearchSaved);
    };
  }, [fetchResearches]); // 依賴 fetchResearches 以確保其穩定性

  // 處理研究記錄點擊 - Updated to use router
  const handleResearchClick = (researchId: string) => {
    console.log(`${COMPONENT_LOG_PREFIX} Navigating to results page for ID:`, researchId);
    router.push(`/tools/keyword/${researchId}`);
  }

  // 處理刪除研究記錄
  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, researchId: string) => {
    e.stopPropagation()
    if (deletingId) return

    setDeletingId(researchId)
    try {
      console.log(`${COMPONENT_LOG_PREFIX} 準備刪除研究記錄 ID:`, researchId)
      await deleteResearch(researchId)
      console.log(`${COMPONENT_LOG_PREFIX} deleteResearch Action 調用完成`)
      toast.success(UI_STRINGS.deleteSuccess)
    } catch (err) {
      console.error(`${COMPONENT_LOG_PREFIX} 刪除研究記錄過程中捕獲到錯誤:`, err)
      toast.error(UI_STRINGS.deleteError)
    } finally {
      setDeletingId(null)
    }
  }

  // 刷新处理
  const handleRefresh = () => {
    if (loading) return
    console.log(`${COMPONENT_LOG_PREFIX} 手動觸發刷新`)
    fetchResearches(true)
  }

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
          disabled={loading}
          aria-label="刷新研究記錄"
        >
          {loading ? (
            <div className="h-4 w-4 border-t-2 border-b-2 border-primary/30 rounded-full animate-spin"></div>
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* 2. 内容区域 (加载状态、空状态或研究列表) */}
      {loading && researches.length === 0 ? (
        // 加载状态
        <div className="px-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-1.5 flex items-center gap-2 w-full opacity-60">
              <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : researches.length === 0 ? (
        // 空状态
        <div className="text-center py-8 px-2">
          <Clock className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-muted-foreground">{UI_STRINGS.emptyState}</p>
        </div>
      ) : (
        // 研究记录列表 - 进一步简化嵌套结构，减少内部间距
        <div className="space-y-0 px-0">
          {researches.map((research) => {
            const isSelected = research.id === selectedResearchId

            return (
              <div 
                key={research.id}
                className={`group py-2 px-2 cursor-pointer flex items-center max-w-full border-b border-border/50 last:border-b-0 rounded-sm ${ 
                  isSelected 
                  ? 'bg-muted font-semibold'
                  : 'hover:bg-accent/50'
                }`}
                onClick={() => handleResearchClick(research.id)}
              >
                {/* 内容区域最小宽度0，确保可以被压缩 - Give it slightly more margin since icon is removed */}
                <div className="min-w-0 flex-1 overflow-hidden mr-1.5 ml-1"> 
                  <h3 className={`text-base leading-tight truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {research.query}
                  </h3>
                </div>
                
                {/* 删除按钮 - Hide by default, show on group-hover */}
                <Button
                  variant="ghost"
                  size="icon"
                  // Apply group-hover visibility and default opacity-0
                  className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  onClick={(e) => handleDelete(e, research.id)}
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
            )
          })}
        </div>
      )}
    </div>
  )
} 