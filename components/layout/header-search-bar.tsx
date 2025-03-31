'use client';

import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSearchStore } from '@/store/searchStore';
import { useTabStore } from '@/store/tabStore';
import { Search } from "lucide-react";

export default function HeaderSearchBar() {
  const searchInput = useSearchStore(store => store.state.searchInput);
  const isLoading = useSearchStore(store => store.state.isLoading);
  const loadingMessage = useSearchStore(store => store.state.loadingMessage);
  const setSearchInput = useSearchStore(store => store.actions.setSearchInput);
  const handleSearchSubmit = useSearchStore(store => store.actions.handleSearchSubmit);
  const activeTab = useTabStore(state => state.state.activeTab);

  return (
    <div className="relative flex-1 max-w-lg">
      <Input
        type="text"
        placeholder={
          activeTab === 'keyword' ? "輸入關鍵詞搜索..." : 
          activeTab === 'url' ? "輸入網址分析..." : 
          activeTab === 'serp' ? "輸入SERP查詢詞..." : 
          "搜索..."
        }
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-9 pr-24 h-10 border-gray-200 dark:border-gray-800 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-600 rounded-full transition-colors"
        onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSearchSubmit()} 
      />
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <LoadingButton 
              onClick={handleSearchSubmit}
              className="absolute right-1 top-1 h-8 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 rounded-full transition-colors shadow-sm"
              isLoading={isLoading}
              loadingText={loadingMessage || "處理中..."}
              disabled={isLoading}
            >
              {activeTab === 'keyword' ? "獲取建議" : 
                activeTab === 'url' ? "分析URL" : 
                activeTab === 'serp' ? "分析SERP" : "搜索"}
            </LoadingButton>
          </TooltipTrigger>
          <TooltipContent className="bg-gray-800 dark:bg-gray-900 text-white shadow-lg">
            <p className="text-xs">
              {activeTab === 'keyword' ? "搜索相關關鍵詞" : 
                activeTab === 'url' ? "分析URL關鍵詞" : 
                activeTab === 'serp' ? "分析搜索結果頁" : "搜索"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
