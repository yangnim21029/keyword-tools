/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client"

import React, { useEffect, useState } from "react";
// 引入必要的UI组件
import { Button } from "@/components/ui/button";
import { ScrollArea } from '@/components/ui/ScrollArea';
// 引入store hooks和types
import { useResearchStore } from "@/store/keywordResearchStore";
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
import Link from "next/link";
// 动态引入MobileNavbar组件，修复导入错误
const MobileNavbar = dynamic(() => import("@/components/common/MobileNavbar"), { ssr: false });
// 动态引入SettingsDialog组件，修复导入错误
const SettingsDialog = dynamic(() => import("@/components/tools/SettingsDialog").then(mod => mod.SettingsDialog), { ssr: false });
// 动态引入ModeToggle组件，修复导入错误
const ModeToggle = dynamic(() => import("@/components/common/ModeToggle").then(mod => mod.ModeToggle), { ssr: false });

interface ClientLayoutProps {
  children: React.ReactNode
}

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
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  
  // Get selected detail and the analysis request state from store
  const { selectedResearchDetail, serpAnalysisRequest } = useResearchStore((store) => store.state);
  const clearSerpAnalysisRequest = useResearchStore((store) => store.actions.clearSerpAnalysisRequest); 

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
      <RightSidebarContext.Provider value={{ isOpen: rightSidebarOpen, setIsOpen: setRightSidebarOpen }}>
        <TooltipProvider>
          <div className="flex h-full w-full">
            {/* 主内容区 */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 bg-background border-b px-4">
                {/* Left side: Logo and Main Navigation */}
                <div className="flex items-center gap-6">
                  <Link href="/tools/keyword" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">關鍵詞研究</span>
                  </Link>
                  
                  {/* Main Navigation Links */}
                  <nav className="hidden md:flex items-center gap-4">
                    <Link 
                      href="/tools/keyword" 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      新研究
                    </Link>
                    <Link 
                      href="/history" 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      歷史記錄
                    </Link>
                  </nav>
                </div>

                {/* Right side: Actions and Settings */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Region and Language Display */}
                  {selectedResearchDetail && selectedResearchDetail.location && (
                    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{selectedResearchDetail.location.toUpperCase()}</span>
                      <span>•</span>
                      <span>{selectedResearchDetail.language || 'zh-TW'}</span>
                    </div>
                  )}
                  
                  {/* Settings and Theme */}
                  <div className="flex items-center gap-1">
                    <SettingsDialog />
                    <ModeToggle />
                  </div>

                  {/* Mobile Menu Button */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="md:hidden"
                    onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
                  >
                    <PanelRight className="h-4 w-4" />
                    <span className="sr-only">切換側邊欄</span>
                  </Button>
                </div>
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
              <div className="h-14 flex items-center justify-between border-b px-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="font-medium">搜索結果分析</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setRightSidebarOpen(false)}
                  className="md:hidden"
                >
                  <PanelRight className="h-4 w-4 rotate-180" />
                  <span className="sr-only">關閉側邊欄</span>
                </Button>
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
            onToggleRightSidebar={() => setRightSidebarOpen(prev => !prev)}
          />
        </TooltipProvider>
      </RightSidebarContext.Provider>
    </div>
  );
}

