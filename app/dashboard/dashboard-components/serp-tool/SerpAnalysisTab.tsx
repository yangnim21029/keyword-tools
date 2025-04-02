'use client';

import {
    analyzeSerpResultsHtml,
    getSerpAnalysis
} from '@/app/actions';
import { SerpAnalysisResult } from '@/app/types';
import SerpAnalysisComponent from '../serp-analysis/SerpAnalysisComponent';
import { LoadingButton } from "@/components/ui/LoadingButton";
import { processedSerpResultSchema } from '@/lib/schemas';
import { useQueryStore } from '@/store/queryStore';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

interface SerpAnalysisTabProps {
  activeTab: 'keyword' | 'url' | 'serp' | 'settings';
  region: string;
  language: string;
  regions: Record<string, string>;
  languages: Record<string, string>;
  onRegionChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  selectedHistoryDetail: any | null;
  onHistoryLoaded: (history: any) => void;
  globalSearchInput?: string;
}

// 推斷類型以進行斷言
type ProcessedSerpData = z.infer<typeof processedSerpResultSchema>;

export default function SerpAnalysisTab({
  activeTab,
  region,
  language,
  regions,
  languages,
  onRegionChange,
  onLanguageChange,
  selectedHistoryDetail,
  onHistoryLoaded,
  globalSearchInput
}: SerpAnalysisTabProps) {
  // 本地狀態
  const [serpKeywords, setSerpKeywords] = useState<string>('');
  const [serpResults, setSerpResults] = useState<SerpAnalysisResult | null>(null);
  const [isAnalyzingHtml, setIsAnalyzingHtml] = useState(false);
  const [htmlAnalysisStatus, setHtmlAnalysisStatus] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [serpData, setSerpData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 使用全局加載狀態
  const isLoading = useQueryStore(store => store.state.isLoading);
  const setGlobalLoading = useQueryStore(store => store.actions.setLoading);

  // 監聽 selectedHistoryDetail 變化，加載歷史數據
  useEffect(() => {
    if (selectedHistoryDetail && activeTab === 'serp') {
      loadSerpData(selectedHistoryDetail);
      // 通知父組件歷史記錄已加載
      onHistoryLoaded(selectedHistoryDetail);
    }
  }, [selectedHistoryDetail, activeTab, onHistoryLoaded]);

  // 監聽全局搜索輸入變化 - 只更新 serpKeywords 狀態
  useEffect(() => {
    if (globalSearchInput !== undefined && activeTab === 'serp') {
      setSerpKeywords(globalSearchInput);
      // 不再自動觸發分析，由全局按鈕觸發
    }
  }, [globalSearchInput, activeTab]);

  // 加載 SERP 分析歷史數據
  const loadSerpData = (historyDetail: any) => {
    if (!historyDetail || historyDetail.type !== 'serp') return;
    
    setKeyword(historyDetail.mainKeyword || '');
    
    if (historyDetail.serpResults) {
      setSerpData(historyDetail.serpResults);
    }
  };

  // SERP 分析處理函數
  const handleSerpAnalysis = async () => {
    if (!serpKeywords.trim()) { return; }
    
    setGlobalLoading(true, '分析 SERP 結果中...');
    setError(null);
    // 清空舊數據
    setSerpResults(null);
    setHtmlAnalysisStatus('');
    
    try {
      const keywordsArray = serpKeywords
        .split('\n')
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);
      
      if (keywordsArray.length === 0) {
        toast.warning('請輸入至少一個關鍵詞');
        setGlobalLoading(false);
        return;
      }
      
      const results = await getSerpAnalysis(keywordsArray, region, language);
      
      if (results.sourceInfo) {
        toast.info(results.sourceInfo);
      }
      if (results.error) {
        toast.error(results.error);
        throw new Error(results.error);
      }
      
      setSerpResults(results);
      
    } catch (error) {
      console.error('SERP 分析失敗:', error);
      const message = error instanceof Error ? error.message : 'SERP 分析失敗，請稍後再試';
      if (!message.startsWith('數據來源:')) {
         toast.error(message);
      }
      setError(message);
    } finally {
      setGlobalLoading(false);
    }
  };
  
  // 分析 HTML 內容
  const handleSerpHtmlAnalysis = async () => {
    if (!serpResults) return;
    
    setIsAnalyzingHtml(true);
    setHtmlAnalysisStatus('開始分析 HTML 內容...');
    setError(null);
    
    try {
      const keywords = Object.keys(serpResults.results);
      const result = await analyzeSerpResultsHtml(keywords, region, language);
      
      let successMessage = 'HTML 分析完成';
      let errorMessage = null;

      if (typeof result === 'object' && result !== null && 'success' in result) {
          if (result.success) {
              successMessage = result.message || successMessage;
          } else {
              errorMessage = result.message || 'HTML 分析失敗，未知錯誤';
          }
      } else {
          console.warn('analyzeSerpResultsHtml 返回格式非預期:', result);
      }

      if (errorMessage) {
          toast.error(`HTML 分析失敗: ${errorMessage}`);
          setHtmlAnalysisStatus(`HTML 分析失敗: ${errorMessage}`);
      } else {
          setHtmlAnalysisStatus(successMessage);
          const updatedResults = await getSerpAnalysis(keywords, region, language);
           if (updatedResults.sourceInfo) { toast.info(updatedResults.sourceInfo); }
           if (updatedResults.error) { toast.error(updatedResults.error); throw new Error(updatedResults.error); }
          setSerpResults(updatedResults);
      }

    } catch (error) {
      console.error('HTML 分析失敗:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`HTML 分析失敗: ${message}`);
      setHtmlAnalysisStatus(`HTML 分析失敗: ${message}`);
      setError(message);
    } finally {
      setIsAnalyzingHtml(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative mb-4" role="alert">
          <strong className="font-bold">錯誤!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}
      
      <LoadingButton id="serp-analysis-submit" onClick={handleSerpAnalysis} style={{ display: 'none' }} isLoading={isLoading}>Submit</LoadingButton>

      {serpResults && serpResults.results && Object.keys(serpResults.results).length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center space-x-2 mb-4">
            <LoadingButton 
              onClick={handleSerpHtmlAnalysis}
              disabled={!serpResults}
              variant="outline"
              className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-800 dark:text-gray-300 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium shadow-sm transition-colors"
              isLoading={isAnalyzingHtml}
              loadingText="分析中..."
            >
              分析 HTML
            </LoadingButton>
            {htmlAnalysisStatus && (
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium">
                {htmlAnalysisStatus}
              </div>
            )}
          </div>

          {Object.entries(serpResults.results).map(([keyword, keywordData]) => (
            <div key={keyword} className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-gray-200">關鍵詞: "{keyword}"</h2>
              <SerpAnalysisComponent 
                data={{ ...(keywordData as unknown as ProcessedSerpData), originalQuery: keyword }}
                language={language}
                showHtmlAnalysis={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}