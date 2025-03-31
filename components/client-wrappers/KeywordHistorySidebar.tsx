'use client';

import KeywordHistoryList from "@/components/KeywordHistoryList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useHistoryStore } from "@/store/historyStore";
import { InfoIcon, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// 最多保存最近訪問的記錄數量
const MAX_RECENT_HISTORY = 5;

export default function KeywordHistorySidebar() {
  // 使用 Zustand store 替代事件
  const historyActions = useHistoryStore(state => state.actions);
  const historyState = useHistoryStore(state => state.state);
  
  // 新增搜索過濾用的狀態
  const [searchFilter, setSearchFilter] = useState('');
  // 新增最近瀏覽記錄狀態
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  // 添加刷新狀態
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 添加事件監聽器來處理 clearHistoryDetail 事件
  useEffect(() => {
    const handleClearHistoryDetail = () => {
      historyActions.clearSelectedHistoryDetail();
    };

    // 添加事件監聽器
    window.addEventListener('clearHistoryDetail', handleClearHistoryDetail);

    // 清理事件監聽器
    return () => {
      window.removeEventListener('clearHistoryDetail', handleClearHistoryDetail);
    };
  }, [historyActions]);

  // 從 session storage 加載最近瀏覽記錄
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRecent = sessionStorage.getItem('recent-history-list');
        if (savedRecent) {
          const parsedRecent = JSON.parse(savedRecent);
          // 過濾掉無效的項目
          const validRecent = parsedRecent.filter((item: any) => 
            item && 
            item.id && 
            item.mainKeyword
          );
          setRecentHistory(validRecent);
        }
      } catch (error) {
        console.error('加載最近歷史記錄失敗:', error);
      }
    }
  }, []);

  // 當選中的歷史記錄變化時，更新最近瀏覽記錄
  useEffect(() => {
    if (historyState.selectedHistoryDetail && typeof window !== 'undefined') {
      const currentDetail = historyState.selectedHistoryDetail;
      
      setRecentHistory(prevList => {
        // 過濾掉相同ID的記錄，確保ID存在
        const filteredList = prevList.filter(item => item.id && item.id !== currentDetail.id);
        // 添加到頂部，確保有ID
        const newList = [
          {
            id: currentDetail.id || `temp-${Date.now()}`, // 確保ID一定存在
            mainKeyword: currentDetail.mainKeyword,
            timestamp: currentDetail.timestamp || new Date().toISOString(),
            region: currentDetail.region,
            language: currentDetail.language
          },
          ...filteredList
        ].slice(0, MAX_RECENT_HISTORY); // 限制數量
        
        // 保存到 session storage
        try {
          sessionStorage.setItem('recent-history-list', JSON.stringify(newList));
        } catch (error) {
          console.error('保存最近歷史記錄失敗:', error);
        }
        
        return newList;
      });
    }
  }, [historyState.selectedHistoryDetail]);

  // 在客戶端組件內處理歷史記錄的選擇
  const handleSelectHistory = (historyDetail: any) => {
    // 直接使用 store action 而不是事件
    historyActions.setSelectedHistoryDetail(historyDetail);
  };

  // 處理從最近記錄中選擇
  const handleSelectRecentHistory = (historyId: string) => {
    historyActions.setSelectedHistoryId(historyId);
  };

  // 處理刷新全部歷史記錄
  const handleRefreshAll = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // 清除緩存
      /*
      if (typeof historyActions.clearCache === 'function') {
        historyActions.clearCache();
      }
      */
      
      // 使用 revalidateTag API 重新驗證標籤
      try {
        const response = await fetch('/api/revalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            tags: ['history']
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '刷新標籤失敗');
        }
        
        const result = await response.json();
        console.log('重新驗證標籤結果:', result);
      } catch (error) {
        console.error('重新驗證標籤失敗:', error);
      }
      
      // 如果有選中的歷史，刷新它及其標籤
      if (historyState.selectedHistoryDetail?.id) {
        const historyId = historyState.selectedHistoryDetail.id;
        
        // 重新驗證歷史記錄標籤
        try {
          await fetch('/api/revalidate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              tags: [`history-${historyId}`]
            }),
          });
        } catch (error) {
          console.error(`重新驗證歷史記錄標籤失敗 (ID: ${historyId}):`, error);
        }
        
        // 只需重新設置 ID，依賴 revalidateTag 和組件更新機制
        historyActions.setSelectedHistoryId(historyId);
      }
      
      // 觸發通知
      toast.success('歷史記錄已重新整理');
    } catch (error) {
      console.error('重新整理歷史記錄失敗:', error);
      toast.error('重新整理失敗');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* 側邊欄 Header */}
      <div className="px-4 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <h1 className="text-base font-semibold text-blue-700 dark:text-blue-400">關鍵詞研究工具</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          title="重新整理所有歷史記錄"
        >
          <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      {/* 搜索過濾輸入框 */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="搜尋歷史記錄..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>
      
      {/* 最近瀏覽記錄 */}
      {recentHistory.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">最近瀏覽</h3>
          <ScrollArea className="max-h-40">
            <div className="space-y-1.5">
              {recentHistory
                .filter(item => item && item.id && item.mainKeyword) // 再次過濾，確保渲染時每項都有效
                .map((item, index) => (
                  <button
                    key={item.id || `recent-item-${index}`}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-sm ${
                      historyState.selectedHistoryDetail?.id === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                    onClick={() => handleSelectRecentHistory(item.id)}
                  >
                    {item.mainKeyword}
                  </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* 側邊欄內容區 - 歷史記錄（可滾動） */}
      <div className="flex-grow overflow-auto">
        <KeywordHistoryList 
          onSelectHistory={handleSelectHistory} 
          searchFilter={searchFilter}
          isRefreshing={isRefreshing}
        />
      </div>
      
      {/* 側邊欄 Footer */}
      <div className="px-4 py-3 text-xs text-gray-700 dark:text-gray-400 flex items-center justify-center flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <InfoIcon className="h-3.5 w-3.5 mr-1" />
        <span>v1.0.0 © 2024 關鍵詞工具</span>
      </div>
    </div>
  );
} 