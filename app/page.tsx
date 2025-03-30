'use client';

import { ModeToggle } from '@/components/common/ModeToggle';
import KeywordSearchTab from '@/components/keyword-tool/keyword-search-tab';
import SerpAnalysisTab from '@/components/serp-tool/serp-analysis-tab';
import SettingsTab from '@/components/settings-tool/settings-tab';
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UrlAnalysisTab from '@/components/url-tool/url-analysis-tab';
import { useHistoryStore } from '@/store/historyStore';
import { useSearchStore } from '@/store/searchStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTabStore } from '@/store/tabStore';
import { Search } from "lucide-react";
import { useEffect } from 'react';
import { getRegions } from './actions';

export default function Home() {
  // 使用 TabStore
  const activeTab = useTabStore(state => state.state.activeTab);
  const setActiveTab = useTabStore(state => state.actions.setActiveTab);
  
  // 使用 SettingsStore - 通過新的Provider模式訪問
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  
  // 從設置Store中解構需要的值和操作方法
  const {
    region, language, regions, languages,
    useAlphabet, useSymbols, filterZeroVolume, maxResults
  } = settingsState;
  
  const {
    setRegion, setLanguage, setRegions, setLanguages,
    setUseAlphabet, setUseSymbols, setFilterZeroVolume, setMaxResults
  } = settingsActions;
  
  // 使用 SearchStore
  const searchInput = useSearchStore(store => store.state.searchInput);
  const isLoading = useSearchStore(store => store.state.isLoading);
  const loadingMessage = useSearchStore(store => store.state.loadingMessage);
  const setSearchInput = useSearchStore(store => store.actions.setSearchInput);
  const handleSearchSubmit = useSearchStore(store => store.actions.handleSearchSubmit);
  
  // 使用 HistoryStore
  const historyState = useHistoryStore(store => store.state);
  const historyActions = useHistoryStore(store => store.actions);
  
  const selectedHistoryDetail = historyState.selectedHistoryDetail;

  // 獲取可用地區
  useEffect(() => {
    async function fetchRegions() {
      try {
        const response = await getRegions();
        setRegions(response.regions);
        setLanguages(response.languages || {});
      } catch (error) {
        console.error('Error fetching regions:', error);
      }
    }
    fetchRegions();
  }, [setRegions, setLanguages]);
  
  // 處理從歷史記錄中載入數據
  const handleSelectHistory = (historyDetail: any) => {
    if (!historyDetail) return;
    
    // 載入基本設定
    setRegion(historyDetail.region);
    setLanguage(convertToLanguage(historyDetail.language));
    
    // 根據數據類型切換到相應的標籤頁
    const targetTab = historyDetail.type === 'url' ? 'url' :
                     historyDetail.type === 'serp' ? 'serp' :
                     'keyword'; // 默認為 keyword
    setActiveTab(targetTab as any);
    
    // 設置歷史詳情數據
    historyActions.setSelectedHistoryDetail(historyDetail);
  };

  // 添加函數轉換 TabType 到組件使用的類型
  const convertTabType = (tab: string): 'keyword' | 'url' | 'serp' | 'settings' => {
    if (tab === 'keyword' || tab === 'url' || tab === 'serp' || tab === 'settings') {
      return tab;
    }
    // 默認返回 keyword
    return 'keyword';
  };

  // 添加一個語言字符串轉換函數，將字符串轉換為Language類型
  const convertToLanguage = (lang: string): 'zh-TW' | 'en-US' => {
    if (lang === 'zh-TW' || lang === 'en-US') {
      return lang;
    }
    return 'zh-TW'; // 默認繁體中文
  };

  return (
    <div className="w-full h-full overflow-auto">
      <Tabs 
        value={convertTabType(activeTab)}
        onValueChange={(val) => setActiveTab(val as any)} 
        className="w-full h-full"
      >
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-3 px-4 gap-4 shadow-sm">
          <div className="flex-shrink-0 text-sm text-gray-600 dark:text-gray-400 hidden md:flex items-center gap-1 whitespace-nowrap">
            <span className="px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs border border-gray-200 dark:border-gray-800">{region}</span> 
            <span className="px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs border border-gray-200 dark:border-gray-800">{language}</span>
          </div>
          
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
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
          
          <div className="flex items-center gap-2">
            <ModeToggle />
            <TabsList className="backdrop-blur-sm p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm">
              <TabsTrigger 
                value="keyword" 
                className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                關鍵詞工具
              </TabsTrigger>
              <TabsTrigger 
                value="url" 
                className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                URL分析
              </TabsTrigger>
              <TabsTrigger 
                value="serp" 
                className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                SERP分析
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm"
              >
                設置
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        
        <div className="px-6 pt-4 overflow-auto h-[calc(100%-56px)]">
          <TabsContent value="keyword" className="mt-0 h-full">
            <KeywordSearchTab 
              activeTab={convertTabType(activeTab)}
              region={region}
              language={language}
              regions={regions}
              languages={languages}
              onRegionChange={setRegion}
              onLanguageChange={(val) => setLanguage(convertToLanguage(val))}
              filterZeroVolume={filterZeroVolume}
              maxResults={maxResults}
              onHistoryUpdate={(newHistory) => {
                console.log('歷史記錄已更新:', newHistory);
              }}
              globalSearchInput={searchInput}
              useAlphabet={useAlphabet}
              useSymbols={useSymbols}
            />
          </TabsContent>
          
          <TabsContent value="url" className="mt-0 h-full">
            <UrlAnalysisTab 
              activeTab={convertTabType(activeTab)}
              region={region}
              language={language}
              regions={regions}
              languages={languages}
              onRegionChange={setRegion}
              onLanguageChange={(val: string) => setLanguage(convertToLanguage(val))}
              filterZeroVolume={filterZeroVolume}
              maxResults={maxResults}
              selectedHistoryDetail={selectedHistoryDetail}
              onHistoryLoaded={() => {}} // 暫時保留以避免報錯，稍後也可以採用 store 方式重構
              globalSearchInput={searchInput}
            />
          </TabsContent>
          
          <TabsContent value="serp" className="mt-0 h-full">
            <SerpAnalysisTab 
              activeTab={convertTabType(activeTab)}
              region={region}
              language={language}
              regions={regions}
              languages={languages}
              onRegionChange={setRegion}
              onLanguageChange={(val: string) => setLanguage(convertToLanguage(val))}
              selectedHistoryDetail={selectedHistoryDetail}
              onHistoryLoaded={() => {}} // 暫時保留以避免報錯，稍後也可以採用 store 方式重構
              globalSearchInput={searchInput}
            />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-0 h-full">
            <SettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}