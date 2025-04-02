'use client';

import { useTabStore } from '@/providers/TabProvider';
import { usePastQueryStore } from '@/store/pastQueryStore'; // 導入 Zustand Hook
import { formatDistanceToNow } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { Clock, Trash2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { SearchHistoryHeader } from './SearchHistoryHeader';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Skeleton } from '@/components/ui/skeleton';

// 搜索历史组件的属性 - onSelectHistory 可能不再需要傳遞 data，因為詳情由 Store 加載
interface KeywordHistoryListProps {
  onSelectHistory?: (historyId: string) => void; // 改為只通知選擇的 ID，或完全移除
  searchFilter?: string;
  isRefreshing?: boolean; // 仍然可以保留，讓父元件觸發刷新
}

export default function KeywordHistoryList({ onSelectHistory, searchFilter = '', isRefreshing = false }: KeywordHistoryListProps) {
  // --- 從 Zustand Store 讀取狀態 ---
  const { histories, loading, selectedHistoryId, lastHistorySaveTimestamp } = usePastQueryStore(store => store.state);
  const { setSelectedHistoryId, deleteHistory, fetchHistories } = usePastQueryStore(store => store.actions);
  const { setActiveTab } = useTabStore(store => store.actions);
  const error = usePastQueryStore((state) => state.state.error);
  const quotaExceeded = Boolean(error?.includes('配額超出') || error?.includes('Quota exceeded')); // 使用Boolean()明確轉換

  // --- 從 Zustand Store 讀取 Actions ---
  // const historyActions = usePastQueryStore((state) => state.actions);

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // --- Ref to track processed timestamp --- 
  const processedSaveTimestampRef = useRef<number | null>(null);

  // --- 初始加載 (如果 Store Provider 不自動加載) ---
  // 通常 Provider 會在初始化時加載，或者父元件觸發
  // 如果需要確保這裡加載，可以保留一個簡化的 useEffect
  useEffect(() => {
    // 添加一個標記，避免重複觸發
    const dataFetchedRef = localStorage.getItem('historyDataFetched');
    
    // 檢查是否已有數據，避免不必要的重複加載
    if (histories.length === 0 && !loading && dataFetchedRef !== 'true') {
       console.log('[KeywordHistoryList] Store 中無歷史記錄，觸發初始加載');
       
       // 設置標記防止重複觸發
       localStorage.setItem('historyDataFetched', 'true');
       
       // 延遲執行，避免在渲染過程中觸發
       setTimeout(() => {
         fetchHistories(false); // 初始加載可能不需要強制刷新
       }, 500);
    }
  }, [fetchHistories, histories.length, loading]); // 只在組件掛載時執行一次

  // 監聽外部刷新狀態
  useEffect(() => {
    if (isRefreshing && !loading) {
      console.log('[KeywordHistoryList] 外部觸發刷新 (prop)');
      fetchHistories(true); // 強制刷新
    }
  }, [isRefreshing, fetchHistories, loading]); // 添加依賴項

  // --- Add useEffect to listen for store timestamp changes --- 
  useEffect(() => {
    if (
      lastHistorySaveTimestamp && 
      lastHistorySaveTimestamp !== processedSaveTimestampRef.current
    ) {
      console.log('[KeywordHistoryList] Detected history save via timestamp, refreshing list...');
      processedSaveTimestampRef.current = lastHistorySaveTimestamp;
      fetchHistories(true); // Force refresh the list
    }
  }, [lastHistorySaveTimestamp, fetchHistories]); // Add dependencies

  // 處理歷史記錄點擊
  const handleHistoryClick = (historyId: string) => {
    setSelectedHistoryId(historyId);
    // 切換到關鍵詞工具標籤
    setActiveTab('keyword');
  };

  // 處理刪除歷史記錄
  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>, historyId: string) => {
    e.stopPropagation();
    if (deletingId) return;

    setDeletingId(historyId); // 仍然設置本地狀態以顯示刪除中的 UI
    try {
       console.log('[SearchHistory] 準備刪除歷史記錄 ID:', historyId);
      // 調用 Store action，它內部會處理 API 調用和狀態更新
      await deleteHistory(historyId);
       console.log('[SearchHistory] deleteHistory Action 調用完成');
      // 刪除成功後，Store 會自動更新 histories 列表，無需手動 setHistoryList
      toast.success('歷史記錄已刪除');
    } catch (err) {
      // Store action 內部已經有 toast 處理，這裡可以只 log
      console.error('[SearchHistory] 刪除歷史記錄過程中捕獲到錯誤 (可能已被 toast 處理):', err);
      toast.error('刪除歷史記錄失敗');
    } finally {
      setDeletingId(null);
    }
  };

  // 刷新处理 - 調用 Store Action
  const handleRefresh = () => {
    if (loading) return;
    console.log('[KeywordHistoryList] 手動觸發刷新');
    fetchHistories(true); // Store Action 會處理加載狀態
  };

  // 過濾歷史記錄列表 - 從 Store 讀取的數據進行過濾
  const filteredHistoryList = searchFilter
    ? histories.filter(item =>
        item.mainKeyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (item.region && item.region.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (item.language && item.language.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : histories;

   console.log('[SearchHistory] 渲染 - loading:', loading, 'error:', error, 'selectedId:', selectedHistoryId, 'filteredList count:', filteredHistoryList.length);

  // 渲染歷史記錄項目
  const renderHistoryItem = (history: any) => {
    const isSelected = history.id === selectedHistoryId;
    const timeAgo = formatDistanceToNow(new Date(history.timestamp), { 
      addSuffix: true,
      locale: zhTW 
    });

    return (
      <div
        key={history.id}
        className={`
          p-4 rounded-lg cursor-pointer transition-all
          ${isSelected 
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent hover:border-gray-100 dark:hover:border-gray-700/50'
          }
        `}
        onClick={() => handleHistoryClick(history.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {history.mainKeyword}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <Clock className="h-3 w-3" />
              <span>{timeAgo}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
            onClick={(e) => handleDelete(e, history.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>{history.suggestionCount} 個建議</span>
          <span>{history.resultsCount} 個結果</span>
          {history.clustersCount > 0 && (
            <span>{history.clustersCount} 個分群</span>
          )}
        </div>
      </div>
    );
  };

  // 渲染加載狀態
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-start mb-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 渲染空狀態
  if (!loading && histories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        暫無歷史記錄
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SearchHistoryHeader
        isLoading={loading && deletingId === null}
        // 可以考慮從 store 獲取刷新 action 傳遞給 Header
        // onRefresh={handleRefresh}
      />

      <div className="flex-grow overflow-auto">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="space-y-4 p-4">
            {filteredHistoryList.map(renderHistoryItem)}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
} 