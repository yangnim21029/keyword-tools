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
      {/* 简化的顶部导航 - 添加 justify-between */}
      <header className="sticky top-0 flex h-12 shrink-0 items-center justify-between bg-background border-b px-3 md:px-4 z-10 gap-2">
        {/* Tool Info - Hide on mobile (md:flex) */}
        <div className="hidden md:flex items-center gap-2">
          {getToolIcon(activeTool)}
          <span className="font-medium">{getToolDisplayName(activeTool)}</span>

          {/* 区域/语言标签 - Hide on mobile (md:flex) */}
          {isMounted && (
            <div className="hidden md:flex items-center gap-1 ml-1">
              <span className="px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground text-xs">
                {`${region} / ${language ? language.replace("_", "-") : "zh-TW"}`}
              </span>
            </div>
          )}
        </div>

        {/* Search group - takes remaining space */}
        <div className="flex items-center flex-1 gap-2 max-w-lg">
            {/* Search Icon - Hide on mobile (md:block) */}
            <Search
                className="hidden md:block h-4 w-4 text-muted-foreground flex-shrink-0"
                aria-hidden="true"
            />
            {/* Input - takes remaining space within the group */}
            <Input
                type="text"
                placeholder={getSearchPlaceholder(activeTool)}
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                // Adjusted padding for mobile when icon is hidden
                className="h-8 shadow-sm rounded-md text-sm flex-1 min-w-0 md:pl-2 pl-3"
                onKeyDown={(e) => e.key === "Enter" && triggerQuery()}
            />
            {/* Loading Button */}
            <LoadingButton
                onClick={triggerQuery}
                className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 rounded-md transition-colors shadow-sm flex-shrink-0"
                isLoading={isLoading}
                loadingText={loadingMessage || "處理中..."}
            >
                {getButtonText(activeTool)}
            </LoadingButton>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1">
          {/* Search Shortcut Help - Hide on mobile (md:block) */}
          <div className="hidden md:block">
            <SearchShortcutHelp />
          </div>
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

