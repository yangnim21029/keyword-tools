'use client';

import React, { useEffect, useState, useRef } from 'react';
// Assuming UrlAnalysisTab component is now located here after the move
import UrlAnalysisTab from './UrlAnalysisTab'; 
import { useQueryStore } from '@/providers/QueryProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { usePastQueryStore } from '@/store/pastQueryStore';
import { getUrlSuggestions } from '@/app/actions';
import { toast } from 'sonner';

export default function UrlToolPage() {
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  const historyState = usePastQueryStore(store => store.state);
  const { searchInput, lastTriggeredSearch } = useQueryStore(store => store.state);
  const setQueryLoading = useQueryStore(store => store.actions.setLoading);

  const processedTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      lastTriggeredSearch && 
      lastTriggeredSearch.tool === 'url' && 
      lastTriggeredSearch.timestamp !== processedTimestampRef.current
    ) {
      console.log('[UrlPage] Detected global search trigger:', lastTriggeredSearch);
      processedTimestampRef.current = lastTriggeredSearch.timestamp;
      
      handleAnalyzeUrl(lastTriggeredSearch.query); 
    }
  }, [lastTriggeredSearch]);

  const handleAnalyzeUrl = async (urlToAnalyze: string) => {
    if (!urlToAnalyze.trim()) { 
      console.log('[UrlPage] Triggered with empty URL, skipping.');
      return; 
    }
    console.log('[UrlPage] Starting analysis for URL:', urlToAnalyze);
    setQueryLoading(true, '分析URL中...');

    try {
      const result = await getUrlSuggestions({
        url: urlToAnalyze,
        region: settingsState.region,
        language: settingsState.language,
      });

      if (result.error) {
        console.error('[UrlPage] Analysis error:', result.error);
        toast.error(result.error);
      } else {
        console.log('[UrlPage] Analysis successful:', result.suggestions.length, 'suggestions');
        toast.success(`URL 分析完成，找到 ${result.suggestions.length} 個建議`);
      }
    } catch (error) {
      console.error('[UrlPage] Unexpected analysis error:', error);
      const message = error instanceof Error ? error.message : 'URL 分析時發生未知錯誤';
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
    <UrlAnalysisTab 
      region={settingsState.region}
      language={settingsState.language}
      regions={settingsState.regions}
      languages={settingsState.languages}
      onRegionChange={settingsActions.setRegion}
      onLanguageChange={(val) => settingsActions.setLanguage(convertToLanguage(val))}
      filterZeroVolume={settingsState.filterZeroVolume}
      maxResults={settingsState.maxResults}
      selectedHistoryDetail={historyState.selectedHistoryDetail}
      onHistoryLoaded={() => { /* Handle history loaded if necessary */ }}
      globalSearchInput={searchInput}
      activeTab="url"
    />
  );
}
