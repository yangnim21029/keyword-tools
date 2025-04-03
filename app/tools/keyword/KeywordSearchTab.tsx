"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { fetchSearchVolume, performSemanticClustering, saveKeywordResearch } from "@/app/actions"
import { detectChineseType } from "@/app/services/KeywordDataService"
import type { KeywordClusters, KeywordVolumeItem, KeywordVolumeResult } from "@/app/types"
import type { SortField, SortState } from "@/app/types/keywordTool.d"
import { EmptyState } from "@/components/tools/EmptyState"
import { LoadingButton } from "@/components/ui/LoadingButton"
import { usePastQueryStore, type PastQueryStore } from "@/store/pastQueryStore"
import { useQueryStore, type QueryStore } from "@/store/queryStore"
import KeywordClustering from "../keyword/KeywordClustering"
import KeywordResults from "./components/KeywordResults"

interface KeywordSearchTabProps {
  inputType: 'keyword' | 'url'
  region: string
  language: string
  regions: Record<string, string>
  languages: Record<string, string>
  onRegionChange: (region: string) => void
  onLanguageChange: (language: string) => void
  filterZeroVolume: boolean
  maxResults: number
  useAlphabet: boolean
  useSymbols: boolean
  currentSuggestions?: string[]
  currentVolumeData?: KeywordVolumeItem[]
  selectedHistoryDetail?: any
  onHistoryLoaded?: (history: any) => void
}

