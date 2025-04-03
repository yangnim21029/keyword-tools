"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { getKeywordSuggestions } from "@/app/actions"
import { detectChineseType, getSearchVolume } from "@/app/services/KeywordDataService"
import type { SuggestionsResult } from "@/app/types"
import { EmptyState } from "@/components/tools/EmptyState"
import type { KeywordVolumeItem } from "@/lib/schemas"
import { usePastQueryStore } from "@/store/pastQueryStore"
import { useQueryStore } from "@/store/queryStore"
import { useSettingsStore } from "@/store/settingsStore"
import type { SortField, SortState } from "@/types/keywordTool.d"
import { BarChart2 } from "lucide-react"
import KeywordResults from "./components/KeywordResults"
import KeywordClustering from "./KeywordClustering"

interface KeywordSearchTabProps {
  activeTab: "keyword" | "url" | "serp" | "settings"
  onHistoryUpdate?: (newHistory: any) => void
  globalSearchInput?: string

  // 這些屬性是從父組件傳遞的，但實際上我們可以直接從Provider獲取
  // 以下屬性可以在組件內部從Provider獲取，但為了向後兼容性暫時保留
  region?: string
  language?: string
  regions?: Record<string, string>
  languages?: Record<string, string>
  onRegionChange?: (region: string) => void
  onLanguageChange?: (language: string) => void
  filterZeroVolume?: boolean
  maxResults?: number
  useAlphabet?: boolean
  useSymbols?: boolean

  // --- Add new props for current search results ---
  currentSuggestions?: string[]
  currentVolumeData?: KeywordVolumeItem[]
}

const MAX_KEYWORDS_FOR_VOLUME = 100

interface ClusteringContext {
  query: string
  region: string
  language: string
  historyIdToUpdate: string | null | undefined
  suggestions: string[]
  volumeData: KeywordVolumeItem[]
}

// 修改 ResultTab 類型定義，只保留 volume 選項
type ResultTab = "volume" | "cluster"

