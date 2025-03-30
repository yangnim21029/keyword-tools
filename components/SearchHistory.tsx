'use client';

import { useHistoryStore } from '@/store/historyStore'; // 導入 Zustand Hook
import { useEffect, useState } from 'react';
import { SearchHistoryHeader } from './search-history/SearchHistoryHeader';
import { SearchHistoryList } from './search-history/SearchHistoryList';

// 搜索历史组件的属性 - onSelectHistory 可能不再需要傳遞 data，因為詳情由 Store 加載
interface SearchHistoryProps {
  onSelectHistory?: (historyId: string) => void; // 改為只通知選擇的 ID，或完全移除
  searchFilter?: string;
  isRefreshing?: boolean; // 仍然可以保留，讓父元件觸發刷新
}

export default function SearchHistory({ onSelectHistory, searchFilter = '', isRefreshing = false }: SearchHistoryProps) {
  // --- 從 Zustand Store 讀取狀態 ---
  const histories = useHistoryStore((state) => state.state.histories);
  const loading = useHistoryStore((state) => state.state.loading);
  const error = useHistoryStore((state) => state.state.error);
  const selectedHistoryId = useHistoryStore((state) => state.state.selectedHistoryId);
  const quotaExceeded = Boolean(error?.includes('配額超出') || error?.includes('Quota exceeded')); // 使用Boolean()明確轉換

  // --- 從 Zustand Store 讀取 Actions ---
  const historyActions = useHistoryStore((state) => state.actions);

  // --- 本地狀態只保留刪除中的 ID ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- 初始加載 (如果 Store Provider 不自動加載) ---
  // 通常 Provider 會在初始化時加載，或者父元件觸發
  // 如果需要確保這裡加載，可以保留一個簡化的 useEffect
  useEffect(() => {
    // 檢查是否已有數據，避免不必要的重複加載
    if (histories.length === 0 && !loading) {
       console.log('[SearchHistory] Store 中無歷史記錄，觸發初始加載');
       historyActions.fetchHistories(false); // 初始加載可能不需要強制刷新
    }
  }, [historyActions, histories.length, loading]); // 添加依賴項

  // 監聽外部刷新狀態
  useEffect(() => {
    if (isRefreshing && !loading) {
      console.log('[SearchHistory] 外部觸發刷新');
      historyActions.fetchHistories(true); // 強制刷新
    }
  }, [isRefreshing, historyActions, loading]); // 添加依賴項

  // 处理选择历史记录 - 現在只調用 Store Action
  const handleSelectHistory = (historyId: string) => {
    if (selectedHistoryId === historyId) return; // 如果已選中，則不重複操作
    console.log('[SearchHistory] 選擇歷史記錄 ID:', historyId);
    historyActions.setSelectedHistoryId(historyId); // Store Action 會處理詳情加載
    // 可選：如果父組件仍需要知道選擇了哪個 ID
    if (onSelectHistory) {
      onSelectHistory(historyId);
    }
  };

  // 處理刪除歷史記錄 - 現在只調用 Store Action
  const handleDeleteHistory = async (historyId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (deletingId) return;

    setDeletingId(historyId); // 仍然設置本地狀態以顯示刪除中的 UI
    try {
       console.log('[SearchHistory] 準備刪除歷史記錄 ID:', historyId);
      // 調用 Store action，它內部會處理 API 調用和狀態更新
      await historyActions.deleteHistory(historyId);
       console.log('[SearchHistory] deleteHistory Action 調用完成');
      // 刪除成功後，Store 會自動更新 histories 列表，無需手動 setHistoryList
    } catch (err) {
      // Store action 內部已經有 toast 處理，這裡可以只 log
      console.error('[SearchHistory] 刪除歷史記錄過程中捕獲到錯誤 (可能已被 toast 處理):', err);
    } finally {
      setDeletingId(null);
    }
  };

  // 刷新处理 - 調用 Store Action
  const handleRefresh = () => {
    if (loading) return;
    console.log('[SearchHistory] 手動觸發刷新');
    historyActions.fetchHistories(true); // Store Action 會處理加載狀態
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

  return (
    <div className="h-full flex flex-col">
      <SearchHistoryHeader
        isLoading={loading && deletingId === null}
        // 可以考慮從 store 獲取刷新 action 傳遞給 Header
        // onRefresh={handleRefresh}
      />

      <div className="flex-grow overflow-auto">
        <SearchHistoryList
          isLoading={loading}
          historyList={filteredHistoryList} // <-- 傳遞從 Store 來的數據 (已過濾)
          error={error}
          selectedHistoryId={selectedHistoryId} // <-- 傳遞從 Store 來的選中 ID
          deletingId={deletingId} // 本地狀態
          onSelectHistory={handleSelectHistory} // 傳遞更新後的處理函數
          onDeleteHistory={handleDeleteHistory} // 傳遞更新後的處理函數
          onRefreshHistory={handleRefresh} // 傳遞更新後的處理函數
          quotaExceeded={quotaExceeded} // 添加缺少的必需属性
        />
      </div>
    </div>
  );
} 