'use client';

import KeywordHistoryList from "@/app/history/history-components/search-history/KeywordHistoryList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePastQueryStore } from "@/store/pastQueryStore";
import type { PastQueryStore } from "@/store/pastQueryStore";
import { InfoIcon, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// 最多保存最近訪問的記錄數量
const MAX_RECENT_HISTORY = 5;

export default function KeywordHistorySidebar() {
  // 使用 Zustand store 替代事件
  const historyActions = usePastQueryStore((state: PastQueryStore) => state.actions);
  const historyState = usePastQueryStore((state: PastQueryStore) => state.state);
  
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
      await fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['history'] }),
      });
      
      // 如果有選中的歷史，刷新它及其標籤
      if (historyState.selectedHistoryDetail?.id) {
        const historyId = historyState.selectedHistoryDetail.id;
        
        // 重新驗證歷史記錄標籤
        await fetch('/api/revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: [`history-${historyId}`] }),
        });
        
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
    <Sidebar className="flex flex-col h-full">
      <SidebarHeader className="border-b dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-blue-700 dark:text-blue-400">過去查詢</h1>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            title="重新整理所有歷史記錄"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="搜尋歷史記錄..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </SidebarHeader>
      
      <SidebarContent className="flex-grow overflow-y-auto">
        {recentHistory.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>最近瀏覽</SidebarGroupLabel>
            <SidebarGroupContent>
              <ScrollArea className="max-h-40">
                <SidebarMenu>
                  {recentHistory
                    .filter(item => item && item.id && item.mainKeyword)
                    .map((item, index) => (
                      <SidebarMenuItem key={item.id || `recent-item-${index}`}>
                        <SidebarMenuButton
                          onClick={() => handleSelectRecentHistory(item.id)}
                          isActive={historyState.selectedHistoryId === item.id}
                          className="justify-start w-full"
                        >
                          {item.mainKeyword}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </ScrollArea>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        <SidebarGroup className="flex-grow flex flex-col">
          <SidebarGroupLabel>全部歷史</SidebarGroupLabel>
          <SidebarGroupContent className="flex-grow overflow-hidden">
            <KeywordHistoryList 
              onSelectHistory={handleSelectHistory} 
              searchFilter={searchFilter}
              isRefreshing={isRefreshing}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t dark:border-gray-800">
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <InfoIcon className="h-3.5 w-3.5 mr-1" />
          <span>v1.0.0 © 2024 關鍵詞工具</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
} 