export default function KeywordSearchTab({
  activeTab,
  onHistoryUpdate,
  globalSearchInput,
  // 使用可選參數，如果不提供會從Provider獲取
  region: propRegion,
  language: propLanguage,
  regions: propRegions,
  languages: propLanguages,
  onRegionChange,
  onLanguageChange,
  filterZeroVolume: propFilterZeroVolume,
  maxResults: propMaxResults,
  useAlphabet: propUseAlphabet,
  useSymbols: propUseSymbols,
  currentSuggestions,
  currentVolumeData,
}: KeywordSearchTabProps) {
  // 狀態管理
  const [query, setQuery] = useState("")
  const [step, setStep] = useState<"input" | "suggestions" | "volumes" | "clusters">("input")
  const [error, setError] = useState<string | null>(null)
  const [sortState, setSortState] = useState<SortState>({ field: "searchVolume" as SortField, direction: "desc" })
  const [clusterSource, setClusterSource] = useState<"new" | "history" | null>(null)
  const [clusteringContext, setClusteringContext] = useState<ClusteringContext | null>(null)
  const [showClustering, setShowClustering] = useState<boolean>(true)

  // 從Provider獲取設置，但如果props提供了則優先使用props
  const settingsState = useSettingsStore((state) => state.state)
  const settingsActions = useSettingsStore((state) => state.actions)

  // 優先使用props，如果沒有則從Provider獲取
  const region = propRegion ?? settingsState.region
  const language = propLanguage ?? settingsState.language
  const regions = propRegions ?? settingsState.regions
  const languages = propLanguages ?? settingsState.languages
  const filterZeroVolume = propFilterZeroVolume ?? settingsState.filterZeroVolume
  const maxResults = propMaxResults ?? settingsState.maxResults
  const useAlphabet = propUseAlphabet ?? settingsState.useAlphabet
  const useSymbols = propUseSymbols ?? settingsState.useSymbols

  const isLoading = useQueryStore((state) => state.state.isLoading)
  const loadingText = useQueryStore((state) => state.state.loadingMessage) ?? ""
  const setGlobalLoading = useQueryStore((state) => state.actions.setLoading)

  const historyState = usePastQueryStore((store) => store.state)
  const historyActions = usePastQueryStore((store) => store.actions)

  const selectedHistoryDetail = historyState.selectedHistoryDetail

  // 處理區域和語言變更
  const handleRegionChange = (newRegion: string) => {
    if (onRegionChange) {
      onRegionChange(newRegion)
    } else {
      settingsActions.setRegion(newRegion)
    }
  }

  const handleLanguageChange = (newLanguage: string) => {
    if (onLanguageChange) {
      onLanguageChange(newLanguage)
    } else {
      // 這裡需要處理類型轉換，因為設置Store期望一個特定的Language類型
      if (newLanguage === "zh-TW" || newLanguage === "en-US") {
        settingsActions.setLanguage(newLanguage)
      }
    }
  }

  // 重設搜索狀態
  const resetSearchState = useCallback(() => {
    setError(null)
    setStep("input")
    setClusterSource(null)
    setClusteringContext(null)
    historyActions.clearSelectedHistoryDetail()
  }, [historyActions])

  // 同步 Session Storage 的函數
  const syncSessionStorage = useCallback(
    (dataToSync?: KeywordVolumeItem[]) => {
      const data = dataToSync ?? currentVolumeData
      if (typeof window !== "undefined" && data && data.length > 0) {
        try {
          // 保存volumeData到session storage
          sessionStorage.setItem("keyword-volume-data", JSON.stringify(data))

          // 從搜索結果中提取有效的關鍵詞
          const keywordsForClustering = data.map((item) => item.text || "").filter(Boolean)

          // 確保關鍵詞不包含重複項
          const uniqueKeywords = Array.from(new Set(keywordsForClustering))

          // 保存關鍵詞列表到session storage
          sessionStorage.setItem("clustering-keywords", JSON.stringify(uniqueKeywords))
        } catch (e) {
          console.error("[KeywordSearchTab] 無法同步 session storage:", e)
        }
      }
    },
    [currentVolumeData],
  )

  // 同步歷史記錄
  useEffect(() => {
    if (selectedHistoryDetail) {
      setQuery(selectedHistoryDetail.mainKeyword || "")
      // Reset step to avoid confusion with previous searches
      setStep("input")

      // Optionally sync session storage if clustering needs it
      if (selectedHistoryDetail.searchResults && selectedHistoryDetail.searchResults.length > 0) {
        syncSessionStorage(selectedHistoryDetail.searchResults)
      }
    }
  }, [selectedHistoryDetail, syncSessionStorage])

  // 處理獲取搜索量
  const handleGetVolumes = useCallback(
    async (keywordStrings?: string[], currentQuery?: string) => {
      const keywords = keywordStrings ?? currentSuggestions
      const queryToUse = currentQuery ?? query
      if (!keywords || keywords.length === 0) {
        setStep("suggestions")
        return
      }
      const limitedKeywords = keywords.slice(0, MAX_KEYWORDS_FOR_VOLUME)
      if (limitedKeywords.length < keywords.length) {
        toast.info(`關鍵詞 > ${MAX_KEYWORDS_FOR_VOLUME}，僅處理前 ${MAX_KEYWORDS_FOR_VOLUME}`)
      }

      setGlobalLoading(true, `正在獲取 ${limitedKeywords.length} 個關鍵詞搜索量...`)
      setError(null)
      setStep("volumes")

      try {
        const volumeResult = await getSearchVolume(limitedKeywords, region, language, queryToUse)

        if (volumeResult.sourceInfo) {
          toast.info(volumeResult.sourceInfo)
        }
        if (volumeResult.error) {
          throw new Error(volumeResult.error)
        }

        // 使用直接的結果數據
        let volumeDataResults = volumeResult.results || []

        if (detectChineseType(queryToUse) !== "simplified") {
          volumeDataResults = volumeDataResults.filter((item: KeywordVolumeItem) => {
            const itemType = detectChineseType(item?.text || "")
            return item?.text && (itemType === "traditional" || itemType === "mixed" || itemType === "none")
          })
        }

        setError(null)

        const currentContext: ClusteringContext = {
          query: queryToUse,
          region: region,
          language: language,
          historyIdToUpdate: selectedHistoryDetail?.id,
          suggestions: keywords,
          volumeData: volumeDataResults,
        }
        setClusteringContext(currentContext)

        // 同步到 sessionStorage
        syncSessionStorage(volumeDataResults)

        // 自動保存到歷史記錄
        try {
          setGlobalLoading(true, "正在保存搜索數據...")

          // Import and use saveKeywordResearch
          const { saveKeywordResearch } = await import("@/app/actions")
          const result = await saveKeywordResearch(queryToUse, region, language, keywords, volumeDataResults, {})

          if (result.historyId) {
            toast.success("搜索量數據已自動保存")

            // 刷新歷史記錄列表
            await historyActions.fetchHistories()

            // 可選：直接選擇新創建的歷史記錄
            if (result.historyId) {
              historyActions.setSelectedHistoryId(result.historyId)
            }
          } else {
            console.error("[Component] 自動儲存數據失敗:", result.error)
          }
        } catch (saveError) {
          console.error("[Component] 自動儲存過程中出錯:", saveError)
        } finally {
          setGlobalLoading(false)
        }

        // 更新歷史記錄
        if (onHistoryUpdate) {
          onHistoryUpdate({
            mainKeyword: queryToUse,
            region,
            language,
            suggestions: keywords,
            searchResults: volumeDataResults,
          })
        }
      } catch (err: any) {
        console.error("[Component Error] Getting volumes:", err)
        const errorMessage = err.message || "獲取搜索量錯誤"
        if (!errorMessage.startsWith("數據來源:")) {
          toast.error(errorMessage)
        }
        setError(errorMessage)
        setStep(keywords.length > 0 ? "suggestions" : "input")
        setGlobalLoading(false)
      }
    },
    [
      region,
      language,
      setGlobalLoading,
      selectedHistoryDetail?.id,
      onHistoryUpdate,
      syncSessionStorage,
      historyActions,
      currentSuggestions,
      query,
    ],
  )

  // 處理獲取建議
  const handleGetSuggestions = useCallback(
    async (searchQuery?: string) => {
      const currentQuery = (searchQuery || query).trim()
      if (!currentQuery || !region || !language) {
        setError("請輸入關鍵詞並選擇地區和語言")
        return
      }
      historyActions.clearSelectedHistoryDetail()
      resetSearchState()
      setGlobalLoading(true, "正在獲取建議...")
      setError(null)
      setStep("suggestions")

      try {
        const suggestionResult: SuggestionsResult = await getKeywordSuggestions(
          currentQuery,
          region,
          language,
          useAlphabet,
          useSymbols,
        )

        if (suggestionResult.sourceInfo) {
          toast.info(suggestionResult.sourceInfo)
        }
        if (suggestionResult.error) {
          throw new Error(suggestionResult.error)
        }

        if (suggestionResult.suggestions && suggestionResult.suggestions.length > 0) {
          setError(null)
          await handleGetVolumes(suggestionResult.suggestions, currentQuery)
        } else {
          setStep("input")
          toast.info("未找到建議")
          setGlobalLoading(false)
        }
      } catch (err: any) {
        console.error("[Component Error] Getting suggestions:", err)
        const errorMessage = err.message || "獲取建議錯誤"
        if (!errorMessage.startsWith("數據來源:")) {
          toast.error(errorMessage)
        }
        setError(errorMessage)
        setStep("input")
        setGlobalLoading(false)
      }
    },
    [
      region,
      language,
      useAlphabet,
      useSymbols,
      query,
      historyActions,
      resetSearchState,
      setGlobalLoading,
      handleGetVolumes,
    ],
  )

  // 排序邏輯
  const handleSort = useCallback((field: SortField) => {
    setSortState((prevState) => ({
      field,
      direction: prevState.field === field && prevState.direction === "desc" ? "asc" : "desc",
    }))
  }, [])

  // 修改更新結果選項卡的 useEffect
  useEffect(() => {
    // 切換到關鍵詞視圖
    setShowClustering(false)
  }, [step])

  // 修改同步全局搜索输入的useEffect
  useEffect(() => {
    if (globalSearchInput !== undefined && activeTab === "keyword") {
      // 只更新query值，但不自动触发搜索
      setQuery(globalSearchInput)
    }
  }, [globalSearchInput, activeTab])

  // 添加搜索按钮的监听器
  useEffect(() => {
    const handleSearchButtonClick = () => {
      if (activeTab === "keyword" && query.trim()) {
        handleGetSuggestions(query)
      }
    }

    // 添加自定义事件监听器
    window.addEventListener("search-button-click", handleSearchButtonClick)

    return () => {
      window.removeEventListener("search-button-click", handleSearchButtonClick)
    }
  }, [activeTab, query, handleGetSuggestions])

  const hasVolumeResults = (currentVolumeData?.length ?? 0) > 0

  // 處理關鍵詞卡片點擊
  const handleKeywordCardClick = useCallback((keywordText: string) => {
    toast.success(`已複製關鍵詞: ${keywordText}`)
    navigator.clipboard.writeText(keywordText)
  }, [])

  // 檢查是否已有分群結果
  const hasClusters = selectedHistoryDetail?.clusters && Object.keys(selectedHistoryDetail.clusters).length > 0

  // 返回 JSX 元素
  return (
    <div className="flex flex-col space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* If no results and not loading, show empty state */}
      {!hasVolumeResults && !isLoading && step === "input" && (
        <EmptyState
          title="尚未進行關鍵詞搜索"
          description="輸入關鍵詞並點擊搜索按鈕，獲取相關關鍵詞和搜索量數據。"
          icon={<BarChart2 className="h-12 w-12 text-gray-300 dark:text-gray-700" />}
          actionLabel="了解更多關鍵詞工具"
          onAction={() => window.open("https://example.com/keyword-tool-guide", "_blank")}
        />
      )}

      {/* Always show clustering component */}
      {!isLoading && (
        <div className="mb-4">
          <KeywordClustering />
        </div>
      )}

      {/* Show keyword cards only if we have results */}
      {hasVolumeResults && !isLoading && (
        <KeywordResults
          volumeData={currentVolumeData || []}
          sortState={sortState}
          filterZeroVolume={filterZeroVolume}
          maxResults={maxResults}
          onKeywordClick={handleKeywordCardClick}
        />
      )}
    </div>
  )
}

