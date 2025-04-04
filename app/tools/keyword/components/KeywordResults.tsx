"use client"

import { EmptyState } from "@/app/tools/keyword/EmptyState"
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KeywordVolumeResult } from '@/lib/schemas'
import {
  ArrowUpDown,
  BarChart2,
  SortAsc,
  SortDesc
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

interface KeywordResultsProps {
  data: KeywordVolumeResult | null
  isLoading: boolean
  onKeywordClick: (text: string) => void
}

const SORTS = [
  { key: 'volume-desc', label: '搜索量 (高到低)', icon: <SortDesc className="h-3.5 w-3.5" /> },
  { key: 'volume-asc', label: '搜索量 (低到高)', icon: <SortAsc className="h-3.5 w-3.5" /> },
  { key: 'alphabetical', label: '字母順序', icon: <ArrowUpDown className="h-3.5 w-3.5" /> },
]

// 每个分组显示的关键词数量
const ITEMS_PER_GROUP = 15;
// 默认显示的分组数量
const DEFAULT_GROUPS = 3;

export default function KeywordResults({
  data,
  isLoading,
  onKeywordClick,
}: KeywordResultsProps) {
  const [sortBy, setSortBy] = useState<string>('volume-desc')
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleGroups, setVisibleGroups] = useState(DEFAULT_GROUPS);

  // 使用useMemo优化排序和分组逻辑
  const { sortedItems, groupedKeywords } = useMemo(() => {
    if (!data?.results?.length) return { sortedItems: [], groupedKeywords: [] };
    
    // 排序关键词
    const sorted = [...data.results].sort((a, b) => {
      if (sortBy === 'volume-desc') {
        return (b.searchVolume || 0) - (a.searchVolume || 0)
      }
      if (sortBy === 'volume-asc') {
        return (a.searchVolume || 0) - (b.searchVolume || 0)
      }
      // 字母排序
      return (a.text || '').localeCompare(b.text || '')
    });

    // 按搜索量分组，简单分为高、中、低三组
    const highVolume = sorted.filter(item => (item.searchVolume || 0) > 1000).slice(0, ITEMS_PER_GROUP);
    const mediumVolume = sorted.filter(item => (item.searchVolume || 0) > 100 && (item.searchVolume || 0) <= 1000).slice(0, ITEMS_PER_GROUP);
    const lowVolume = sorted.filter(item => (item.searchVolume || 0) <= 100).slice(0, ITEMS_PER_GROUP);
    
    // 确保有足够的数据显示
    const volumeGroups = [
      { name: '高搜索量', items: highVolume.length ? highVolume : [] },
      { name: '中搜索量', items: mediumVolume.length ? mediumVolume : [] },
      { name: '低搜索量', items: lowVolume.length ? lowVolume : [] }
    ].filter(group => group.items.length > 0);
    
    return { 
      sortedItems: sorted,
      groupedKeywords: volumeGroups 
    };
  }, [data?.results, sortBy]);

  // 切换排序方式
  const handleSort = () => {
    const currentIndex = SORTS.findIndex(s => s.key === sortBy);
    const nextIndex = (currentIndex + 1) % SORTS.length;
    setSortBy(SORTS[nextIndex].key);
  };

  // 当前排序方式
  const currentSort = SORTS.find(s => s.key === sortBy) || SORTS[0];

  // 加载更多分组
  const loadMore = () => {
    setVisibleGroups(prev => Math.min(prev + 3, groupedKeywords.length));
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-muted-foreground">
          <BarChart2 className="h-4 w-4" />
          <span>關鍵詞搜索量</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-8 w-full" />
              {Array(5).fill(0).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 无结果状态
  if (!data?.results?.length) {
    return <EmptyState title="無結果" description="暫無關鍵詞數據" />
  }

  // 有结果渲染
  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-muted-foreground">
          <BarChart2 className="h-4 w-4" />
          <span>關鍵詞搜索量</span>
          <span className="text-xs ml-1">({data.results.length})</span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={handleSort}
        >
          {currentSort.icon}
          <span className="ml-1 text-xs sm:inline hidden">{currentSort.label}</span>
        </Button>
      </div>

      {/* 直接使用grid布局显示关键词，无需额外嵌套 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {groupedKeywords.slice(0, visibleGroups).map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{group.name}</h3>
            {/* 简化关键词列表，使用grid直接显示 */}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-1">
              {group.items.map((item) => {
                const volumeClass = !item.searchVolume 
                  ? "text-gray-500" 
                  : item.searchVolume > 1000 
                    ? "text-green-600 font-medium"
                    : item.searchVolume > 100 
                      ? "text-blue-600" 
                      : "text-gray-600";

                return (
                  <div
                    key={item.text}
                    className="flex items-center justify-between py-1 px-2 hover:bg-white dark:hover:bg-gray-700/30 rounded cursor-pointer"
                    onClick={() => onKeywordClick(item.text || "")}
                  >
                    <span className="text-sm truncate max-w-[160px]">{item.text}</span>
                    <span className={`text-xs ${volumeClass} ml-1`}>
                      {item.searchVolume !== undefined ? new Intl.NumberFormat().format(item.searchVolume) : "無數據"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 加载更多按钮 - 简化样式和行为 */}
      {visibleGroups < groupedKeywords.length && (
        <Button 
          variant="outline" 
          onClick={loadMore} 
          className="text-xs w-full mt-2"
        >
          加載更多 (顯示 {visibleGroups}/{groupedKeywords.length})
        </Button>
      )}
    </div>
  );
}

