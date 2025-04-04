'use client';

// Use the canonical SerpResultItem type
import type { SerpResultItem } from '@/app/types/serp.types';
import { useCallback, useState } from 'react';

// 擴展SerpResultItem以包含htmlAnalysis字段
interface ExtendedSerpResultItem extends SerpResultItem {
  htmlAnalysis?: string | Record<string, any>;
}

interface SerpResultsListProps {
  // 使用擴展的類型
  results: ExtendedSerpResultItem[]; 
  showHtmlAnalysis?: boolean;
}

// 默认只显示前3个结果
const DEFAULT_DISPLAY_COUNT = 3;

export function SerpResultsList({ results, showHtmlAnalysis }: SerpResultsListProps) {
  const [showAll, setShowAll] = useState(false);
  
  // 切换显示全部/精简模式 - 移动到顶层
  const toggleShowAll = useCallback(() => {
    setShowAll(prev => !prev);
  }, []);
  
  // 没有结果的处理
  if (!results || results.length === 0) {
    return <p className="text-gray-700 dark:text-gray-400">沒有可顯示的搜索結果。</p>;
  }
  
  // 根据是否显示全部来确定显示的结果数量
  const displayResults = showAll ? results : results.slice(0, DEFAULT_DISPLAY_COUNT);
  
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-base font-semibold">搜索結果 ({results.length})</h2>
        {results.length > DEFAULT_DISPLAY_COUNT && (
          <button 
            onClick={toggleShowAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showAll ? '只顯示前三個' : `顯示全部 (${results.length})`}
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        {displayResults.map((item, index) => (
          <div 
            key={`${item.url || 'no-url'}-${index}`} 
            className="py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-900 rounded"
          >
            <div className="flex items-start">
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full text-[10px] font-medium text-gray-600 dark:text-gray-300 mr-2">
                {item.position || index + 1}
              </span>
              
              <div className="flex-grow min-w-0"> 
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
                
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                  {item.description || '未提供描述'}
                </p>
                
                {/* 只在需要时显示HTML分析信息 */}
                {showHtmlAnalysis && item.htmlAnalysis && (
                  <div className="mt-1 text-xs bg-blue-50/50 dark:bg-blue-900/10 p-1 rounded">
                    {typeof item.htmlAnalysis === 'string' 
                      ? item.htmlAnalysis 
                      : JSON.stringify(item.htmlAnalysis)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!showAll && results.length > DEFAULT_DISPLAY_COUNT && (
        <div className="text-center mt-2">
          <button 
            onClick={toggleShowAll}
            className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-1 px-3 rounded"
          >
            顯示全部 {results.length} 個結果
          </button>
        </div>
      )}
    </div>
  );
}
