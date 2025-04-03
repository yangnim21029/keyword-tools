"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTabStore } from "@/providers/TabProvider"
import { usePastQueryStore } from "@/store/pastQueryStore"
import { formatDistanceToNow } from "date-fns"
import { zhTW } from "date-fns/locale"
import { Clock, RefreshCw, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export default function KeywordHistoryList() {
  // --- 從 Zustand Store 讀取狀態 ---
  const { histories, loading, selectedHistoryId, lastHistorySaveTimestamp } = usePastQueryStore((store) => store.state)
  const { setSelectedHistoryId, deleteHistory, fetchHistories } = usePastQueryStore((store) => store.actions)
  const { setActiveTab } = useTabStore((store) => store.actions)
  const error = usePastQueryStore((state) => state.state.error)
  const quotaExceeded = Boolean(error?.includes("配額超出") || error?.includes("Quota exceeded"))

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // --- Ref to track processed timestamp ---
  const processedSaveTimestampRef = useRef<number | null>(null)

  // --- 初始加載 ---
  useEffect(() => {
    const dataFetchedRef = localStorage.getItem("historyDataFetched")

    if (histories.length === 0 && !loading && dataFetchedRef !== "true") {
      console.log("[KeywordHistoryList] Store 中無歷史記錄，觸發初始加載")
      localStorage.setItem("historyDataFetched", "true")

      setTimeout(() => {
        fetchHistories(false)
      }, 500)
    }
  }, [fetchHistories, histories.length, loading])

  // --- Add useEffect to listen for store timestamp changes ---
  useEffect(() => {
    if (lastHistorySaveTimestamp && lastHistorySaveTimestamp !== processedSaveTimestampRef.current) {
      console.log("[KeywordHistoryList] Detected history save via timestamp, refreshing list...")
      processedSaveTimestampRef.current = lastHistorySaveTimestamp
      fetchHistories(true)
    }
  }, [lastHistorySaveTimestamp, fetchHistories])

  // 處理歷史記錄點擊
  const handleHistoryClick = (historyId: string) => {
    setSelectedHistoryId(historyId)
    // 切換到關鍵詞工具標籤
    setActiveTab("keyword")
  }

  // 處理刪除歷史記錄
  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, historyId: string) => {
    e.stopPropagation()
    if (deletingId) return

    setDeletingId(historyId)
    try {
      console.log("[SearchHistory] 準備刪除歷史記錄 ID:", historyId)
      await deleteHistory(historyId)
      console.log("[SearchHistory] deleteHistory Action 調用完成")
      toast.success("歷史記錄已刪除")
    } catch (err) {
      console.error("[SearchHistory] 刪除歷史記錄過程中捕獲到錯誤:", err)
      toast.error("刪除歷史記錄失敗")
    } finally {
      setDeletingId(null)
    }
  }

  // 刷新处理
  const handleRefresh = () => {
    if (loading) return
    console.log("[KeywordHistoryList] 手動觸發刷新")
    fetchHistories(true)
  }

  // Header with refresh button
  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">搜索歷史</h2>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleRefresh} disabled={loading}>
        {loading ? (
          <div className="h-4 w-4 border-t-2 border-b-2 border-gray-400 rounded-full animate-spin"></div>
        ) : (
          <RefreshCw className="h-4 w-4 text-gray-500 dark:text-gray-400" />
        )}
      </Button>
    </div>
  )

  // 渲染加載狀態
  if (loading && histories.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {renderHeader()}
        <div className="p-3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 渲染空狀態
  if (!loading && histories.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <Clock className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
            <p>暫無歷史記錄</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {histories.map((history) => {
            const isSelected = history.id === selectedHistoryId
            const timeAgo = formatDistanceToNow(new Date(history.timestamp), {
              addSuffix: true,
              locale: zhTW,
            })

            return (
              <div
                key={history.id}
                className={`
                  p-2 rounded-md cursor-pointer transition-all flex items-center gap-2
                  ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500 dark:border-blue-400"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-2 border-transparent"
                  }
                `}
                onClick={() => handleHistoryClick(history.id)}
              >
                <div className="flex-1 min-w-0">
                  <h3
                    className={`truncate text-sm ${
                      isSelected
                        ? "font-medium text-blue-700 dark:text-blue-400"
                        : "font-normal text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {history.mainKeyword}
                  </h3>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span className="truncate">{timeAgo}</span>
                    <span className="mx-1.5">•</span>
                    <span>{history.suggestionCount}個</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                  onClick={(e) => handleDelete(e, history.id)}
                >
                  {deletingId === history.id ? (
                    <div className="h-3 w-3 border-t-2 border-b-2 border-red-500 rounded-full animate-spin"></div>
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

