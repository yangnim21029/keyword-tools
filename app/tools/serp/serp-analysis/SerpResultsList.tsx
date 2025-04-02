'use client';

import { ApifyOrganicResult } from '@/lib/schemas';
import { SearchResultItem } from './SearchResultItem';

interface SerpResultsListProps {
  results: ApifyOrganicResult[];
  showHtmlAnalysis?: boolean;
}

export function SerpResultsList({ results, showHtmlAnalysis }: SerpResultsListProps) {
  if (!results || results.length === 0) {
    return <p className="text-gray-700 dark:text-gray-400">沒有可顯示的搜索結果。</p>;
  }
  
  return (
    <div className="space-y-2">
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 shadow-sm overflow-hidden">
        <div className="max-h-[calc(100vh-14rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 p-2">
          {results.map((result, index) => (
            <SearchResultItem
              key={`${result.url || 'no-url'}-${index}`}
              item={result}
              index={index + 1}
              showHtmlAnalysis={showHtmlAnalysis}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 