"use client"

import type React from "react"

import KeywordHistoryList from "@/app/tools/keyword/components/KeywordHistoryList"
import SerpAnalysisTab from "@/app/tools/keyword/components/serp-sidebar/SerpAnalysisTab"
import { RightSidebar } from "@/components/layout/RightSidebar"
import { Button } from "@/components/ui/button"
import { usePastQueryStore, type PastQueryStore } from "@/store/pastQueryStore"
import { useSettingsStore } from "@/store/settingsStore"
import { useTabStore } from "@/store/tabStore"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const activeTab = useTabStore((store) => store.state.activeTab)
  const selectedHistoryDetail = usePastQueryStore((store: PastQueryStore) => store.state.selectedHistoryDetail)
  const settingsRegion = useSettingsStore((store) => store.state.region)
  const settingsLanguage = useSettingsStore((store) => store.state.language)
  const settingsRegions = useSettingsStore((store) => store.state.regions)
  const settingsLanguages = useSettingsStore((store) => store.state.languages)
  const settingsActions = useSettingsStore((store) => store.actions)

  // Load sidebar state from localStorage on client side
  useEffect(() => {
    const savedLeftState = localStorage.getItem("leftSidebarOpen")
    const savedRightState = localStorage.getItem("rightSidebarOpen")

    if (savedLeftState !== null) {
      setLeftSidebarOpen(savedLeftState === "true")
    }

    if (savedRightState !== null) {
      setRightSidebarOpen(savedRightState === "true")
    }
  }, [])

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("leftSidebarOpen", String(leftSidebarOpen))
    localStorage.setItem("rightSidebarOpen", String(rightSidebarOpen))
  }, [leftSidebarOpen, rightSidebarOpen])

  // Auto-open Right Sidebar - Depend on a boolean derived value
  const shouldOpenRightSidebar = !!selectedHistoryDetail?.searchResults;
  useEffect(() => {
    if (shouldOpenRightSidebar) { 
      setRightSidebarOpen(true)
    }
  }, [shouldOpenRightSidebar])

  // Helper function (might be needed by SerpAnalysisTab)
  const convertToLanguage = (lang: string): "zh-TW" | "en-US" => {
    const normalizedLang = lang.replace("_", "-")
    if (normalizedLang === "zh-TW" || normalizedLang === "en-US") {
      return normalizedLang as "zh-TW" | "en-US"
    }
    return "zh-TW"
  }

  return (
    <div className="flex min-h-screen max-h-screen overflow-hidden bg-background">
      {/* Left sidebar - History - Width 0 on mobile, conditional width on md+ */}
      <aside
        className={`relative h-screen border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 overflow-hidden md:flex-shrink-0 ${leftSidebarOpen ? "w-0 md:w-64" : "w-0"}`}
      >
        {/* Content only shown when sidebar should be open AND on md+ screens */}
        {leftSidebarOpen && (
          <div className="flex flex-col h-full">
            <KeywordHistoryList />

            <div className="py-2 px-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">v1.0.0 © 2024</div>
              {/* Close button only visible on md+ */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hidden md:inline-flex" // Hide on mobile
                onClick={() => setLeftSidebarOpen(false)}
                title="收起側邊欄"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              </Button>
            </div>
          </div>
        )}

        {/* Toggle button when closed - Hide on mobile */}
        {!leftSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-0 h-8 w-4 rounded-r-md bg-white dark:bg-gray-900 border border-l-0 border-gray-200 dark:border-gray-800 hidden md:block" // Hide on mobile
            onClick={() => setLeftSidebarOpen(true)}
            title="展開側邊欄"
          >
            <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </Button>
        )}
      </aside>

      {/* Main content area */}
      <main className="flex-grow h-screen overflow-auto relative">{children}</main>

      {/* Right sidebar - Render SerpAnalysisTab - Width 0 on mobile, conditional width on md+ */}
      <aside
        className={`relative h-screen border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 overflow-hidden md:flex-shrink-0 ${rightSidebarOpen ? "w-0 md:w-72" : "w-0"}`}
      >
        {/* RightSidebar component does not take className directly */}
        <RightSidebar isOpen={rightSidebarOpen} onToggle={() => setRightSidebarOpen(!rightSidebarOpen)}>
          {selectedHistoryDetail && (
            <div className="p-4 overflow-y-auto h-full">
              <SerpAnalysisTab
                region={selectedHistoryDetail.region || settingsRegion}
                language={selectedHistoryDetail.language || settingsLanguage}
                regions={settingsRegions}
                languages={settingsLanguages}
                onRegionChange={settingsActions.setRegion}
                onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
                selectedHistoryDetail={selectedHistoryDetail}
                onHistoryLoaded={() => {}}
                activeTab={"keyword"}
              />
            </div>
          )}
        </RightSidebar>
      </aside>
    </div>
  )
}

