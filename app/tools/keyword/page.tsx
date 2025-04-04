"use client"

// Optimize imports
import { ToolHeader } from "./ToolHeader";
// Providers are usually used in layout, maybe import store hooks directly?
// import { usePastQueryStore } from "@/providers/PastQueryProvider" 
// import { useQueryStore } from "@/providers/QueryProvider"
import type { KeywordVolumeItem, KeywordVolumeResult } from "@/app/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryStore } from '@/providers/QueryProvider';
import { useResearchStore } from "@/store/keywordResearchStore";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Actions
import {
  fetchSearchVolume
} from "@/app/actions";
import { generateUserPersonaFromClusters } from "@/app/actions/generatePersona";
import { detectChineseType } from "@/app/services/KeywordDataService";

// Internal Components
import type { SortField, SortState } from "@/app/types/keywordTool.d";
import { LoadingButton } from "@/components/ui/LoadingButton";
import KeywordResults from "./components/KeywordResults";
import { EmptyState } from "./EmptyState";
import KeywordClustering from "./KeywordClustering";
// Import the context hook from the correct provider path
import { useLayoutWidth } from "@/providers/LayoutWidthProvider";

// Corrected import path for types - FINAL ATTEMPT
import {
  type Keyword
} from "@/app/types/keyword-research.types";

