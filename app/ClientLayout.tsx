"use client"

import type React from "react"

import KeywordHistoryList from "@/app/history/search/KeywordHistoryList"
import SerpAnalysisComponent from "@/app/tools/serp/serp-analysis/SerpAnalysisComponent"
import { RightSidebar } from "@/components/layout/RightSidebar"
import { Button } from "@/components/ui/button"
import { usePastQueryStore } from "@/store/pastQueryStore"
import { useTabStore } from "@/store/tabStore"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)

  const { activeTab } = useTabStore((store) => store.state)
  const { selectedHistoryDetail } = usePastQueryStore((store) => store.state)

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

  // Auto-open right sidebar when SERP results are available
  useEffect(() => {
    if (activeTab === "serp" && selectedHistoryDetail?.searchResults) {
      setRightSidebarOpen(true)
    }
  }, [activeTab, selectedHistoryDetail])

  return (
    <div className="flex min-h-screen max-h-screen overflow-hidden bg-background">
      {/* Left sidebar - History */}
      <aside
        className={`relative flex-shrink-0 h-screen border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 ${
          leftSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        {leftSidebarOpen && (
          <div className="flex flex-col h-full">
            <KeywordHistoryList />

            <div className="py-2 px-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">v1.0.0 © 2024</div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full"
                onClick={() => setLeftSidebarOpen(false)}
                title="收起側邊欄"
              >
                <ChevronLeft className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
              </Button>
            </div>
          </div>
        )}

        {/* Toggle button when closed */}
        {!leftSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-0 h-8 w-4 rounded-r-md bg-white dark:bg-gray-900 border border-l-0 border-gray-200 dark:border-gray-800"
            onClick={() => setLeftSidebarOpen(true)}
            title="展開側邊欄"
          >
            <ChevronRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
          </Button>
        )}
      </aside>

      {/* Main content area */}
      <main className="flex-grow h-screen overflow-auto relative">{children}</main>

      {/* Right sidebar - Documentation and SERP Results */}
      <aside
        className={`relative flex-shrink-0 h-screen border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 transition-all duration-300 ${
          rightSidebarOpen ? "w-72" : "w-0"
        }`}
      >
        <RightSidebar isOpen={rightSidebarOpen} onToggle={() => setRightSidebarOpen(!rightSidebarOpen)}>
          {activeTab === "serp" && selectedHistoryDetail?.searchResults && (
            <div className="p-2">
              <SerpAnalysisComponent
                data={{
                  results: selectedHistoryDetail.searchResults,
                  analysis: {
                    totalResults: selectedHistoryDetail.searchResults.length,
                    domains: {},
                    topDomains: [],
                    avgTitleLength: 0,
                    avgDescriptionLength: 0
                  },
                  timestamp: new Date().toISOString(),
                  originalQuery: selectedHistoryDetail.mainKeyword || ""
                }}
                language={selectedHistoryDetail.language}
              />
            </div>
          )}
        </RightSidebar>
      </aside>
    </div>
  )
}

