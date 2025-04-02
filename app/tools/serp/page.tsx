'use client';

import React, { useEffect, useState, useRef } from 'react';
// Assuming SerpAnalysisTab component is now located here after the move
import SerpAnalysisTab from './SerpAnalysisTab'; 
import { useQueryStore } from '@/providers/QueryProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { usePastQueryStore } from '@/store/pastQueryStore';
import { toast } from 'sonner';
// Import relevant SERP actions if needed later
// import { getSerpAnalysis } from '@/app/actions'; 

export default function SerpToolPage() {
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  const historyState = usePastQueryStore(store => store.state);
  // --- Get search trigger state from queryStore --- 
  const { searchInput, lastTriggeredSearch } = useQueryStore(store => store.state);
  const setQueryLoading = useQueryStore(store => store.actions.setLoading); // Get loading setter

  // --- State to track the last processed trigger timestamp --- 
  const processedTimestampRef = useRef<number | null>(null);

  // --- Add useEffect to react to lastTriggeredSearch from store --- 
  useEffect(() => {
    if (
      lastTriggeredSearch && 
      lastTriggeredSearch.tool === 'serp' && 
      lastTriggeredSearch.timestamp !== processedTimestampRef.current
    ) {
      console.log('[SerpPage] Detected global search trigger:', lastTriggeredSearch);
      processedTimestampRef.current = lastTriggeredSearch.timestamp;
      
      // Trigger the SERP analysis logic for this page
      handleAnalyzeSerp(lastTriggeredSearch.query);
    }
  }, [lastTriggeredSearch]); // Add dependencies

  // --- Placeholder function to handle SERP Analysis triggered by the effect --- 
  const handleAnalyzeSerp = async (query: string) => {
    if (!query.trim()) { 
      console.log('[SerpPage] Triggered with empty query, skipping.');
      return; 
    }
    console.log('[SerpPage] Starting analysis for SERP query:', query);
    setQueryLoading(true, '分析SERP中...');

    try {
      // TODO: Implement SERP analysis logic here
      // Example: Call a server action
      // const result = await getSerpAnalysis({ query, region: settingsState.region, language: settingsState.language });
      // if (result.error) { toast.error(result.error); } else { toast.success('SERP 分析完成'); }
      console.warn('[SerpPage] SERP analysis logic not implemented yet.');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
      toast.info('SERP 分析功能待實現');

    } catch (error) {
      console.error('[SerpPage] Unexpected analysis error:', error);
      const message = error instanceof Error ? error.message : 'SERP 分析時發生未知錯誤';
      toast.error(message);
    } finally {
      setQueryLoading(false);
    }
  };

  // Helper function
  const convertToLanguage = (lang: string): 'zh-TW' | 'en-US' => {
    const normalizedLang = lang.replace('_', '-');
    if (normalizedLang === 'zh-TW' || normalizedLang === 'en-US') {
      return normalizedLang as 'zh-TW' | 'en-US';
    }
    return 'zh-TW';
  };

  return (
    <SerpAnalysisTab 
      region={settingsState.region}
      language={settingsState.language}
      regions={settingsState.regions}
      languages={settingsState.languages}
      onRegionChange={settingsActions.setRegion}
      onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
      selectedHistoryDetail={historyState.selectedHistoryDetail} // Pass history detail if needed
      onHistoryLoaded={() => { /* Handle history loaded if necessary */ }}
      globalSearchInput={searchInput} // Pass global search input
      activeTab="serp" // Set activeTab prop
      // Assuming SerpAnalysisTab might need maxResults and filterZeroVolume from settings too
      // If not, these can be removed.
      // filterZeroVolume={settingsState.filterZeroVolume} 
      // maxResults={settingsState.maxResults}
    />
  );
}
