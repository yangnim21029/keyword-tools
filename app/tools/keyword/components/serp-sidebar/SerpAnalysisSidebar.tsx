/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
"use client"

import { analyzeSerpResultsHtml, getSerpAnalysis } from "@/app/services/serp";
import type { SerpDisplayData, SerpResultItem } from '@/app/types/serp.types';
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Info, Layers, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SerpResultsList } from "./SerpResultsList";

// 默认加载状态组件 - 简化版
const SerpLoadingState = () => (
  <div className="flex items-center justify-center h-16 text-sm text-gray-500">
    <Loader2 className="h-4 w-4 animate-spin mr-2" />
    <span>正在加载SERP分析...</span>
  </div>
);

// 简化空状态组件
const SimpleSerpEmpty = () => (
  <div className="text-center py-4">
    <Info className="h-5 w-5 mx-auto text-gray-400 mb-2" />
    <p className="text-sm text-gray-500">选择关键词以查看SERP分析</p>
  </div>
);

interface SerpAnalysisTabProps {
  activeTab: "keyword" | "url" | "serp" | "settings"
  region: string
  language: string
  onSerpAnalysisLoaded: (serpAnalysis: SerpDisplayData | null) => void
  selectedSerpAnalysisData: SerpDisplayData | null
  globalSearchInput?: string
}