export default function KeywordToolPage() {
  // Access stores directly
  const settingsState = useSettingsStore((store) => store.state)
  const {
    queryInput,
    lastTriggeredQuery,
    isLoading: isQueryLoading,
    error: queryError,
    suggestions: querySuggestions,
    volumeData: queryVolumeData,
    loadingMessage: queryLoadingMessage
  } = useQueryStore((store) => store.state)
  const {
    handleQuerySubmit, 
    // Actions needed to update QueryStore from history
    setQueryInput, 
    setSuggestions, 
    setVolumeData, 
    setLoading: setQueryLoading,
  } = useQueryStore((store) => store.actions)
  const { selectedResearchId, selectedResearchDetail } = useResearchStore((store) => store.state)
  const { 
    _handleResearchSavedOrUpdated,
    clearSelectedResearchDetail,
    setSelectedResearchId,
    saveClusters,
    savePersonas
  } = useResearchStore((store) => store.actions)

  const processedTimestampRef = useRef<number | null>(null)
  // State to track client-side mount and prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  const [clusteringTrigger, setClusteringTrigger] = useState<number>(0); // State to trigger clustering

  // Derived state
  const isUrl = queryInput?.startsWith('http') ?? false;
  const inputType = isUrl ? 'url' : 'keyword';
  const isLoading = isQueryLoading;
  const loadingText = queryLoadingMessage ?? "";

  // Step state
  const [step, setStep] = useState<"input" | "suggestions" | "volumes" | "clusters">("input")
  const [localError, setLocalError] = useState<string | null>(null)
  const [sortState, setSortState] = useState<SortState>({ field: "searchVolume", direction: "desc" })
  // Add state for model selection
  const [selectedModel, setSelectedModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [isClusteringLoading, setIsClusteringLoading] = useState(false); // <-- Add clustering loading state

  // Get layout width context
  const isWideLayout = useLayoutWidth();

  // Create keyword to cluster mapping
  const keywordToClusterMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (selectedResearchDetail?.clusters) {
      // Ensure clusters is an object before iterating
      if (typeof selectedResearchDetail.clusters === 'object' && selectedResearchDetail.clusters !== null) {
          for (const clusterName in selectedResearchDetail.clusters) {
            // Ensure the value is an array before iterating
            const keywordsInCluster = selectedResearchDetail.clusters[clusterName];
            if (Array.isArray(keywordsInCluster)) {
              keywordsInCluster.forEach((keyword: string) => {
                // Check if keyword is a non-empty string
                if (typeof keyword === 'string' && keyword.trim() !== '') {
                   map[keyword.trim()] = clusterName;
                }
              });
            }
          }
      }
    }
    return map;
  }, [selectedResearchDetail?.clusters]);

  // Create a map of lowercase keyword to volume for KeywordClustering
  const keywordVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    // Ensure queryVolumeData is an array before iterating
    if (Array.isArray(queryVolumeData)) {
      queryVolumeData.forEach(item => {
        // Ensure item and item.text are valid, and volume is a number
        const keywordText = (typeof item?.text === 'string') ? item.text.trim().toLowerCase() : '';
        const volume = (typeof item?.searchVolume === 'number') ? item.searchVolume : 0;
        if (keywordText) {
          map[keywordText] = volume;
        }
      });
    }
    return map;
  }, [queryVolumeData]); // Dependency on the raw volume data

  // Add clusterName to volume data
  const volumeDataWithCluster = useMemo(() => {
    // Ensure queryVolumeData is an array before mapping
    if (!Array.isArray(queryVolumeData)) {
        console.warn('[KeywordPage] queryVolumeData is not an array:', queryVolumeData);
        return []; // Return empty array if data is invalid
    }
    return queryVolumeData.map(item => {
        // Ensure item and item.text are valid before lookup
        const keywordText = (typeof item?.text === 'string') ? item.text.trim() : '';
        return {
            ...item,
            clusterName: keywordText ? keywordToClusterMap[keywordText] : undefined, // Add clusterName safely
        };
    });
  }, [queryVolumeData, keywordToClusterMap]);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Global Search Trigger Effect (Modified with more logging)
  useEffect(() => {
    ;(async () => {
      // Log current state *before* the condition check
      const currentTimestamp = lastTriggeredQuery?.timestamp;
      const processedTimestamp = processedTimestampRef.current;
      console.log('[KeywordPage Effect Check]', { 
        isMounted, 
        hasTrigger: !!lastTriggeredQuery,
        currentTimestamp, 
        processedTimestamp, 
        shouldProcess: isMounted && !!lastTriggeredQuery && currentTimestamp !== processedTimestamp 
      });

      if (
        isMounted &&
        lastTriggeredQuery &&
        currentTimestamp !== processedTimestamp // Use pre-calculated currentTimestamp
      ) {
        console.log(`[KeywordPage] Condition met. Processing trigger ${currentTimestamp}. Previously processed: ${processedTimestamp}`);
        
        // Update processed timestamp immediately *before* async operations
        // Use nullish coalescing to handle potential undefined timestamp
        processedTimestampRef.current = currentTimestamp ?? null;
        console.log(`[KeywordPage] Updated processedTimestampRef to: ${processedTimestampRef.current}`);

        console.log("[KeywordPage] Clearing selected research before new search.");
        clearSelectedResearchDetail(); // Clear selection first
        setLocalError(null);
        setStep("input");

        console.log(`[KeywordPage] >>> Calling handleQuerySubmit for trigger ${currentTimestamp}...`); // Log before call
        const newResearchId = await handleQuerySubmit({
          region: settingsState.region,
          language: settingsState.language,
          useAlphabet: settingsState.useAlphabet,
          useSymbols: settingsState.useSymbols,
        });
        console.log(`[KeywordPage] <<< handleQuerySubmit returned: ${newResearchId}`); // Log after call

        // If a new ID was successfully created, select it immediately
        if (newResearchId) {
          console.log(`[KeywordPage] New research created (${newResearchId}), selecting it.`);
          setSelectedResearchId(newResearchId);
          // Step will be updated by the 'Load Research Data Effect' below
        } else if (queryError) {
          console.log("[KeywordPage] Global search finished with error:", queryError);
          setLocalError(queryError);
        } else {
          console.log("[KeywordPage] Global search finished without creating a new record (or failed silently).");
        }
      } else {
        // Log why the condition was not met
        if (isMounted && lastTriggeredQuery && currentTimestamp === processedTimestamp) {
          console.log(`[KeywordPage] Trigger ${currentTimestamp} skipped, already processed.`);
        }
      }
    })()
    // Dependencies remain largely the same, add setSelectedResearchId
  }, [
    isMounted,
    lastTriggeredQuery, // The primary trigger
    handleQuerySubmit,  // Action
    settingsState.region, // Settings used in submit
    settingsState.language,
    settingsState.useAlphabet,
    settingsState.useSymbols,
    clearSelectedResearchDetail, // Action
    queryError, // State to react to errors
    setSelectedResearchId // Action
  ]);

  // Load Research Data Effect
  useEffect(() => {
    if (isMounted && selectedResearchDetail) {
      console.log("[KeywordPage] Research item selected/updated, updating state:", selectedResearchDetail.id);
      setQueryInput(selectedResearchDetail.query || "");
      setSuggestions(selectedResearchDetail.keywords?.map((k: Keyword) => k.text || '') || []);
      setVolumeData((selectedResearchDetail.keywords || []));
      processedTimestampRef.current = null;
      setLocalError(null);

      if (selectedResearchDetail.clusters && Object.keys(selectedResearchDetail.clusters).length > 0) {
        setStep("clusters");
      } else if (selectedResearchDetail.keywords && selectedResearchDetail.keywords.length > 0) {
        setStep("volumes");
      } else {
        setStep("input");
        console.log("[KeywordPage] Selected research has no keywords.");
      }

    } else if (isMounted && !selectedResearchId) {
       console.log('[KeywordPage] No research item selected. Resetting fields.');
    }
  }, [isMounted, selectedResearchId, selectedResearchDetail, setQueryInput, setSuggestions, setVolumeData]);

  // Update Step Based on Query Results Effect
  useEffect(() => {
     if (!isMounted || selectedResearchId) return;

     if (queryVolumeData && queryVolumeData.length > 0) {
       setStep("volumes");
     } else if (querySuggestions && querySuggestions.length > 0) {
       setStep("suggestions");
     } else if (!isLoading && !queryError && !localError) {
       setStep("input");
     }
  }, [isMounted, selectedResearchId, querySuggestions, queryVolumeData, isLoading, queryError, localError, step]);

  // Callbacks
  const handleTriggerClustering = useCallback(() => {
      console.log("[KeywordPage] Triggering clustering manually.");
      setIsClusteringLoading(true); // <-- Use dedicated state
      setClusteringTrigger(prev => prev + 1); // Increment trigger to initiate clustering
      // Note: KeywordClustering component might need its own internal loading state as well
  }, []);

  const handleGetVolumes = useCallback(async () => {
    if (!querySuggestions || querySuggestions.length === 0) {
      toast.warning("沒有可用的關鍵詞建議");
      return;
    }
    const keywords = querySuggestions;
    const limitedKeywords = keywords.slice(0, settingsState.maxResults > 0 ? settingsState.maxResults : keywords.length);

    setQueryLoading(true, `獲取搜索量數據中...`);
    setLocalError(null);
    setStep("volumes");

    try {
      const result: KeywordVolumeResult = await fetchSearchVolume(
        limitedKeywords,
        settingsState.region,
        inputType === 'url' ? queryInput : undefined,
        settingsState.language
      );

      setVolumeData(result.results || []);
      if (result.sourceInfo) toast.info(result.sourceInfo);
      if (result.error) throw new Error(result.error);

      // Apply filters directly to the data before setting state
      let volumeDataResults = result.results || [];

      if (detectChineseType(queryInput) !== "simplified") {
        volumeDataResults = volumeDataResults.filter((item: KeywordVolumeItem) => {
          const itemType = detectChineseType(item?.text || "");
          return item?.text && (itemType === "traditional" || itemType === "mixed" || itemType === "none");
        });
      }
      if (settingsState.filterZeroVolume) {
        volumeDataResults = volumeDataResults.filter((item) => (item.searchVolume ?? 0) > 0);
      }
      setVolumeData(volumeDataResults);

      // No saving logic here - QueryProvider handles the initial save.

    } catch (error) {
      console.error("獲取搜索量失敗:", error);
      const message = error instanceof Error ? error.message : "獲取搜索量失敗，請稍後再試";
      if (!message.startsWith("數據來源:")) {
        toast.error(message);
      }
      setLocalError(message);
      setStep("suggestions");
      setVolumeData([]);
    }
  }, [
    querySuggestions,
    settingsState,
    setQueryLoading,
    setLocalError,
    setStep,
    setVolumeData,
    inputType,
    queryInput,
  ]);

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

  // Callback for when KeywordClustering finishes
  const handleClusteringComplete = useCallback(async (clusters: Record<string, string[]>) => {
    if (!selectedResearchId) {
      toast.warning("無法保存分群，未選中任何研究記錄");
      setIsClusteringLoading(false); // <-- End dedicated state
      return;
    }
    setIsClusteringLoading(true); // <-- Start saving with dedicated state
    setQueryLoading(true, "正在保存分群結果..."); // <-- Keep global loading message for feedback
    try {
      await saveClusters(selectedResearchId, { clusters, updatedAt: new Date() });
      toast.success("分群結果已更新至歷史記錄");
      // Re-fetch by setting ID again AFTER save completes successfully
      setSelectedResearchId(selectedResearchId);
    } catch (updateError) {
      console.error("更新歷史分群結果失敗:", updateError);
      const message = updateError instanceof Error ? updateError.message : "更新歷史記錄失敗";
      toast.error(message);
    } finally {
      setQueryLoading(false); // End global loading message
      setIsClusteringLoading(false); // <-- End dedicated state
    }
  }, [
    selectedResearchId,
    saveClusters,
    setSelectedResearchId,
    setQueryLoading, // Keep dependency for global message
  ]);

  // Restore and modify callback to initiate persona generation for a single cluster
  const handleStartPersonaChat = useCallback(async (clusterName: string, keywords: string[]) => {
    if (!selectedResearchId) {
      toast.error("無法生成用戶畫像，未選中研究記錄");
      return;
    }
    if (!clusterName || !keywords || keywords.length === 0) {
        toast.error("無法生成用戶畫像，分群數據無效");
        return;
    }
    
    setQueryLoading(true, `正在為分群 "${clusterName}" 生成用戶畫像...`);
    
    try {
        const personaResult = await generateUserPersonaFromClusters({
            clusterName,
            keywords,
            model: selectedModel, 
        });
        const newPersona = personaResult.userPersona; 
        toast.success(`分群 "${clusterName}" 的用戶畫像生成成功！`);
        
        // --- Update the Personas Map --- 
        const existingPersonas = selectedResearchDetail?.personas ?? {}; 
        const updatedPersonas: Record<string, string> = {
            ...existingPersonas,
            [clusterName]: newPersona,
        };
        await savePersonas(selectedResearchId, { personas: updatedPersonas, updatedAt: new Date() });
        // --- End Update Personas Map --- 

    } catch (error) {
        console.error(`為分群 "${clusterName}" 生成用戶畫像失敗:`, error);
        const message = error instanceof Error ? error.message : "生成用戶畫像時發生未知錯誤";
        toast.error(`生成用戶畫像失敗: ${message}`);
    } finally {
        setQueryLoading(false);
    }
  }, [
      selectedResearchId,
      selectedResearchDetail,
      selectedModel,
      setQueryLoading,
      savePersonas,
  ]);

  const handleSortChange = (field: SortField) => {
    setSortState((prevState: SortState) => ({
      field,
      direction: prevState.field === field && prevState.direction === "desc" ? "asc" : "desc",
    }));
  };

  if (!isMounted) {
    return null;
  }

  const canCluster = queryVolumeData && queryVolumeData.length >= 5;
  const hasClusters = selectedResearchDetail?.clusters && Object.keys(selectedResearchDetail.clusters).length > 0;

  return (
    <div className="space-y-4">
      <ToolHeader
        title="關鍵詞研究工具"
        description="搜索相關關鍵詞，獲取搜索量數據，並進行語義分群分析。"
        region={settingsState.region}
        language={settingsState.language}
        icon={<FileText className="h-5 w-5 text-blue-500" />}
      />

      {/* Model selection and clustering button area */}
      {canCluster && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={selectedModel}
            onValueChange={(value) => setSelectedModel(value as "gpt-4o-mini" | "gpt-4o")}
            disabled={isClusteringLoading || isQueryLoading} // <-- Check both loading states
          >
            <SelectTrigger className="w-[150px] sm:w-[180px]">
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o (最佳質量)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o-mini (推薦)</SelectItem>
            </SelectContent>
          </Select>

          <LoadingButton
            onClick={handleTriggerClustering}
            isLoading={isClusteringLoading} // <-- Use dedicated state for spinner
            disabled={!canCluster || isClusteringLoading || isQueryLoading} // <-- Disable if clustering or general query is loading
            className="whitespace-nowrap"
          >
            {hasClusters ? '重新分群' : '開始分群'}
          </LoadingButton>
        </div>
      )}

      {/* Main Content - Simplified Layout */}
      <div className="space-y-4"> {/* Removed grid, use simple vertical spacing */}
        {/* 1. Keyword Suggestions Area */}
        {step === 'suggestions' && querySuggestions && querySuggestions.length > 0 && (
          <div className="border rounded-md p-4 bg-muted/20"> {/* Consider removing border/bg if not needed */}
            <h3 className="text-lg font-semibold mb-2">關鍵詞建議 ({querySuggestions.length})</h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">點擊獲取搜索量</span>
              <LoadingButton onClick={handleGetVolumes} isLoading={isLoading} disabled={isLoading}>
                獲取搜索量
              </LoadingButton>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-[calc(100vh-300px)] overflow-auto">
              {querySuggestions.slice(0, 100).map((suggestion: string, index: number) => (
                <li key={index}>{suggestion}</li>
              ))}
              {querySuggestions.length > 100 && <li>... 等等</li>}
            </ul>
          </div>
        )}

        {/* 2. Clustering Results Area */}
        {canCluster && (
          /* Removed outer div and mt-4 */
          <KeywordClustering
            keywordVolumeMap={keywordVolumeMap}
            onClusteringComplete={handleClusteringComplete}
            onStartPersonaChat={handleStartPersonaChat}
            clusteringTrigger={clusteringTrigger}
            personasMap={selectedResearchDetail?.personas}
            // Pass isClusteringLoading if the component needs it internally
            // isLoading={isClusteringLoading}
          />
        )}

        {/* 3. Volume Results Area */}
        {queryVolumeData && queryVolumeData.length > 0 && (
           /* Removed outer div and mt-4 */
          <KeywordResults
            data={{
              results: volumeDataWithCluster,
              error: undefined
            }}
            isLoading={isLoading} // Keep using general isLoading for volume results
            onKeywordClick={handleKeywordCardClick}
          />
        )}

        {/* Empty State Display */}
        {step === 'input' && !isLoading && !localError && !queryError &&
          (!querySuggestions || querySuggestions.length === 0) && (
          <div className="flex items-center justify-center h-[50vh]"> {/* Removed col-span */}
            <EmptyState
              title="開始進行關鍵詞研究"
              description="在上方輸入框輸入關鍵詞或網址，然後點擊搜索按鈕。"
            />
          </div>
        )}
      </div>
    </div>
  )
}

