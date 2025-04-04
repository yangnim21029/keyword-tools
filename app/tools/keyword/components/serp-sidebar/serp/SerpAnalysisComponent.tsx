'use client';

import type { SerpDisplayData, SerpResultItem } from "@/app/types/serp.types";
import {
  processedSerpResultSchema
} from "@/lib/schemas/serp.schema";
import { z } from 'zod';

// Infer types from schemas
type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;
// type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>; // Maybe unused now?

import DomainCategoryAnalysis from "./DomainCategoryAnalysis";
import { SerpResultsList } from "./SerpResultsList";
import { SerpSummary } from "./SerpSummary";

// Define the expected item structure for DomainCategoryAnalysis results
interface MappedSerpResultItem extends SerpResultItem {
    displayUrl: string;
}

interface SerpAnalysisComponentProps {
  serpAnalysisData: SerpDisplayData | null;
}

export default function SerpAnalysisComponent({
  serpAnalysisData,
}: SerpAnalysisComponentProps) {
  if (!serpAnalysisData) {
    return <div className="p-4 text-center text-sm text-muted-foreground">請先加載 SERP 分析數據。</div>;
  }

  // Define the mapping function *first*
  const mapResultsForDomainAnalysis = (results: SerpResultItem[]): MappedSerpResultItem[] => {
    return results.map(result => ({
      ...result,
      // Ensure displayUrl is always a string
      displayUrl: result.displayedUrl || result.url || '',
    }));
  };

  const { query, serpResults, analysis, createdAt } = serpAnalysisData;
  
  // Prepare props using the defined function
  const mappedResults = mapResultsForDomainAnalysis(serpResults || []);

  const summaryProps = {
    totalResults: analysis?.totalResults,
    avgTitleLength: analysis?.avgTitleLength,
    avgDescriptionLength: analysis?.avgDescriptionLength,
    createdAt: createdAt,
    // Cast might still be needed depending on SerpSummary's expectation
    result: serpAnalysisData as unknown as ProcessedSerpResult | null, 
  };

  const domainAnalysisProps = {
    domains: analysis?.domains ?? {},
    topDomains: analysis?.topDomains ?? [],
    results: mappedResults, // Use the mapped results
  };

  return (
    <div className="p-2 space-y-3">
      {/* 標題區域 - 直接放置，移除額外容器 */}
      <h1 className="text-lg font-bold text-black dark:text-white">
        SERP 分析: <span className="text-blue-700 dark:text-blue-400">{query || '關鍵詞'}</span>
      </h1>

      {/* 直接使用grid排列三個主要元素，無需多層嵌套 */}
      <div className="grid grid-cols-1 gap-3">
        {/* 網域分析 - 直接顯示組件，移除額外容器和標題 */}
        <DomainCategoryAnalysis {...domainAnalysisProps} />
        
        {/* 搜索結果列表 - 直接顯示組件，移除額外容器和標題 */}
        <SerpResultsList results={serpResults || []} />
        
        {/* 查詢摘要 - 直接顯示組件，移除額外容器 */}
        <SerpSummary {...summaryProps} />
      </div>
    </div>
  );
} 