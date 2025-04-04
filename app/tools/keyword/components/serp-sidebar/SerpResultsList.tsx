'use client';

// Use the canonical SerpResultItem type
import type { SerpResultItem } from '@/app/types/serp.types';
import { useCallback, useMemo, useState } from 'react';

// 擴展SerpResultItem以包含htmlAnalysis字段
interface ExtendedSerpResultItem extends SerpResultItem {
  htmlAnalysis?: string | Record<string, any>;
}

interface SerpResultsListProps {
  results: ExtendedSerpResultItem[]; 
  showHtmlAnalysis?: boolean;
}

// 默认只显示前3个结果
const DEFAULT_DISPLAY_COUNT = 3;

export function SerpResultsList({ results, showHtmlAnalysis }: SerpResultsListProps) {
  const [showAll, setShowAll] = useState(false);
  
  // 使用useMemo缓存显示结果，避免不必要的计算
  const displayResults = useMemo(() => {
    return showAll ? results : results.slice(0, DEFAULT_DISPLAY_COUNT);
  }, [results, showAll]);
  
  // 切换显示模式
  const toggleShowAll = useCallback(() => {
    setShowAll(prev => !prev);
  }, []);
  
  // 没有结果时显示提示
  if (!results?.length) {
    return <p className="text-gray-600 dark:text-gray-400 text-sm">沒有可顯示的搜索結果</p>;
  }
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">搜索結果 ({results.length})</h3>
        {results.length > DEFAULT_DISPLAY_COUNT && (
          <button 
            onClick={toggleShowAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAll ? '只顯示前三個' : `顯示全部 (${results.length})`}
          </button>
        )}
      </div>
      
      {/* 简化的结果列表 */}
      {displayResults.map((item, index) => (
        <div 
          key={`serp-result-${index}`} 
          className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-900 rounded"
        >
          <div className="flex items-start gap-1.5">
            <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-[10px] font-medium mt-1">
              {item.position || index + 1}
            </span>
            
            <div className="min-w-0 flex-grow"> 
              <a 
                href={item.url || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline line-clamp-1"
              >
                {item.title || '未提供標題'}
              </a>
              
              <p className="text-xs text-green-600 dark:text-green-400 truncate">
                {item.displayedUrl || item.url || '未提供 URL'}
              </p>
              
              {/* 只显示一行描述 */}
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                {item.description || '未提供描述'}
              </p>
              
              {/* HTML分析内容 (简化显示) */}
              {showHtmlAnalysis && item.htmlAnalysis && (
                <div className="mt-0.5 text-xs bg-blue-50 dark:bg-blue-900/10 px-1.5 py-0.5 rounded line-clamp-1">
                  {typeof item.htmlAnalysis === 'string' 
                    ? item.htmlAnalysis 
                    : JSON.stringify(item.htmlAnalysis)}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* 显示全部按钮 */}
      {!showAll && results.length > DEFAULT_DISPLAY_COUNT && (
        <button 
          onClick={toggleShowAll}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 py-1 rounded text-center"
        >
          顯示全部 {results.length} 個結果
        </button>
      )}
    </div>
  );
} 