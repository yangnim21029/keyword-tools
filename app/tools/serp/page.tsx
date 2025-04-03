"use client"

import { ToolHeader } from "@/components/tools/ToolHeader"
import { useQueryStore } from "@/providers/QueryProvider"
import { usePastQueryStore } from "@/store/pastQueryStore"
import { useSettingsStore } from "@/store/settingsStore"
import { LayoutGrid } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import SerpAnalysisTab from "./SerpAnalysisTab"

export default function SerpToolPage() {
  const settingsState = useSettingsStore((store) => store.state)
  const settingsActions = useSettingsStore((store) => store.actions)
  const historyState = usePastQueryStore((store) => store.state)
  const { searchInput, lastTriggeredSearch } = useQueryStore((store) => store.state)
  const setQueryLoading = useQueryStore((store) => store.actions.setLoading)

  const processedTimestampRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      lastTriggeredSearch &&
      lastTriggeredSearch.tool === "serp" &&
      lastTriggeredSearch.timestamp !== processedTimestampRef.current
    ) {
      console.log("[SerpPage] Detected global search trigger:", lastTriggeredSearch)
      processedTimestampRef.current = lastTriggeredSearch.timestamp

      handleAnalyzeSerp(lastTriggeredSearch.query)
    }
  }, [lastTriggeredSearch])

  const handleAnalyzeSerp = async (query: string) => {
    if (!query.trim()) {
      console.log("[SerpPage] Triggered with empty query, skipping.")
      return
    }
    console.log("[SerpPage] Starting analysis for SERP query:", query)
    setQueryLoading(true, "分析SERP中...")

    try {
      // Trigger the hidden submit button in SerpAnalysisTab
      const submitButton = document.getElementById("serp-analysis-submit")
      if (submitButton) {
        submitButton.click()
      } else {
        console.warn("[SerpPage] Could not find serp-analysis-submit button")
        toast.info("SERP 分析功能準備中")
      }
    } catch (error) {
      console.error("[SerpPage] Unexpected analysis error:", error)
      const message = error instanceof Error ? error.message : "SERP 分析時發生未知錯誤"
      toast.error(message)
      setQueryLoading(false)
    }
  }

  // Helper function
  const convertToLanguage = (lang: string): "zh-TW" | "en-US" => {
    const normalizedLang = lang.replace("_", "-")
    if (normalizedLang === "zh-TW" || normalizedLang === "en-US") {
      return normalizedLang as "zh-TW" | "en-US"
    }
    return "zh-TW"
  }

  return (
    <>
      <ToolHeader
        title="SERP 分析工具"
        description="分析搜索引擎結果頁面，了解競爭情況和排名機會。"
        activeTool="serp"
        region={settingsState.region}
        language={settingsState.language}
        icon={<LayoutGrid className="h-5 w-5 text-purple-500" />}
      />

      <SerpAnalysisTab
        region={settingsState.region}
        language={settingsState.language}
        regions={settingsState.regions}
        languages={settingsState.languages}
        onRegionChange={settingsActions.setRegion}
        onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
        selectedHistoryDetail={historyState.selectedHistoryDetail}
        onHistoryLoaded={() => {
          /* Handle history loaded if necessary */
        }}
        globalSearchInput={searchInput}
        activeTab="serp"
      />
    </>
  )
}

