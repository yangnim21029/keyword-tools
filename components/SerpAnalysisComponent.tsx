'use client';

import { ApifyOrganicResult, ProcessedSerpResult } from '@/lib/schemas';
import DomainCategoryAnalysis from './DomainCategoryAnalysis';
import { SerpResultsList } from './serp-analysis/SerpResultsList';

interface SerpAnalysisComponentProps {
  data: ProcessedSerpResult | null;
  language?: string;
  showHtmlAnalysis?: boolean;
}

export default function SerpAnalysisComponent({
  data,
  language = 'zh-TW',
  showHtmlAnalysis = true,
}: SerpAnalysisComponentProps) {
  if (!data) {
    return <div className="text-center py-10 text-gray-700 dark:text-gray-400">正在加載 SERP 分析數據或無可用數據...</div>;
  }

  // Destructure data for easier access
  const { results, analysis } = data;

  // 創建一個映射結果的函數，為結果添加 displayUrl 屬性
  const mapResultsForDomainAnalysis = (results: ApifyOrganicResult[]): any[] => {
    return results.map(result => ({
      ...result,
      displayUrl: result.displayedUrl || result.url, // 使用 displayedUrl 或 url 作為 displayUrl
    }));
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-950 p-4 md:p-6 rounded-lg border border-gray-200 dark:border-gray-800">
      {/* 標題區域 */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl font-bold text-black dark:text-white">
          SERP 分析: <span className="text-blue-700 dark:text-blue-400">{data.originalQuery || '關鍵詞'}</span>
        </h1>
      </div>

      {/* 左右雙欄佈局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* 左側：網域分析 */}
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-white mb-2">網域分類與競爭難度分析</h2>
          <DomainCategoryAnalysis results={mapResultsForDomainAnalysis(results)} />
        </div>
        
        {/* 右側：搜索結果列表 */}
        <div>
          <h2 className="text-lg font-semibold text-black dark:text-white mb-2">搜索結果列表 ({results.length})</h2>
          <SerpResultsList 
            results={results} 
            showHtmlAnalysis={true} // 始終顯示 HTML 分析
          />
        </div>
      </div>
    </div>
  );
} 