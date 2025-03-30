'use client';

import { Skeleton } from "@/components/ui/skeleton";
import { HistoryListItem } from "@/lib/schemas"; // 修正引入路徑
import { AlertTriangle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchHistoryListItem } from "./SearchHistoryListItem"; // Import list item component

// 設置最大緩存記錄數
const MAX_CACHE_ENTRIES = 10;

interface SearchHistoryListProps {
  isLoading: boolean;
  historyList: HistoryListItem[]; // 修正類型引用
  error: string | null;
  quotaExceeded: boolean;
  selectedHistoryId: string | null;
  deletingId: string | null;
  onSelectHistory: (id: string) => void;
  onDeleteHistory: (id: string, event: React.MouseEvent) => void;
  onRefreshHistory?: () => void; // 重新整理函數
}

// 用於緩存的歷史記錄映射
let historyCache: Record<string, any> = {};

export function SearchHistoryList({
  isLoading,
  historyList,
  error,
  quotaExceeded,
  selectedHistoryId,
  deletingId,
  onSelectHistory,
  onDeleteHistory,
  onRefreshHistory
}: SearchHistoryListProps) {
  const [refreshing, setRefreshing] = useState(false);

  // 當歷史列表更新時，維護緩存大小
  useEffect(() => {
    // 限制緩存大小，當超過最大緩存數時，移除最早加入的項目
    const cacheKeys = Object.keys(historyCache);
    if (cacheKeys.length > MAX_CACHE_ENTRIES) {
      const keysToRemove = cacheKeys.slice(0, cacheKeys.length - MAX_CACHE_ENTRIES);
      keysToRemove.forEach(key => delete historyCache[key]);
      console.log(`清理緩存: 移除了 ${keysToRemove.length} 個舊記錄`);
    }
  }, [historyList]);

  // 點擊選擇歷史記錄時，使用緩存機制
  const handleSelectWithCache = (id: string) => {
    // 嘗試從緩存中取數據
    if (historyCache[id]) {
      console.log('使用緩存的歷史記錄:', id);
    } else {
      // 若緩存中沒有，則在選擇後將數據添加到緩存
      const selectedHistory = historyList.find(item => item.id === id);
      if (selectedHistory) {
        historyCache[id] = selectedHistory;
        console.log('將歷史記錄添加到緩存:', id);
      }
    }
    // 調用原始選擇函數
    onSelectHistory(id);
  };

  // 手動重新整理歷史列表
  const handleRefresh = () => {
    if (onRefreshHistory) {
      setRefreshing(true);
      // 清空緩存
      historyCache = {};
      console.log('重新整理: 清空歷史記錄緩存');
      onRefreshHistory();
      setTimeout(() => setRefreshing(false), 1000); // 顯示加載動畫至少1秒
    }
  };

  // Loading State (Initial Load)
  if (isLoading && historyList.length === 0) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col space-y-2 p-2">
            <Skeleton className="h-4 w-4/5 bg-gray-100 dark:bg-gray-700" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-1/3 bg-gray-100 dark:bg-gray-700" />
              <Skeleton className="h-3 w-1/3 bg-gray-100 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Quota Exceeded State
  if (quotaExceeded) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-3 rounded-r-md shadow-sm">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 shrink-0" />
            <div className="ml-2">
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Firebase 配額已用盡，歷史記錄功能暫時不可用。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error State (excluding quota error)
  if (error && !quotaExceeded) {
    return <div className="p-4 text-sm text-red-500 dark:text-red-400">{error}</div>;
  }

  // Empty State
  if (!isLoading && historyList.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
        <Search className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">尚無搜索歷史記錄</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">您的搜索歷史將顯示在此處</p>
      </div>
    );
  }

  // Data Loaded State
  return (
    <div className="py-2 px-2.5">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          歷史記錄 ({historyList.length})
        </h3>
      </div>
      {historyList
        .filter(item => 
          // 過濾掉無效的歷史記錄項目
          item && 
          item.id && 
          item.mainKeyword && 
          item.region && 
          item.language
        )
        .map((item) => (
          <SearchHistoryListItem
            key={item.id}
            item={item}
            isSelected={selectedHistoryId === item.id}
            isDeleting={deletingId === item.id}
            onSelect={handleSelectWithCache}
            onDelete={onDeleteHistory}
          />
      ))}
    </div>
  );
} 