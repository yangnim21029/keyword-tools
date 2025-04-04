/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client"

import React, { useEffect, useState } from "react";
// 引入必要的UI组件
import { Button } from "@/components/ui/button";
import { ScrollArea } from '@/components/ui/ScrollArea';
// 引入store hooks和types
import { useResearchStore } from "@/store/keywordResearchStore";
// 引入组件
import KeywordResearchList from "@/app/tools/keyword/components/KeywordResearchList";
// 引入SerpAnalysisTab
import SerpAnalysisTab from "@/app/tools/keyword/components/serp-sidebar/SerpAnalysisSidebar";
// 引入types
import type { SerpAnalysisMetrics, SerpDisplayData, SerpResultItem } from '@/app/types/serp.types';
// 引入hooks
import { useIsMobile } from "@/hooks/UseMobile";
// 引入icons
import { TooltipProvider } from "@/components/ui/tooltip";
import { FileText, PanelLeft, PanelRight, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
// 动态引入MobileNavbar组件，修复导入错误
const MobileNavbar = dynamic(() => import("@/components/common/MobileNavbar"), { ssr: false });

interface ClientLayoutProps {
  children: React.ReactNode
}

// 左侧侧边栏Context
const LeftSidebarContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

// 右侧侧边栏Context
const RightSidebarContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export default function ClientLayout({ children }: ClientLayoutProps) {
  // 检测移动设备
  const isMobile = useIsMobile();
  
  // 侧边栏状态
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(!isMobile);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  
  // Get selected detail and the analysis request state from store
  const { selectedResearchDetail, serpAnalysisRequest } = useResearchStore((store) => store.state);
  const clearSerpAnalysisRequest = useResearchStore((store) => store.actions.clearSerpAnalysisRequest); 
  const fetchResearches = useResearchStore((store) => store.actions.fetchResearches);
  const loading = useResearchStore((store) => store.state.loading);

  // 處理刷新事件
  const handleRefresh = () => {
    if (loading) return;
    console.log("[ClientLayout] 手動觸發刷新");
    fetchResearches(true);
  };

  // Local state to manage props passed down to SerpAnalysisTab
  const [serpTabProps, setSerpTabProps] = useState<{
    keyword: string;
    region: string;
    language: string;
    selectedData: SerpDisplayData | null;
  }>(() => ({
    keyword: selectedResearchDetail?.query || "",
    region: selectedResearchDetail?.location || "tw",
    language: selectedResearchDetail?.language || "zh-TW",
    selectedData: selectedResearchDetail ? {
      id: selectedResearchDetail.id,
      type: "serp",
      query: selectedResearchDetail.query,
      location: selectedResearchDetail.location,
      language: selectedResearchDetail.language,
      // @ts-ignore
      serpResults: selectedResearchDetail.serpResults as SerpResultItem[] | undefined,
      // @ts-ignore
      analysis: selectedResearchDetail.analysis as SerpAnalysisMetrics | undefined, 
      createdAt: selectedResearchDetail.createdAt,
      updatedAt: selectedResearchDetail.updatedAt, 
    } : null,
  }));

  // Effect to update SERP tab props when selectedResearchDetail changes
  useEffect(() => {
    console.log("[ClientLayout] selectedResearchDetail changed:", selectedResearchDetail?.id);
    setSerpTabProps({
      keyword: selectedResearchDetail?.query || "",
      region: selectedResearchDetail?.location || "tw",
      language: selectedResearchDetail?.language || "zh-TW",
      selectedData: selectedResearchDetail ? {
        id: selectedResearchDetail.id,
        type: "serp",
        query: selectedResearchDetail.query,
        location: selectedResearchDetail.location,
        language: selectedResearchDetail.language,
        // @ts-ignore
        serpResults: selectedResearchDetail.serpResults as SerpResultItem[] | undefined,
        // @ts-ignore
        analysis: selectedResearchDetail.analysis as SerpAnalysisMetrics | undefined,
        createdAt: selectedResearchDetail.createdAt,
        updatedAt: selectedResearchDetail.updatedAt,
      } : null,
    });
  }, [selectedResearchDetail]);

  // Effect to react to serpAnalysisRequest from the store
  useEffect(() => {
    if (serpAnalysisRequest) {
      console.log("[ClientLayout] Received serpAnalysisRequest:", serpAnalysisRequest);
      setSerpTabProps(prevProps => ({
        ...prevProps, 
        keyword: serpAnalysisRequest.keyword,
        region: serpAnalysisRequest.region, 
        language: serpAnalysisRequest.language,
        selectedData: null, 
      }));
      // Clear the request in the store after processing it
      clearSerpAnalysisRequest();
    }
  }, [serpAnalysisRequest, clearSerpAnalysisRequest]);

  return (
    <div className="w-full h-[calc(100dvh)]">
      <LeftSidebarContext.Provider value={{ isOpen: leftSidebarOpen, setIsOpen: setLeftSidebarOpen }}>
        <RightSidebarContext.Provider value={{ isOpen: rightSidebarOpen, setIsOpen: setRightSidebarOpen }}>
          <TooltipProvider>
            <div className="flex h-full w-full">
              {/* 左侧栏 - 减少宽度 */}
              <div 
                className={`border-r bg-sidebar text-sidebar-foreground h-full overflow-hidden flex flex-col
                  ${leftSidebarOpen ? 'w-64' : 'w-0'} 
                  transition-all duration-300 ease-in-out`}
              >
                {/* 极简化的标题栏 */}
                <div className="h-14 flex items-center border-b">
                  <div className="flex items-center justify-between w-full px-2 py-1.5">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                      <h2 className="text-sm font-medium truncate">關鍵詞研究</h2>
                    </div>
                    <div className="flex-shrink-0">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-6 w-6 rounded-full text-foreground/50 hover:text-foreground"
                        onClick={handleRefresh}
                        disabled={loading}
                        aria-label="刷新研究記錄"
                      >
                        {loading ? (
                          <div className="h-3 w-3 border-t-2 border-b-2 border-primary/30 rounded-full animate-spin"></div>
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 內容區域 - 消除所有额外padding */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full w-full">
                    <KeywordResearchList hideRefreshButton={true} />
                  </ScrollArea>
                </div>

                {/* 極簡化底部區域 */}
                <div className="border-t py-2 px-2">
                  <span className="text-xs text-muted-foreground truncate block">
                    關鍵詞殺手 - 專業 SEO 工具
                  </span>
                </div>
              </div>

              {/* 主内容区 */}
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 bg-background border-b px-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="flex-shrink-0"
                    onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
                  >
                    <PanelLeft className="h-4 w-4" />
                    <span className="sr-only">切换左侧栏</span>
                  </Button>
                  
                  <div className="flex items-center gap-2 flex-grow truncate">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="text-sm font-medium truncate">
                      關鍵詞研究與分析工具
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="flex-shrink-0"
                    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  >
                    <PanelRight className="h-4 w-4" />
                    <span className="sr-only">切换右侧栏</span>
                  </Button>
                </header>
                <main className="flex-1 w-full overflow-auto pb-16 md:pb-0">
                  {children}
                </main>
              </div>

              {/* 右侧栏 */}
              <div 
                className={`border-l bg-sidebar text-sidebar-foreground h-full overflow-hidden flex flex-col
                  ${rightSidebarOpen ? 'w-[400px]' : 'w-0'} 
                  transition-all duration-300 ease-in-out`}
              >
                <div className="h-14 flex items-center border-b px-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <h2 className="text-base font-medium truncate">搜索結果分析</h2>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <SerpAnalysisTab 
                      activeTab="serp" 
                      region={serpTabProps.region}
                      language={serpTabProps.language}
                      globalSearchInput={serpTabProps.keyword}
                      selectedSerpAnalysisData={serpTabProps.selectedData}
                      onSerpAnalysisLoaded={(data) => {
                        console.log("[ClientLayout] SerpAnalysisTab loaded data:", data?.query);
                      }}
                    />
                  </ScrollArea>
                </div>
              </div>
            </div>
            
            {/* 移动设备底部导航栏 */}
            <MobileNavbar
              onToggleLeftSidebar={() => setLeftSidebarOpen(prev => !prev)}
              onToggleRightSidebar={() => setRightSidebarOpen(prev => !prev)}
            />
          </TooltipProvider>
        </RightSidebarContext.Provider>
      </LeftSidebarContext.Provider>
    </div>
  );
}

