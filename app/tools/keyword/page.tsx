'use client';

import React, { useEffect, useRef } from 'react';
// Assuming KeywordSearchTab component is now located here after the move
import KeywordSearchTab from './KeywordSearchTab'; 
import { useQueryStore } from '@/providers/QueryProvider';
import { useSettingsStore } from '@/store/settingsStore';
// --- Import necessary state and actions from PastQueryStore --- 
import { usePastQueryStore } from '@/providers/PastQueryProvider'; // Correct import path

export default function KeywordToolPage() {
  // Access stores directly as the component likely did before
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  // --- Get state and actions from QueryStore --- 
  const { 
    searchInput, 
    lastTriggeredSearch, 
    error: queryError, 
    suggestions: querySuggestions, 
    volumeData: queryVolumeData 
  } = useQueryStore((store) => store.state);
  const {
    handleSearchSubmit,
    setSearchInput, // Action to set search input
    setSuggestions, // Action to set suggestions
    setVolumeData,  // Action to set volume data
  } = useQueryStore((store) => store.actions);

  // --- Get state and actions from PastQueryStore --- 
  const { 
    selectedHistoryId,       // ID of the selected history item
    selectedHistoryDetail,   // Detailed data of the selected item
  } = usePastQueryStore((store) => store.state);
  const { 
    notifyHistorySaved, 
    clearSelectedHistoryDetail 
  } = usePastQueryStore((store) => store.actions);
  
  // --- State to track the last processed trigger timestamp --- 
  const processedTimestampRef = useRef<number | null>(null);

  // --- Add useEffect to react to lastTriggeredSearch from store --- 
  useEffect(() => {
    // Use an async IIFE to allow awaiting handleSearchSubmit
    (async () => {
      if (
        lastTriggeredSearch && 
        lastTriggeredSearch.tool === 'keyword' && 
        lastTriggeredSearch.timestamp !== processedTimestampRef.current
      ) {
        console.log('[KeywordPage] Detected global search trigger:', lastTriggeredSearch);
        const currentTimestamp = lastTriggeredSearch.timestamp;
        processedTimestampRef.current = currentTimestamp;
        
        // --- Clear history selection BEFORE submitting search --- 
        console.log('[KeywordPage] Clearing selected history before new search.');
        clearSelectedHistoryDetail();

        // Await the search submission
        await handleSearchSubmit({
          region: settingsState.region,
          language: settingsState.language,
          useAlphabet: settingsState.useAlphabet,
          useSymbols: settingsState.useSymbols,
        });

        // Check the queryError state variable directly
        if (!queryError) { 
           console.log('[KeywordPage] Search successful, notifying history saved.');
           notifyHistorySaved();
        } else {
           console.log('[KeywordPage] Search finished with error, not notifying history saved.', queryError);
        }
      }
    })();
    // Add clearSelectedHistoryDetail to dependencies
  }, [lastTriggeredSearch, handleSearchSubmit, settingsState, notifyHistorySaved, clearSelectedHistoryDetail, queryError]);

  // --- Effect to load data when history item is selected --- 
  useEffect(() => {
    if (selectedHistoryDetail) {
      console.log('[KeywordPage] History item selected, loading data:', selectedHistoryDetail.id);
      // Update QueryStore with data from the selected history item
      setSearchInput(selectedHistoryDetail.mainKeyword || ''); // Update search input
      setSuggestions(selectedHistoryDetail.suggestions || []); // Update suggestions
      setVolumeData(selectedHistoryDetail.searchResults || []); // Update volume data
      // Clear the last triggered search timestamp ref to prevent re-triggering search for this history load
      processedTimestampRef.current = null; 
    } else {
      // Optional: Handle deselection if needed. For now, do nothing.
      // console.log('[KeywordPage] History item deselected.');
    }
    // Dependencies: run when the selected item or its details change
  }, [selectedHistoryId, selectedHistoryDetail, setSearchInput, setSuggestions, setVolumeData]);

  // Helper function (assuming it was defined similarly before or is needed by the tab)
  const convertToLanguage = (lang: string): 'zh-TW' | 'en-US' => {
    const normalizedLang = lang.replace('_', '-');
    if (normalizedLang === 'zh-TW' || normalizedLang === 'en-US') {
      return normalizedLang as 'zh-TW' | 'en-US';
    }
    return 'zh-TW';
  };

  return (
    <KeywordSearchTab 
      // Pass necessary props - mainly reading from stores now
      region={settingsState.region}
      language={settingsState.language}
      regions={settingsState.regions}
      languages={settingsState.languages}
      onRegionChange={settingsActions.setRegion}
      onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
      filterZeroVolume={settingsState.filterZeroVolume}
      maxResults={settingsState.maxResults}
      onHistoryUpdate={(newHistory) => {
        // Example: update history via store action if needed
        console.log('History updated in keyword tool:', newHistory);
        // historyActions.addHistory(newHistory); 
      }}
      globalSearchInput={searchInput} // Pass global search input if needed by the tab
      useAlphabet={settingsState.useAlphabet}
      useSymbols={settingsState.useSymbols}
      activeTab="keyword"
      // activeTab prop is no longer needed as it's implicitly 'keyword'
      // --- Pass suggestions and volume data from queryStore --- 
      currentSuggestions={querySuggestions} 
      currentVolumeData={queryVolumeData}
    />
  );
}
