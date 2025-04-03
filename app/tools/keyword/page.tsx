"use client"

// Optimize imports
import { ToolHeader } from "@/components/tools/ToolHeader";
// Providers are usually used in layout, maybe import store hooks directly?
// import { usePastQueryStore } from "@/providers/PastQueryProvider" 
// import { useQueryStore } from "@/providers/QueryProvider"
import type { KeywordVolumeItem } from "@/app/types"; // Import KeywordVolumeItem
import { usePastQueryStore, type PastQueryStore } from "@/store/pastQueryStore";
import { useQueryStore, type QueryStore } from "@/store/queryStore";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import KeywordSearchTab from "./KeywordSearchTab";

export default function KeywordToolPage() {
  // Access stores directly
  const settingsState = useSettingsStore((store) => store.state)
  const settingsActions = useSettingsStore((store) => store.actions)
  const {
    searchInput,
    lastTriggeredSearch,
    isLoading, // Get isLoading from store
    error: queryError,
    suggestions: querySuggestions,
    volumeData: queryVolumeData,
  } = useQueryStore((store: QueryStore) => store.state)
  const {
    handleSearchSubmit, 
    // Actions needed to update QueryStore from history
    setSearchInput, 
    setSuggestions, 
    setVolumeData, 
    clearResults // Add clearResults if needed when deselected
  } = useQueryStore((store: QueryStore) => store.actions)
  const {
    selectedHistoryId, 
    selectedHistoryDetail, 
  } = usePastQueryStore((store: PastQueryStore) => store.state)
  const { notifyHistorySaved, clearSelectedHistoryDetail } = usePastQueryStore((store: PastQueryStore) => store.actions)

  const processedTimestampRef = useRef<number | null>(null)

  // useEffect to trigger search when lastTriggeredSearch changes
  useEffect(() => {
    // This effect might be simplified or removed if triggerGlobalSearch directly calls handleSearchSubmit
    // For now, keep it to react to global triggers
    ;(async () => {
      if (
        lastTriggeredSearch &&
        lastTriggeredSearch.timestamp !== processedTimestampRef.current
      ) {
        console.log("[KeywordPage] Detected global search trigger:", lastTriggeredSearch);
        const currentTimestamp = lastTriggeredSearch.timestamp;
        processedTimestampRef.current = currentTimestamp;

        console.log("[KeywordPage] Clearing selected history before new search.");
        clearSelectedHistoryDetail();

        await handleSearchSubmit({
          region: settingsState.region,
          language: settingsState.language,
          useAlphabet: settingsState.useAlphabet,
          useSymbols: settingsState.useSymbols,
        });
        
        // Use queryError from hook which is in dependency array
        if (!queryError) { 
          console.log("[KeywordPage] Search successful, notifying history saved.");
          notifyHistorySaved();
        } else {
          console.log("[KeywordPage] Search finished with error:", queryError);
        }
      }
    })()
  }, [
    lastTriggeredSearch, 
    handleSearchSubmit, 
    settingsState, 
    notifyHistorySaved, 
    clearSelectedHistoryDetail, 
    queryError // Add queryError to dependency array
  ]);

  // useEffect to load data into QueryStore when history item is selected
  useEffect(() => {
    if (selectedHistoryDetail) {
      console.log("[KeywordPage] History item selected, updating QueryStore:", selectedHistoryDetail.id);
      // Update QueryStore with data from the selected history item
      setSearchInput(selectedHistoryDetail.mainKeyword || ""); 
      setSuggestions(selectedHistoryDetail.suggestions || []); 
      // Ensure searchResults is correctly typed or cast
      setVolumeData((selectedHistoryDetail.searchResults || []) as KeywordVolumeItem[]); 
      
      // Clear the last triggered search timestamp to prevent re-triggering search
      processedTimestampRef.current = null;
      
      // Optionally reset error state in QueryStore
      // setError(null); // Assuming setError action exists in QueryStore
    } else {
      // Optional: Handle deselection - clear QueryStore results?
      console.log('[KeywordPage] History item deselected, clearing QueryStore results.');
      // clearResults(); // Uncomment if clearing is desired
      setSearchInput(''); // Clear search input on deselection
    }
  }, [selectedHistoryId, selectedHistoryDetail, setSearchInput, setSuggestions, setVolumeData, clearResults]); // Add setters/clear to dependencies

  const convertToLanguage = (lang: string): "zh-TW" | "en-US" => {
    const normalizedLang = lang.replace("_", "-")
    if (normalizedLang === "zh-TW" || normalizedLang === "en-US") {
      return normalizedLang as "zh-TW" | "en-US"
    }
    return "zh-TW"
  }

  // Determine input type based on searchInput
  const isUrl = searchInput?.startsWith('http') ?? false;
  const inputType = isUrl ? 'url' : 'keyword';

  return (
    <>
      <ToolHeader
        title="關鍵詞研究工具"
        description="搜索相關關鍵詞，獲取搜索量數據，並進行語義分群分析。"
        activeTool={inputType} // Reflect current input type
        region={settingsState.region}
        language={settingsState.language}
        icon={<FileText className="h-5 w-5 text-blue-500" />}
      />

      <KeywordSearchTab
        // Pass derived inputType
        inputType={inputType}
        // Pass settings
        region={settingsState.region}
        language={settingsState.language}
        regions={settingsState.regions}
        languages={settingsState.languages}
        onRegionChange={settingsActions.setRegion}
        onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
        filterZeroVolume={settingsState.filterZeroVolume}
        maxResults={settingsState.maxResults}
        useAlphabet={settingsState.useAlphabet}
        useSymbols={settingsState.useSymbols}
        // Pass results from QueryStore
        currentSuggestions={querySuggestions}
        currentVolumeData={queryVolumeData}
        // Pass history details for context
        selectedHistoryDetail={selectedHistoryDetail}
        onHistoryLoaded={() => {}} // Placeholder or remove if not needed
        // Removed props: activeTab, globalSearchInput, onHistoryUpdate
      />
    </>
  )
}

