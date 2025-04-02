'use client';

import { ModeToggle } from '@/components/common/ModeToggle';
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryStore } from '@/providers/QueryProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { Search } from "lucide-react";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
// Import the action if needed for search triggering, adjust path later if actions are split
// import { someSearchAction } from '@/app/actions'; 

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(); // Get current path
  
  // Determine active tool based on path
  const activeTool = pathname.split('/')[2] || 'keyword'; // Default to keyword if path is just /tools

  // Settings store for region/language display
  const region = useSettingsStore(store => store.state.region);
  const language = useSettingsStore(store => store.state.language);

  // Query store for search input and loading state
  const searchInput = useQueryStore(store => store.state.searchInput);
  const isLoading = useQueryStore(store => store.state.isLoading);
  const loadingMessage = useQueryStore(store => store.state.loadingMessage);
  const setSearchInput = useQueryStore(store => store.actions.setSearchInput);
  const triggerGlobalSearch = useQueryStore(store => store.actions.triggerGlobalSearch);
  
  // TODO: Refine triggerSearch logic for the new structure. 
  // It might need context about the *specific* active tool page, 
  // or each tool page could handle its own search trigger.
  // For now, keep a simplified version or dispatch a global event.
  const triggerQuery = () => {
    console.log(`[Layout] Triggering search action for ${activeTool} with input: ${searchInput}`);
    triggerGlobalSearch(activeTool, searchInput);
  };
  
  // Helper to map tool names to display names
  const getToolDisplayName = (tool: string) => {
    switch(tool) {
      case 'keyword': return '關鍵詞工具';
      case 'url': return 'URL分析';
      case 'serp': return 'SERP分析';
      default: return '工具';
    }
  };
  
  const getSearchPlaceholder = (tool: string) => {
     switch(tool) {
      case 'keyword': return "輸入關鍵詞搜索...";
      case 'url': return "輸入網址分析...";
      case 'serp': return "輸入SERP查詢詞...";
      default: return "搜索...";
    }
  };
  
  const getButtonText = (tool: string) => {
     switch(tool) {
      case 'keyword': return "獲取建議";
      case 'url': return "分析URL";
      case 'serp': return "分析SERP";
      default: return "搜索";
    }
  };
  
   const getTooltipText = (tool: string) => {
     switch(tool) {
      case 'keyword': return "搜索相關關鍵詞";
      case 'url': return "分析URL關鍵詞";
      case 'serp': return "分析搜索結果頁";
      default: return "搜索";
    }
  };


  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-3 px-4 gap-4 shadow-sm flex-shrink-0">
        {/* Region/Language Display */}
        <div className="flex-shrink-0 text-sm text-gray-600 dark:text-gray-400 hidden md:flex items-center gap-1 whitespace-nowrap">
          <span className="px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs border border-gray-200 dark:border-gray-800">{region}</span> 
          <span className="px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs border border-gray-200 dark:border-gray-800">
            {language ? language.replace('_', '-') : 'zh-TW'}
          </span>
        </div>
        
        {/* Search Input & Button */}
        <div className="relative flex-1 max-w-lg">
          <Input
            type="text"
            placeholder={getSearchPlaceholder(activeTool)}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-24 h-10 border-gray-200 dark:border-gray-800 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-600 rounded-full transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && triggerQuery()}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <LoadingButton 
                  onClick={triggerQuery}
                  className="absolute right-1 top-1 h-8 bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 rounded-full transition-colors shadow-sm"
                  isLoading={isLoading}
                  loadingText={loadingMessage || "處理中..."}
                >
                  {getButtonText(activeTool)}
                </LoadingButton>
              </TooltipTrigger>
              <TooltipContent className="bg-gray-800 dark:bg-gray-900 text-white shadow-lg">
                <p className="text-xs">{getTooltipText(activeTool)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Mode Toggle & Tabs Navigation */}
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Tabs value={activeTool} className="p-0 m-0">
            <TabsList className="backdrop-blur-sm p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm">
              <TabsTrigger value="keyword" data-state={activeTool === 'keyword' ? 'active' : 'inactive'} asChild>
                <Link href="/tools/keyword" className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  {getToolDisplayName('keyword')}
                </Link>
              </TabsTrigger>
              <TabsTrigger value="url" data-state={activeTool === 'url' ? 'active' : 'inactive'} asChild>
                <Link href="/tools/url" className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  {getToolDisplayName('url')}
                </Link>
              </TabsTrigger>
              <TabsTrigger value="serp" data-state={activeTool === 'serp' ? 'active' : 'inactive'} asChild>
                <Link href="/tools/serp" className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                   {getToolDisplayName('serp')}
                </Link>
              </TabsTrigger>
              <TabsTrigger value="settings" data-state={pathname === '/settings' ? 'active' : 'inactive'} asChild>
                 <Link href="/settings" className="text-sm font-medium px-4 py-1.5 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                   設置
                 </Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      {/* Main Content Area for Tool Pages */}
      <div className="flex-grow p-6 overflow-auto"> 
        {children}
      </div>
    </div>
  );
}
