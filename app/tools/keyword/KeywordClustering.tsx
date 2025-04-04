'use client';

import { performSemanticClustering } from '@/app/actions/SemanticClustering';
import type { Keyword } from '@/app/types/keyword-research.types';
import { Button } from "@/components/ui/button";
import { useQueryStore } from '@/providers/QueryProvider';
import { useResearchStore } from '@/store/keywordResearchStore';
import { Check, ChevronDown, ChevronUp, Copy, LayoutGrid, Search, TrendingUp, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

// 默认只显示前3个分群
const DEFAULT_VISIBLE_CLUSTERS = 3;
// 每个分群默认显示的关键词数量
const DEFAULT_KEYWORDS_PER_CLUSTER = 5;

interface KeywordClusteringProps {
  keywordVolumeMap: Record<string, number>;
  onClusteringComplete: (clusters: Record<string, string[]>) => void;
  onStartPersonaChat: (clusterName: string, keywords: string[]) => void;
  clusteringTrigger?: number;
  personasMap?: Record<string, string> | null;
}

export default function KeywordClustering({ 
  keywordVolumeMap, 
  onClusteringComplete, 
  onStartPersonaChat, 
  clusteringTrigger,
  personasMap
}: KeywordClusteringProps) {
  // 状态管理
  const [state, setState] = useState({
    isClustering: false,
    clusters: null as Record<string, string[]> | null,
    copiedClusterIndex: null as number | null,
    keywords: null as string[] | null,
    showAllClusters: false,
    expandedClusters: {} as Record<string, boolean>
  });
  
  const { 
    isClustering, clusters, copiedClusterIndex, 
    keywords, showAllClusters, expandedClusters 
  } = state;
  
  const prevTriggerRef = useRef<number | undefined>(undefined);
  
  // 全局存储
  const setGlobalLoading = useQueryStore((state) => state.actions.setLoading);
  const requestSerpAnalysis = useResearchStore((state) => state.actions.requestSerpAnalysis);
  const selectedResearchDetail = useResearchStore((store) => store.state.selectedResearchDetail);
  const researchLocation = selectedResearchDetail?.location || 'tw';
  const researchLanguage = selectedResearchDetail?.language || 'zh-TW';

  // 更新状态辅助函数
  const updateState = useCallback((newState: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  // 執行語義聚類
  const handleClustering = useCallback(async () => {
    if (isClustering) return;
    
    if (!keywords || keywords.length < 5) {
      toast.error("需要至少5個關鍵詞才能進行語意分群");
      return;
    }
    
    updateState({ 
      isClustering: true,
      clusters: null
    });
    setGlobalLoading(true, '正在進行語意分群...');

    // 确保keywords不为null后再操作
    const limitedKeywords = keywords?.slice(0, 80) || [];
    const timeoutId = setTimeout(() => {
      toast.error('語意分群請求超時 (60秒)');
      updateState({ isClustering: false });
      setGlobalLoading(false);
    }, 60000);
    
    try {
      const result = await performSemanticClustering({
        keywords: limitedKeywords,
        model: "gpt-4o-mini"
      });
      
      clearTimeout(timeoutId); 
      
      if (result.clusters && Object.keys(result.clusters).length > 0) {
        updateState({ clusters: result.clusters });
        onClusteringComplete(result.clusters);
      } else {
        toast.error('聚類結果格式不正確或未包含有效分群');
        updateState({ clusters: null });
      }
    } catch (error: unknown) {
      clearTimeout(timeoutId); 
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      toast.error(`語意分群失敗: ${errorMessage}`);
      updateState({ clusters: null });
    } finally {
      updateState({ isClustering: false });
      setGlobalLoading(false);
    }
  }, [keywords, isClustering, setGlobalLoading, onClusteringComplete, updateState]);

  // 觸發聚類處理
  useEffect(() => {
    if (clusteringTrigger && clusteringTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = clusteringTrigger;
      handleClustering();
    }
  }, [clusteringTrigger, handleClustering]);

  // 加載關鍵詞和現有聚類
  useEffect(() => {
    try {
      updateState({ isClustering: false });
      
      if (selectedResearchDetail) {
        // 加载现有分群
        if (selectedResearchDetail.clusters && Object.keys(selectedResearchDetail.clusters).length > 0) {
          updateState({ clusters: selectedResearchDetail.clusters });
        }

        // 从详细信息加载关键词
        const keywordsFromDetail = selectedResearchDetail.keywords
          ?.map((item: Keyword) => item.text?.trim())
          .filter((text): text is string => Boolean(text));

        if (keywordsFromDetail && keywordsFromDetail.length > 0) {
          updateState({ keywords: keywordsFromDetail });
          return;
        }
      }
      
      // 重置状态
      updateState({ 
        clusters: null,
        keywords: null
      });
    } catch (error) {
      console.error('[KeywordClustering] Error:', error);
      updateState({ 
        clusters: null,
        keywords: null
      });
    }
  }, [selectedResearchDetail, updateState]);

  // 优化排序计算
  const sortedClusters = useMemo(() => {
    if (!clusters) return [];

    // 首先计算每个分群的总搜索量
    const clustersWithVolume = Object.entries(clusters).map(([clusterName, keywordList]) => {
      // 计算总搜索量
      let totalVolume = 0;
      // 预排序关键词，按搜索量排序
      const sortedKeywords = [...keywordList].sort((a, b) => {
        const volumeA = keywordVolumeMap[a.toLowerCase()] || 0;
        const volumeB = keywordVolumeMap[b.toLowerCase()] || 0;
        totalVolume += volumeA; // 在排序的同时计算总量
        return volumeB - volumeA;
      });

      return {
        clusterName,
        keywordList: sortedKeywords,
        totalVolume,
        highestVolumeKeyword: sortedKeywords[0] || null
      };
    });

    // 按总搜索量排序分群
    return clustersWithVolume.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clusters, keywordVolumeMap]);

  // 複製關鍵詞到剪貼板
  const copyKeywords = (keywordsToCopy: string[], index: number) => {
    if (!Array.isArray(keywordsToCopy)) return;
    
    try {
      navigator.clipboard.writeText(keywordsToCopy.join('\n'));
      updateState({ copiedClusterIndex: index });
      setTimeout(() => updateState({ copiedClusterIndex: null }), 2000);
      toast.success(`已複製 ${keywordsToCopy.length} 個關鍵詞`);
    } catch (err) {
      toast.error("複製關鍵詞失敗");
    }
  };

  // 切换显示全部/部分分群
  const toggleShowAll = useCallback(() => {
    updateState({ showAllClusters: !showAllClusters });
  }, [showAllClusters, updateState]);

  // 切换关键词显示
  const toggleClusterExpand = useCallback((clusterName: string) => {
    updateState({
      expandedClusters: {
        ...expandedClusters,
        [clusterName]: !expandedClusters[clusterName]
      }
    });
  }, [expandedClusters, updateState]);

  // 處理 SERP 分析請求
  const handleSerpAnalysis = (keyword: string) => {
    requestSerpAnalysis?.({ 
      keyword, 
      region: researchLocation,
      language: researchLanguage 
    });
    toast.info(`分析 "${keyword}" 的 SERP`);
  };

  // 獲取聚類背景色和標識顏色
  const getClusterColors = (index: number) => {
    const colors = [
      { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100", volume: "text-blue-600 dark:text-blue-400" },
      { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100", volume: "text-amber-600 dark:text-amber-400" },
      { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100", volume: "text-green-600 dark:text-green-400" },
    ];
    return colors[index % colors.length];
  };

  // 判断各种状态并返回相应UI

  // 数据加载中
  if (keywords === null) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-blue-500 rounded-full mr-2"></div>
        <span className="text-base text-gray-500">加載中...</span>
      </div>
    );
  }
  
  // 无关键词
  if (keywords.length === 0) {
    return (
      <div className="text-amber-800 dark:text-amber-300 p-4 rounded-lg text-base">
        <p>沒有找到關鍵詞。請先進行關鍵詞搜索。</p>
      </div>
    );
  }
  
  // 关键词太少
  if (keywords.length < 5) {
    return (
      <div className="text-amber-800 dark:text-amber-300 p-4 rounded-lg text-base">
        <p>需要至少 5 個關鍵詞才能進行分群，當前只有 {keywords.length} 個</p>
      </div>
    );
  }

  // 正在分群中
  if (isClustering) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-6 w-6 border-t-2 border-b-2 border-blue-500 rounded-full mr-3"></div>
        <span className="text-lg">正在分群中...</span>
      </div>
    );
  }

  // 沒有分群結果
  if (!sortedClusters.length) {
    return (
      <div className="text-center p-8">
        <LayoutGrid className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">尚未生成分群</h3>
        <p className="text-gray-500 text-lg">
          系統將對關鍵詞進行智能分類，找出相關主題
        </p>
      </div>
    );
  }

  // 确定要显示的分群（只顯示前三個）
  const visibleClusters = sortedClusters.slice(0, DEFAULT_VISIBLE_CLUSTERS);

  // 有分群結果
  return (
    <div>
      <h3 className="text-xl font-semibold mb-6">
        關鍵詞分群 ({sortedClusters.length})
      </h3>

      {/* 使用間距更大的布局展示分群 */}
      <div className="space-y-8">
        {visibleClusters.map((cluster, index) => {
          const colors = getClusterColors(index);
          const isExpanded = expandedClusters[cluster.clusterName];
          const visibleKeywords = isExpanded 
            ? cluster.keywordList 
            : cluster.keywordList.slice(0, DEFAULT_KEYWORDS_PER_CLUSTER);
            
          return (
            <div 
              key={`cluster-${index}`} 
              className={`rounded-xl ${colors.bg} border ${colors.border} p-4 shadow-sm`}
            >
              {/* 標題列 - 添加總量突出顯示 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${colors.badge} text-lg font-medium`}>
                    {index + 1}
                  </span>
                  <h4 className={`text-xl font-medium ${colors.text}`}>
                    {cluster.clusterName}
                  </h4>
                </div>
                
                {/* 總搜索量 - 移到右側更醒目位置 */}
                {cluster.totalVolume > 0 && (
                  <div className={`flex items-center px-3 py-1.5 rounded-lg ${colors.badge} font-medium`}>
                    <TrendingUp className="mr-1.5 h-4 w-4" />
                    <span>總量: {new Intl.NumberFormat().format(cluster.totalVolume)}</span>
                  </div>
                )}
              </div>
              
              {/* 操作按鈕 - 移到獨立行 */}
              <div className="flex gap-2 mb-3">
                <Button 
                  variant="ghost"
                  size="sm"
                  onClick={() => copyKeywords(cluster.keywordList, index)}
                  title="複製關鍵詞"
                  className="h-8 w-8 p-0 rounded-full"
                >
                  {copiedClusterIndex === index ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStartPersonaChat(cluster.clusterName, cluster.keywordList)}
                  title="生成用戶畫像"
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <User className="h-4 w-4" />
                </Button>
                
                {cluster.highestVolumeKeyword && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSerpAnalysis(cluster.highestVolumeKeyword as string)}
                    title="SERP分析"
                    className="h-8 w-8 p-0 rounded-full"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleClusterExpand(cluster.clusterName)}
                  title={isExpanded ? "收起關鍵詞" : "展開關鍵詞"}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {/* 用户画像显示区域 (如果有) */}
              {personasMap && personasMap[cluster.clusterName] && (
                <div className="mb-3 text-base text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/40 p-3 rounded-lg">
                  {personasMap[cluster.clusterName]}
                </div>
              )}
              
              {/* 关键词列表 - 縮短關鍵詞與搜索量的距離 */}
              {visibleKeywords.length > 0 && (
                <div className="space-y-0.5">
                  <table className="w-full">
                    <tbody>
                      {visibleKeywords.map((keyword, kidx) => {
                        const volume = keywordVolumeMap[keyword.toLowerCase()] || 0;
                        // 第一个关键词或者搜索量 > 1000 的关键词标记为高搜索量
                        const isHighVolume = kidx === 0 || volume > 1000;
                        
                        return (
                          <tr 
                            key={`${index}-kw-${kidx}`}
                            className={`border-b border-gray-100 dark:border-gray-700/30 ${
                              isHighVolume ? 'bg-white/40 dark:bg-gray-800/20' : ''
                            }`}
                          >
                            <td className="py-2 pl-2 w-10 text-center text-gray-500 text-sm">
                              {kidx + 1}
                            </td>
                            <td className={`py-2 font-medium text-base ${isHighVolume ? 'font-semibold ' + colors.text : ''}`}>
                              {keyword}
                            </td>
                            {volume > 0 ? (
                              <td className={`py-2 pr-2 text-right whitespace-nowrap ${isHighVolume ? 'font-bold ' + colors.volume : 'text-gray-500'}`}>
                                {new Intl.NumberFormat().format(volume)}
                              </td>
                            ) : (
                              <td className="py-2 pr-2 text-right text-gray-400 text-sm">-</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {!isExpanded && cluster.keywordList.length > DEFAULT_KEYWORDS_PER_CLUSTER && (
                    <button 
                      className={`mt-2 text-base ${colors.text} hover:underline font-medium w-full text-center py-1`}
                      onClick={() => toggleClusterExpand(cluster.clusterName)}
                    >
                      + 還有 {cluster.keywordList.length - DEFAULT_KEYWORDS_PER_CLUSTER} 個關鍵詞
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 