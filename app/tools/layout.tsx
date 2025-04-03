"use client"

import { ModeToggle } from "@/components/common/ModeToggle"
import { SearchShortcutHelp } from "@/components/tools/SearchShortcutHelp"
import { SettingsDialog } from "@/components/tools/SettingsDialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/LoadingButton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useQueryStore } from "@/providers/QueryProvider"
import { useSettingsStore } from "@/store/settingsStore"
import { FileText, Globe, LayoutGrid, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type React from "react"
import { useCallback, useEffect, useState } from "react"

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
  const searchInput = useQueryStore((store) => store.state.searchInput)
  const isLoading = useQueryStore((store) => store.state.isLoading)
  const loadingMessage = useQueryStore((store) => store.state.loadingMessage)
  const setSearchInput = useQueryStore((store) => store.actions.setSearchInput)
  const triggerGlobalSearch = useQueryStore((store) => store.actions.triggerGlobalSearch)

  // Add state for mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Memoize the trigger function to prevent unnecessary re-renders
  const triggerQuery = useCallback(() => {
    console.log(`[Layout] Triggering search action for ${activeTool} with input: ${searchInput}`)
    triggerGlobalSearch(activeTool, searchInput)
    window.dispatchEvent(new CustomEvent("search-button-click"))
  }, [activeTool, searchInput, triggerGlobalSearch])

  // Helper to map tool names to display names
  const getToolDisplayName = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "關鍵詞工具"
      case "url":
        return "URL分析"
      case "serp":
        return "SERP分析"
      default:
        return "工具"
    }
  }

  const getSearchPlaceholder = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "輸入關鍵詞搜索..."
      case "url":
        return "輸入網址分析..."
      case "serp":
        return "輸入SERP查詢詞..."
      default:
        return "搜索..."
    }
  }

  const getButtonText = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "獲取建議"
      case "url":
        return "分析URL"
      case "serp":
        return "分析SERP"
      default:
        return "搜索"
    }
  }

  const getTooltipText = (tool: string) => {
    switch (tool) {
      case "keyword":
        return "搜索相關關鍵詞"
      case "url":
        return "分析URL關鍵詞"
      case "serp":
        return "分析搜索結果頁"
      default:
        return "搜索"
    }
  }

  // Get icon for each tool
  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "keyword":
        return <FileText className="h-4 w-4 mr-2" />
      case "url":
        return <Globe className="h-4 w-4 mr-2" />
      case "serp":
        return <LayoutGrid className="h-4 w-4 mr-2" />
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

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top Bar - Optimized for mobile */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-2 px-3 gap-3 shadow-sm flex-shrink-0">
        {/* Region/Language Display - Keep as display only to avoid hydration issues */}
        <div className="flex-shrink-0 text-sm text-gray-600 dark:text-gray-400 hidden md:flex items-center gap-1 whitespace-nowrap">
          <span className="px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs">
            {region}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-xs">
            {language ? language.replace("_", "-") : "zh-TW"}
          </span>
        </div>

        {/* Search Input & Button */}
        <div className="relative flex-1 max-w-lg">
          <Input
            type="text"
            placeholder={getSearchPlaceholder(activeTool)}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 pr-20 h-9 border-gray-200 dark:border-gray-800 shadow-sm focus:border-blue-300 dark:focus:border-blue-600 focus:ring-1 focus:ring-blue-300 dark:focus:ring-blue-600 rounded-full transition-colors"
            onKeyDown={(e) => e.key === "Enter" && triggerQuery()}
            aria-label={`Search ${getToolDisplayName(activeTool)}`}
          />
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <LoadingButton
                  onClick={triggerQuery}
                  className="absolute right-1 top-1 h-7 bg-blue-500 hover:bg-blue-600 text-white text-xs px-2.5 rounded-full transition-colors shadow-sm"
                  isLoading={isLoading}
                  loadingText={loadingMessage || "處理中..."}
                  aria-label={getButtonText(activeTool)}
                >
                  {getButtonText(activeTool)}
                </LoadingButton>
              </TooltipTrigger>
              <TooltipContent className="bg-gray-800 dark:bg-gray-900 text-white shadow-lg">
                <p className="text-xs">{getTooltipText(activeTool)}</p>
                <p className="text-xs text-gray-300 mt-1">快捷鍵: Ctrl+Enter</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Mode Toggle & Tabs Navigation */}
        <div className="flex items-center gap-2">
          <SearchShortcutHelp />
          <SettingsDialog />
          <ModeToggle />

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <Tabs value={activeTool} className="p-0 m-0">
              <TabsList className="backdrop-blur-sm p-1 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm">
                <TabsTrigger value="keyword" data-state={activeTool === "keyword" ? "active" : "inactive"} asChild>
                  <Link
                    href="/tools/keyword"
                    className="text-sm font-medium px-3 py-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center"
                  >
                    {getToolIcon("keyword")}
                    {getToolDisplayName("keyword")}
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="url" data-state={activeTool === "url" ? "active" : "inactive"} asChild>
                  <Link
                    href="/tools/url"
                    className="text-sm font-medium px-3 py-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center"
                  >
                    {getToolIcon("url")}
                    {getToolDisplayName("url")}
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="serp" data-state={activeTool === "serp" ? "active" : "inactive"} asChild>
                  <Link
                    href="/tools/serp"
                    className="text-sm font-medium px-3 py-1 rounded-full data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm flex items-center"
                  >
                    {getToolIcon("serp")}
                    {getToolDisplayName("serp")}
                  </Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Mobile Navigation Toggle */}
          <button
            className="md:hidden p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-md">
          <nav className="flex flex-col p-2">
            <Link
              href="/tools/keyword"
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeTool === "keyword" ? "bg-blue-500 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {getToolIcon("keyword")}
              {getToolDisplayName("keyword")}
            </Link>
            <Link
              href="/tools/url"
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeTool === "url" ? "bg-blue-500 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {getToolIcon("url")}
              {getToolDisplayName("url")}
            </Link>
            <Link
              href="/tools/serp"
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${activeTool === "serp" ? "bg-blue-500 text-white" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {getToolIcon("serp")}
              {getToolDisplayName("serp")}
            </Link>

            {/* Display region and language on mobile */}
            <div className="mt-2 px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">地區:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                {region}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">語言:</span>
              <span className="px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                {language ? language.replace("_", "-") : "zh-TW"}
              </span>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content Area for Tool Pages */}
      <div className="flex-grow p-3 overflow-auto transition-all duration-200">{children}</div>
    </div>
  )
}

