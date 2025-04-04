"use client"

import { ModeToggle } from "@/components/common/ModeToggle"
import { SearchShortcutHelp } from "@/components/tools/SearchShortcutHelp"
import { SettingsDialog } from "@/components/tools/SettingsDialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/LoadingButton"
import { LayoutWidthContext } from '@/providers/LayoutWidthProvider'; // Import from the new provider
import { useQueryStore } from "@/providers/QueryProvider"
import { useSettingsStore } from "@/store/settingsStore"
import { FileText, Search } from "lucide-react"
import { usePathname } from "next/navigation"
import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"

// --- Remove Layout Width Context --- 
// const LayoutWidthContext = createContext<boolean>(true); // Default to true (wide)
// export const useLayoutWidth = () => useContext(LayoutWidthContext);
// --------------------------

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const activeTool = pathname.split("/")[2] || "keyword"

  // Settings store for region/language display
  const region = useSettingsStore((store) => store.state.region)
  const language = useSettingsStore((store) => store.state.language)

  // Query store for search input and loading state
  const queryInput = useQueryStore((store) => store.state.queryInput)
  const isLoading = useQueryStore((store) => store.state.isLoading)
  const loadingMessage = useQueryStore((store) => store.state.loadingMessage)
  const setQueryInput = useQueryStore((store) => store.actions.setQueryInput)
  const triggerGlobalQuery = useQueryStore((store) => store.actions.triggerGlobalQuery)

  // State to track client-side mount and prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false)

  // --- Resize Observer Logic ---
  const contentRef = useRef<HTMLDivElement>(null);
  const [isWideLayout, setIsWideLayout] = useState(true); // Assume wide initially
  const WIDTH_THRESHOLD = 768; // Example threshold for 2-column layout (md breakpoint)

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width } = entries[0].contentRect;
        setIsWideLayout(width >= WIDTH_THRESHOLD);
      }
    });

    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    // Initial check
    if (contentRef.current) {
       setIsWideLayout(contentRef.current.offsetWidth >= WIDTH_THRESHOLD);
    }

    return () => observer.disconnect();
  }, []); // Run only on mount
  // --------------------------

  // Memoize the trigger function to prevent unnecessary re-renders
  const triggerQuery = useCallback(() => {
    console.log(`[Layout] Triggering search action for ${activeTool} with input: ${queryInput}`)
    triggerGlobalQuery(activeTool, queryInput)
    window.dispatchEvent(new CustomEvent("search-button-click"))
  }, [activeTool, queryInput, triggerGlobalQuery])

  // Helper to map tool names to display names
  const getToolDisplayName = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "關鍵詞工具"
    }
  }

  const getSearchPlaceholder = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "輸入關鍵詞搜索..."
    }
  }

  const getButtonText = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "獲取建議"
    }
  }

  const getTooltipText = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "搜索相關關鍵詞"
    }
  }

  // Get icon for each tool
  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "keyword":
        return <FileText className="h-4 w-4 mr-2" />
      default:
        return null
    }
  }

  // Handle keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to trigger search
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        triggerQuery()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [triggerQuery])

  // Ensure component is mounted before rendering client-side specific state
  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* 简化的顶部导航 */}
      <header className="sticky top-0 flex h-12 shrink-0 items-center bg-background border-b px-4 z-10">
        <div className="flex items-center gap-2 mr-3">
          {getToolIcon(activeTool)}
          <span className="font-medium">{getToolDisplayName(activeTool)}</span>

          {/* 区域/语言标签 - 简化为一个组件 */}
          {isMounted && (
            <div className="flex items-center gap-1 ml-1">
              <span className="px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-xs">
                {`${region} / ${language ? language.replace("_", "-") : "zh-TW"}`}
              </span>
            </div>
          )}
        </div>

        {/* 搜索输入框 - 简化结构 */}
        <div className="relative flex-1 max-w-lg">
          <Input
            type="text"
            placeholder={getSearchPlaceholder(activeTool)}
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="pl-8 pr-20 h-8 shadow-sm rounded-full text-sm"
            onKeyDown={(e) => e.key === "Enter" && triggerQuery()}
          />
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <LoadingButton
            onClick={triggerQuery}
            className="absolute right-1 top-1 h-6 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-2.5 rounded-full transition-colors shadow-sm"
            isLoading={isLoading}
            loadingText={loadingMessage || "處理中..."}
          >
            {getButtonText(activeTool)}
          </LoadingButton>
        </div>

        {/* 工具按钮 */}
        <div className="flex items-center gap-1 ml-3">
          <SearchShortcutHelp />
          <SettingsDialog />
          <ModeToggle />
        </div>
      </header>

      {/* 主内容区域 - 直接渲染，移除多余嵌套 */}
      <LayoutWidthContext.Provider value={{ isWideLayout }}>
        <div ref={contentRef} className="flex-1 w-full overflow-auto p-4">
          {children}
        </div>
      </LayoutWidthContext.Provider>
    </div>
  )
}