export default function SerpAnalysisTab({
  activeTab,
  region,
  language,
  selectedSerpAnalysisData,
  onSerpAnalysisLoaded,
  globalSearchInput,
}: SerpAnalysisTabProps) {
  // 合并状态管理
  const [state, setState] = useState({
    currentSerpDisplayData: selectedSerpAnalysisData as SerpDisplayData | null,
    serpKeywordsInput: globalSearchInput || selectedSerpAnalysisData?.query || "",
    error: null as string | null,
    isSerpLoading: false,
    serpLoadingMessage: "",
    isAnalyzingHtml: false,
    htmlAnalysisStatus: ""
  });
  
  // 析构状态以便于使用
  const { 
    currentSerpDisplayData, error, isSerpLoading, serpLoadingMessage, 
    isAnalyzingHtml, htmlAnalysisStatus
  } = state;

  // 更新状态的辅助函数
  const updateState = (newState: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  // SERP Analysis Function (优化)
  const handleSerpAnalysis = useCallback(async (keywordsToAnalyze: string) => {
    if (!keywordsToAnalyze.trim()) {
      updateState({
        currentSerpDisplayData: null,
        error: null,
      });
      onSerpAnalysisLoaded(null);
      return;
    }

    updateState({
      isSerpLoading: true,
      serpLoadingMessage: "分析 SERP 結果中...",
      error: null,
      currentSerpDisplayData: null,
      htmlAnalysisStatus: "",
    });
    onSerpAnalysisLoaded(null);

    try {
      const keywordsArray = keywordsToAnalyze
        .split("\n")
        .map((kw) => kw.trim())
        .filter((kw) => kw.length > 0);

      if (keywordsArray.length === 0) {
        toast.warning("請輸入至少一個關鍵詞");
        updateState({ isSerpLoading: false });
        return;
      }

      const apiResponse = await getSerpAnalysis(keywordsArray, region, language);

      if (apiResponse.sourceInfo) {
        toast.info(apiResponse.sourceInfo);
      }
      if (apiResponse.error) {
        toast.error(apiResponse.error);
        throw new Error(apiResponse.error);
      }

      if (apiResponse.results && typeof apiResponse.results === 'object' && Object.keys(apiResponse.results).length > 0) {
        const firstKeyword = Object.keys(apiResponse.results)[0];
        const firstKeywordData = apiResponse.results[firstKeyword];

        if (!firstKeywordData || !Array.isArray(firstKeywordData.results)) {
          throw new Error("SERP API 響應缺少有效的結果數據");
        }

        const displayData: SerpDisplayData = {
          id: (apiResponse as any).id || keywordsArray.join('_'), 
          query: firstKeyword, 
          serpResults: firstKeywordData.results as unknown as SerpResultItem[], 
          analysis: firstKeywordData.analysis, 
          createdAt: (apiResponse as any).createdAt || new Date(), 
          location: (apiResponse as any).location || region,
          language: (apiResponse as any).language || language,
          device: (apiResponse as any).device,
        };

        updateState({ currentSerpDisplayData: displayData });
        onSerpAnalysisLoaded(displayData);
      } else {
        throw new Error("SERP 分析結果格式不正確或為空");
      }
    } catch (err: unknown) {
      console.error("SERP 分析失敗:", err);
      const message = err instanceof Error ? err.message : "SERP 分析失敗，請稍後再試";
      if (!message.startsWith("數據來源:")) {
        toast.error(message);
      }
      updateState({
        error: message,
        currentSerpDisplayData: null,
      });
      onSerpAnalysisLoaded(null);
    } finally {
      updateState({
        isSerpLoading: false,
        serpLoadingMessage: "",
      });
    }
  }, [region, language, onSerpAnalysisLoaded]);

  // Effect to update display data when selectedSerpAnalysisData prop changes
  useEffect(() => {
    if (activeTab === "serp") {
      if (selectedSerpAnalysisData && selectedSerpAnalysisData.serpResults) {
        updateState({ currentSerpDisplayData: selectedSerpAnalysisData });
      }
      
      if (selectedSerpAnalysisData?.query) {
        updateState({ serpKeywordsInput: selectedSerpAnalysisData.query });
      }
      
      if (selectedSerpAnalysisData) {
        updateState({ error: null });
      }
    }
  }, [selectedSerpAnalysisData, activeTab]);

  // Effect to handle changes in globalSearchInput
  useEffect(() => {
    if (activeTab === "serp" && globalSearchInput !== undefined) {
      updateState({ serpKeywordsInput: globalSearchInput });
      
      const currentQuery = currentSerpDisplayData?.query;
      const inputChanged = globalSearchInput !== currentQuery;

      if (inputChanged && globalSearchInput.trim()) {
        handleSerpAnalysis(globalSearchInput);
      } else if (!globalSearchInput.trim()) {
        updateState({
          currentSerpDisplayData: null,
          error: null,
        });
        onSerpAnalysisLoaded(null);
      }
    }
  }, [globalSearchInput, activeTab, onSerpAnalysisLoaded, handleSerpAnalysis, region, language, currentSerpDisplayData?.query]);

  // Analyze HTML Content Function (优化)
  const handleSerpHtmlAnalysis = useCallback(async () => {
    if (!currentSerpDisplayData || !currentSerpDisplayData.query) return;

    const keywordToAnalyze = currentSerpDisplayData.query;

    updateState({
      isAnalyzingHtml: true,
      htmlAnalysisStatus: `開始分析 ${keywordToAnalyze} 的頁面內容...`,
      error: null,
    });

    try {
      const result = await analyzeSerpResultsHtml([keywordToAnalyze], region, language);

      let successMessage = "HTML 分析完成";
      let errorMessage = null;

      if (typeof result === "object" && result !== null && "success" in result && typeof result.success === 'boolean') {
        if (result.success) {
          successMessage = result.message || successMessage;
        } else {
          errorMessage = result.message || "HTML 分析失敗，未知錯誤";
        }
      } else if (typeof result === 'string') {
        successMessage = result;
      } else {
        errorMessage = "HTML 分析返回格式非預期";
      }

      if (errorMessage) {
        toast.error(`HTML 分析失敗: ${errorMessage}`);
        updateState({ htmlAnalysisStatus: `HTML 分析失敗: ${errorMessage}` });
      } else {
        updateState({ htmlAnalysisStatus: successMessage });
        toast.success(successMessage);
        await handleSerpAnalysis(keywordToAnalyze);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`HTML 分析失敗: ${message}`);
      updateState({
        htmlAnalysisStatus: `HTML 分析失敗: ${message}`,
        error: message,
      });
    } finally {
      updateState({ isAnalyzingHtml: false });
    }
  }, [currentSerpDisplayData, region, language, handleSerpAnalysis]);

  // 根据状态渲染对应内容
  if (isSerpLoading) {
    return <SerpLoadingState />;
  }
  
  if (!currentSerpDisplayData) {
    return (
      <div className="p-4">
        <SimpleSerpEmpty />
        
        {selectedSerpAnalysisData?.query && (
          <LoadingButton
            onClick={() => selectedSerpAnalysisData.query && handleSerpAnalysis(selectedSerpAnalysisData.query)}
            variant="default"
            size="sm"
            className="w-full mt-4 text-xs"
            isLoading={isSerpLoading}
            loadingText="分析中..."
          >
            分析 "{selectedSerpAnalysisData.query}" 的 SERP 結果
          </LoadingButton>
        )}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300 rounded text-sm">
        <p>分析错误: {error}</p>
      </div>
    );
  }

  // 简化渲染，减少层级
  return (
    <div className="space-y-3 pb-2 mx-6">
      {/* SERP分析标题 */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-medium flex items-center">
          <Layers className="h-4 w-4 mr-1.5" />
          SERP分析: {currentSerpDisplayData.query}
        </h3>
      </div>
      
      {/* HTML分析按钮 */}
      <div className="flex items-center gap-2">
        <LoadingButton
          onClick={handleSerpHtmlAnalysis}
          disabled={!currentSerpDisplayData || isAnalyzingHtml} 
          variant="outline"
          size="sm"
          className="text-xs flex-grow"
          isLoading={isAnalyzingHtml}
          loadingText="分析中..."
        >
          分析頁面内容
        </LoadingButton>
      </div>
      
      {/* HTML分析状态消息 */}
      {htmlAnalysisStatus && (
        <div className={`px-2 py-1 rounded text-xs ${
          htmlAnalysisStatus.includes('失敗') ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
        }`}>
          {htmlAnalysisStatus}
        </div>
      )}
      
      {/* 搜索结果列表 - 使用优化版本 */}
      {currentSerpDisplayData.serpResults && currentSerpDisplayData.serpResults.length > 0 && (
        <SerpResultsList 
          results={currentSerpDisplayData.serpResults} 
          showHtmlAnalysis={true}
        />
      )}
    </div>
  );
}

