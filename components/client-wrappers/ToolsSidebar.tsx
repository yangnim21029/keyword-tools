'use client';

import KeywordHistoryList from "@/app/history/search/KeywordHistoryList";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export default function ToolSidebar() {
  const pathname = usePathname();

  // Determine the content based on the current path
  let sidebarContent = null;
  let sidebarTitle = "工具側邊欄"; // Default title

  if (pathname.startsWith('/tools/keyword')) {
    // For the keyword tool, show the history list
    sidebarTitle = "關鍵詞歷史記錄";
    sidebarContent = <KeywordHistoryList />;
  } else if (pathname.startsWith('/tools/url')) {
    // Placeholder for URL Tool Sidebar content
    sidebarTitle = "URL 分析側邊欄";
    sidebarContent = <div className="p-4 text-sm text-muted-foreground">URL 功能側邊欄內容待添加</div>;
  } else if (pathname.startsWith('/tools/serp')) {
    // Placeholder for SERP Tool Sidebar content
    sidebarTitle = "SERP 分析側邊欄";
    sidebarContent = <div className="p-4 text-sm text-muted-foreground">SERP 功能側邊欄內容待添加</div>;
  } else if (pathname.startsWith('/history')) {
    // Show history if on a history page
    sidebarTitle = "歷史記錄";
    sidebarContent = <KeywordHistoryList />;
  }

  return (
    <Sidebar className="flex flex-col h-full">
      <SidebarHeader className="border-b dark:border-gray-800">
        <h1 className="text-base font-semibold text-blue-700 dark:text-blue-400">{sidebarTitle}</h1>
      </SidebarHeader>
      
      <SidebarContent className="flex-grow overflow-y-auto">
        {sidebarContent ? sidebarContent : (
          <div className="p-4 text-sm text-muted-foreground">請選擇一個工具</div>
        )}
      </SidebarContent>
      
      <SidebarFooter className="border-t dark:border-gray-800">
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <span>v1.0.0 © 2024 關鍵詞工具</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
} 