export default function KeywordSearchTab({
  inputType,
  region,
  language,
  regions,
  languages,
  onRegionChange,
  onLanguageChange,
  filterZeroVolume,
  maxResults,
  useAlphabet,
  useSymbols,
  currentSuggestions,
  currentVolumeData,
  selectedHistoryDetail,
  onHistoryLoaded,
}: KeywordSearchTabProps) {
  const [step, setStep] = useState<"input" | "suggestions" | "volumes" | "clusters">("input")
  const [error, setError] = useState<string | null>(null)
  const [clusters, setClusters] = useState<KeywordClusters | null>(null)
  const [sortState, setSortState] = useState<SortState>({ field: "searchVolume", direction: "desc" })

  // --- Store Hooks --- 
  // Select individual primitive values from QueryStore
  const isLoading = useQueryStore((state: QueryStore) => state.state.isLoading);
  const searchInput = useQueryStore((state: QueryStore) => state.state.searchInput);
  const loadingText = useQueryStore((state: QueryStore) => state.state.loadingMessage ?? "");
  const setGlobalLoading = useQueryStore((state: QueryStore) => state.actions.setLoading);
  const historyActions = usePastQueryStore((state: PastQueryStore) => state.actions);

  useEffect(() => {
    setStep("input")
    setError(null)
    setClusters(null)
  }, [inputType])

  useEffect(() => {
    if (currentVolumeData && currentVolumeData.length > 0) {
      setStep("volumes")
      if (selectedHistoryDetail?.clusters && Object.keys(selectedHistoryDetail.clusters).length > 0) {
        setClusters(selectedHistoryDetail.clusters)
        setStep("clusters")
      }
    } else if (currentSuggestions && currentSuggestions.length > 0) {
      setStep("suggestions")
    } else if (!isLoading && !error) {
    }
    if (selectedHistoryDetail && !(selectedHistoryDetail.clusters && Object.keys(selectedHistoryDetail.clusters).length > 0)) {
        setClusters(null)
    }
  }, [currentSuggestions, currentVolumeData, isLoading, error, selectedHistoryDetail])

  const handleGetVolumes = useCallback(async () => {
    if (!currentSuggestions || currentSuggestions.length === 0) {
      toast.warning("沒有可用的關鍵詞建議")
      return
    }
    const keywords = currentSuggestions
    const limitedKeywords = keywords.slice(0, maxResults > 0 ? maxResults : keywords.length)
    
    setGlobalLoading(true, `獲取搜索量數據中...`)
    setError(null)
    setStep("volumes")

    try {
      const result: KeywordVolumeResult = await fetchSearchVolume(
        limitedKeywords,
        region,
        inputType === 'url' ? searchInput : undefined,
        language
      )
      if (result.sourceInfo) {
        toast.info(result.sourceInfo)
      }
      if (result.error) {
        throw new Error(result.error)
      }

      let volumeDataResults = result.results || []

      if (detectChineseType(searchInput) !== "simplified") {
        volumeDataResults = volumeDataResults.filter((item: KeywordVolumeItem) => {
          const itemType = detectChineseType(item?.text || "")
          return item?.text && (itemType === "traditional" || itemType === "mixed" || itemType === "none")
        })
      }

      if (filterZeroVolume) {
        volumeDataResults = volumeDataResults.filter((item) => (item.searchVolume ?? 0) > 0)
      }

      if (searchInput) {
        try {
          setGlobalLoading(true, "正在保存搜索數據...")
          const saveData = result.results || []
          const saveResult = await saveKeywordResearch(
            searchInput,
            region,
            language,
            keywords,
            saveData as any[],
            clusters
          )
          if (saveResult.historyId) {
            console.log("搜索結果已保存到歷史記錄:", saveResult.historyId)
            historyActions.setSelectedHistoryId(saveResult.historyId)
            toast.success("搜索結果已保存")
          } else {
            console.error("保存搜索結果失敗:", saveResult.error)
            toast.error(`保存失敗: ${saveResult.error}`)
          }
        } catch (saveError) {
          console.error("保存到歷史記錄時出錯:", saveError)
          toast.error("保存到歷史記錄時出錯")
        } finally {
          setGlobalLoading(false)
        }
      }
    } catch (error) {
      console.error("獲取搜索量失敗:", error)
      const message = error instanceof Error ? error.message : "獲取搜索量失敗，請稍後再試"
      if (!message.startsWith("數據來源:")) {
        toast.error(message)
      }
      setError(message)
      setStep("suggestions")
    } finally {
      setGlobalLoading(false)
    }
  }, [
    currentSuggestions,
    region,
    language,
    filterZeroVolume,
    maxResults,
    setGlobalLoading,
    setStep,
    setError,
    clusters,
    historyActions,
    inputType,
    searchInput
  ])

  const handleKeywordCardClick = useCallback((keywordText: string) => {
    if (!keywordText) return;
    navigator.clipboard.writeText(keywordText)
      .then(() => {
        toast.success(`已複製關鍵詞: ${keywordText}`);
      })
      .catch(err => {
        console.error("無法複製關鍵詞:", err);
        toast.error("複製失敗");
      });
  }, []);

  const handleClustering = useCallback(async () => {
    const volumeResults = currentVolumeData
    if (!volumeResults || volumeResults.length < 5) {
      toast.warning("至少需要 5 個關鍵詞才能進行分群")
      return
    }
    setGlobalLoading(true, "請求 AI 分群中...")
    setClusters(null)
    setError(null)
    try {
      const keywords = volumeResults.map((item) => item.text).filter(Boolean)
      if (keywords.length < 5) {
         toast.warning("過濾後有效關鍵詞不足 5 個，無法分群")
         setGlobalLoading(false)
         return
      }

      const result: { clusters: KeywordClusters } = await performSemanticClustering({ 
        keywords: keywords.slice(0, 80),
      })

      console.log("語意分群結果:", result)
      setClusters(result.clusters)
      setStep("clusters")
      toast.success(`成功生成 ${Object.keys(result.clusters).length} 個關鍵詞分群`)
      
      if (selectedHistoryDetail?.id) {
        try {
           await historyActions.saveClusteringResults(selectedHistoryDetail.id, result.clusters)
           toast.info("分群結果已更新至歷史記錄")
        } catch (updateError) {
           toast.error("更新歷史失敗")
        }
      }
    } catch (error) {
      console.error("語意分群失敗:", error)
      const message = error instanceof Error ? error.message : "語意分群失敗，請稍後再試"
      toast.error(message)
      setError(message)
    } finally {
      setGlobalLoading(false)
    }
  }, [
    currentVolumeData,
    setGlobalLoading,
    setClusters,
    setStep,
    setError,
    historyActions,
    selectedHistoryDetail?.id
  ])

  const handleSortChange = (field: SortField) => {
    setSortState((prevState: SortState) => ({
      field,
      direction: prevState.field === field && prevState.direction === "desc" ? "asc" : "desc",
    }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {isLoading && (
            <div className="p-4 text-center">{loadingText || "處理中..."}</div>
        )}
        {error && <div className="p-4 text-red-500">錯誤: {error}</div>}

        {step === 'suggestions' && currentSuggestions && currentSuggestions.length > 0 && (
            <div className="border rounded-md p-4 bg-muted/20">
              <h3 className="text-lg font-semibold mb-2">關鍵詞建議 ({currentSuggestions.length})</h3>
              <div className="text-sm text-muted-foreground mb-2">正在獲取搜索量...</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {currentSuggestions.slice(0, 20).map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
                {currentSuggestions.length > 20 && <li>... 等等</li>}
              </ul>
            </div>
        )}

        {(step === 'volumes' || step === 'clusters') && currentVolumeData && currentVolumeData.length > 0 && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              {step === 'volumes' && currentVolumeData.length >= 5 && (
                  <LoadingButton onClick={handleClustering} isLoading={isLoading} disabled={isLoading}>
                      語意分群
                  </LoadingButton>
              )}
            </div>
            
            <KeywordResults 
              volumeData={currentVolumeData} 
              sortState={sortState} 
              filterZeroVolume={filterZeroVolume}
              maxResults={maxResults}
              onKeywordClick={handleKeywordCardClick}
              onSort={handleSortChange}
            />

            {step === 'clusters' && clusters && (
              <KeywordClustering />
            )}
          </div>
        )}
        {(step === 'volumes' || step === 'clusters') && (!currentVolumeData || currentVolumeData.length === 0) && !isLoading && !error && (
             <EmptyState title="找不到相關的搜索量數據" description="嘗試不同的關鍵詞或檢查您的輸入。" />
        )}
      </div>
    </div>
  )
}

