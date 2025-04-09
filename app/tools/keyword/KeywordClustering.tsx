'use client';

// Remove clustering action import - handled by page.tsx
// import { performSemanticClustering } from '@/app/actions/SemanticClustering';
import type { Keyword } from '@/app/types/keyword-research.types';
import { Button } from "@/components/ui/button";
import { useQueryStore } from '@/providers/QueryProvider';
import { useResearchStore } from '@/providers/keywordResearchProvider'; // Check if still needed? Yes, for SERP analysis
import { Check, ChevronDown, ChevronUp, Copy, LayoutGrid, Search, TrendingUp, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { generateUserPersonaFromClusters } from "@/app/actions/generatePersona";

// Constants for display
const DEFAULT_VISIBLE_CLUSTERS = 3; // Show top 3 by default (can be adjusted)
const DEFAULT_KEYWORDS_PER_CLUSTER = 5;

// Updated Props for the display component
interface KeywordClusteringProps {
  keywordVolumeMap: Record<string, number>; // Map keyword text (lowercase) to search volume
  clusters: Record<string, string[]> | null; // Cluster data passed from parent
  personasMap?: Record<string, string> | null; // Persona data passed from parent
  researchLocation: string; // Needed for SERP analysis
  researchLanguage: string; // Needed for SERP analysis
  currentKeywords: string[];
  selectedResearchDetail: {
    query: string;
  } | null;
}

export default function KeywordClustering({ 
  keywordVolumeMap, 
  clusters, 
  personasMap, 
  researchLocation, 
  researchLanguage,
  currentKeywords,
  selectedResearchDetail
}: KeywordClusteringProps) {
  // Local UI state only (expansion, copy status)
  const [uiState, setUiState] = useState({
    copiedClusterIndex: null as number | null,
    showAllClusters: false,
    expandedClusters: {} as Record<string, boolean>
  });
  const { copiedClusterIndex, showAllClusters, expandedClusters } = uiState;
  
  // Global stores - Only needed for actions triggered from here (SERP analysis)
  const requestSerpAnalysis = useResearchStore((state) => state.actions.requestSerpAnalysis);
  const selectedResearchId = useResearchStore((state) => state.state.selectedResearchId);
  const savePersonas = useResearchStore((state) => state.actions.savePersonas);
  
  // Update UI state helper
  const updateUiState = useCallback((newState: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...newState }));
  }, []);

  // Removed handleClustering and related useEffects - Logic moved to page.tsx
  
  // Removed useEffect for loading keywords/clusters - Data is passed via props

  // Memoize sorted clusters based on props
  const sortedClusters = useMemo(() => {
    if (!clusters) return [];

    const clustersWithVolume = Object.entries(clusters).map(([clusterName, keywordList]) => {
      // Sort keywords by volume first
      const sortedKeywords = [...keywordList].sort((a, b) => {
        const volumeA = keywordVolumeMap[a.toLowerCase()] || 0;
        const volumeB = keywordVolumeMap[b.toLowerCase()] || 0;
        return volumeB - volumeA; // Sort descending by volume
      });

      // CORRECT WAY: Calculate total volume AFTER sorting by summing all keyword volumes
      const totalVolume = sortedKeywords.reduce((sum, keyword) => {
         return sum + (keywordVolumeMap[keyword.toLowerCase()] || 0);
      }, 0);

      return {
        clusterName,
        keywordList: sortedKeywords, // Use the sorted list for display
        totalVolume, // Use the correctly calculated total volume
        highestVolumeKeyword: sortedKeywords[0] || null // Highest volume is the first after sorting
      };
    });

    // Sort clusters by the correctly calculated total volume
    return clustersWithVolume.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clusters, keywordVolumeMap]); // Depends only on props

  // Copy keywords function remains
  const copyKeywords = (keywordsToCopy: string[], index: number) => {
    if (!Array.isArray(keywordsToCopy)) return;
    try {
      navigator.clipboard.writeText(keywordsToCopy.join('\n'));
      updateUiState({ copiedClusterIndex: index });
      setTimeout(() => updateUiState({ copiedClusterIndex: null }), 2000);
      toast.success(`已複製 ${keywordsToCopy.length} 個關鍵詞`);
    } catch (err) {
      toast.error("複製關鍵詞失敗");
    }
  };

  // Toggle show all clusters function remains
  const toggleShowAll = useCallback(() => {
    updateUiState({ showAllClusters: !showAllClusters });
  }, [showAllClusters, updateUiState]);

  // Toggle cluster expansion remains
  const toggleClusterExpand = useCallback((clusterName: string) => {
    updateUiState({
      expandedClusters: {
        ...expandedClusters,
        [clusterName]: !expandedClusters[clusterName]
      }
    });
  }, [expandedClusters, updateUiState]);

  // 添加用戶畫像生成函數
  const onStartPersonaChat = useCallback((clusterName: string, keywords: string[]) => {
    if (!clusterName || !keywords || keywords.length === 0) {
      toast.error("無法生成用戶畫像：缺少必要數據");
      return;
    }
    
    if (!selectedResearchId) {
      toast.error("無法生成用戶畫像：未選擇研究項目");
      return;
    }
    
    // 顯示加載提示
    toast.info(`正在為 "${clusterName}" 生成用戶畫像...`);
    
    // 調用生成用戶畫像的 API
    generateUserPersonaFromClusters({
      clusterName,
      keywords,
      model: "gpt-4o-mini" // 使用默認模型
    })
      .then((result: { userPersona: string }) => {
        // 更新 personasMap
        const updatedPersonas = { ...(personasMap || {}), [clusterName]: result.userPersona };
        
        // 保存到數據庫
        return savePersonas(selectedResearchId, { personas: updatedPersonas, updatedAt: new Date() });
      })
      .then(() => {
        toast.success(`已成功生成 "${clusterName}" 的用戶畫像`);
      })
      .catch((error: Error) => {
        console.error("生成用戶畫像失敗:", error);
        toast.error(`生成用戶畫像失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
      });
  }, [personasMap, selectedResearchId, savePersonas]);

  // Handle SERP analysis remains, uses props for location/language
  const handleSerpAnalysis = useCallback((keyword: string) => {
     if (!keyword) return;
     // Ensure the action exists before calling
     if (requestSerpAnalysis) {
        requestSerpAnalysis({ 
          keyword, 
          region: researchLocation, // Use prop
          language: researchLanguage // Use prop
        });
        toast.info(`分析 "${keyword}" 的 SERP`);
     } else {
         console.warn("requestSerpAnalysis action is not available.");
         toast.warning("無法觸發 SERP 分析功能。");
     }
  }, [requestSerpAnalysis, researchLocation, researchLanguage]);

  // Cluster color logic remains
  const getClusterColors = (index: number) => {
    const colors = [
      { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100", volume: "text-blue-600 dark:text-blue-400" },
      { bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100", volume: "text-amber-600 dark:text-amber-400" },
      { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100", volume: "text-green-600 dark:text-green-400" },
      // Add more colors if needed
       { bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100", volume: "text-purple-600 dark:text-purple-400" },
       { bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-200 dark:border-pink-800", text: "text-pink-700 dark:text-pink-300", badge: "bg-pink-100 dark:bg-pink-800 text-pink-800 dark:text-pink-100", volume: "text-pink-600 dark:text-pink-400" },
    ];
    return colors[index % colors.length];
  };

  // --- Render Logic ---

  // Case: No clusters passed from parent
  if (!clusters || sortedClusters.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">未找到分群結果</h3>
        <p className="text-muted-foreground">
          {clusters === null ? "正在等待分群數據..." : "未能從關鍵詞中生成有效分群。"}
        </p>
      </div>
    );
  }

  // Determine visible clusters based on showAllClusters state
  const displayClusters = showAllClusters ? sortedClusters : sortedClusters.slice(0, DEFAULT_VISIBLE_CLUSTERS);

  // Render the clusters
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Title and Cluster Info */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">
              關鍵詞 "{selectedResearchDetail?.query}" 的分群結果共 {sortedClusters.length} 個分群，包含 {currentKeywords.length} 個關鍵詞
            </h1>
            <div className="text-sm text-muted-foreground mt-2">
              {sortedClusters.map((cluster, index) => {
                // 計算該分群的總搜尋量
                const totalVolume = cluster.keywordList.reduce((sum, keyword) => {
                  return sum + (keywordVolumeMap[keyword.toLowerCase()] || 0);
                }, 0);
                
                // 提取長尾關鍵詞（去掉主關鍵詞後的部分）
                const mainQuery = selectedResearchDetail?.query || '';
                const mainQueryChars = new Set(mainQuery.split(''));
                
                const longTailKeywords = cluster.keywordList
                  .map(keyword => {
                    // 將關鍵詞轉換為字符數組，過濾掉所有在主關鍵詞中出現的字符
                    const filteredChars = keyword.split('').filter(char => !mainQueryChars.has(char));
                    return filteredChars.join('').trim();
                  })
                  .filter(tail => tail.length > 0)
                  .slice(0, 3) // 只取前3個作為示例
                  .join(', ');
                
                return (
                  <div key={index} className="mb-4">
                    <div className="text-base font-medium">
                      {index + 1}. {cluster.clusterName} (總搜尋量: {new Intl.NumberFormat().format(totalVolume)})
                    </div>
                    {longTailKeywords && (
                      <div className="mt-1 text-sm text-muted-foreground">
                        長尾關鍵詞: {longTailKeywords}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {sortedClusters.length > DEFAULT_VISIBLE_CLUSTERS && (
            <Button variant="link" onClick={toggleShowAll} className="whitespace-nowrap">
              {showAllClusters ? '只顯示前' + DEFAULT_VISIBLE_CLUSTERS + '個' : '顯示全部'}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6 sm:space-y-8">
        {displayClusters.map((cluster, index) => {
          const colors = getClusterColors(index);
          const isExpanded = expandedClusters[cluster.clusterName];
          const visibleKeywords = isExpanded 
            ? cluster.keywordList 
            : cluster.keywordList.slice(0, DEFAULT_KEYWORDS_PER_CLUSTER);
          const clusterPersona = personasMap?.[cluster.clusterName];
            
          return (
            <div 
              key={`cluster-${index}`} 
              className={`rounded-xl ${colors.bg} border ${colors.border} p-4 sm:p-6 shadow-sm transition-all duration-200`}
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                {/* Left Side: Cluster Info */}
                <div className="flex items-center gap-3 flex-grow min-w-0">
                  <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${colors.badge} text-lg font-medium`}>
                    {index + 1}
                  </span>
                  <h4 className={`text-lg sm:text-xl font-medium ${colors.text} truncate`}>
                    {cluster.clusterName}
                  </h4>
                </div>
                
                {/* Right Side: Total Volume & Action Buttons */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                    {/* Total Volume */} 
                    {cluster.totalVolume > 0 && (
                      <div className={`flex items-center px-3 py-1 rounded-lg ${colors.badge} font-medium text-sm sm:text-base whitespace-nowrap`}>
                        <TrendingUp className="mr-1.5 h-4 w-4" />
                        <span>總量: {new Intl.NumberFormat().format(cluster.totalVolume)}</span>
                      </div>
                    )}
                    {/* Action Buttons - Grouped */}
                    <div className="flex gap-1 ml-auto sm:ml-0">
                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => copyKeywords(cluster.keywordList, index)}
                          title="複製關鍵詞"
                          className="h-8 w-8 rounded-full"
                        >
                          {copiedClusterIndex === index ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        
                        {/* 恢復單獨的用戶畫像按鈕 */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onStartPersonaChat(cluster.clusterName, cluster.keywordList)} 
                          title="生成用戶畫像" 
                          className="h-8 w-8 rounded-full"
                        > 
                          <User className="h-4 w-4" /> 
                        </Button>
                        
                        {cluster.highestVolumeKeyword && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSerpAnalysis(cluster.highestVolumeKeyword as string)}
                            title={`分析 "${cluster.highestVolumeKeyword}" SERP`}
                            className="h-8 w-8 rounded-full"
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleClusterExpand(cluster.clusterName)}
                          title={isExpanded ? "收起關鍵詞" : "展開關鍵詞"}
                          className="h-8 w-8 rounded-full"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                    </div>
                </div>
              </div>
              
              {/* User Persona Display (if available) */}
              {clusterPersona && (
                <div className="mb-4 text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-800/40 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="font-medium text-gray-800 dark:text-gray-100 mb-1.5 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-purple-500"/> 用戶畫像
                  </p>
                  {/* Preserve whitespace and newlines from persona text */} 
                  <p className="whitespace-pre-wrap">{clusterPersona}</p>
                </div>
              )}
              
              {/* Keyword List Table */}
              {visibleKeywords.length > 0 && (
                 <div className="overflow-x-auto -mx-4 sm:-mx-6">
                   <div className="min-w-full inline-block align-middle">
                     <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700/50">
                       <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
                         {visibleKeywords.map((keyword, kidx) => {
                           const volume = keywordVolumeMap[keyword.toLowerCase()] || 0;
                           const isHighVolume = kidx === 0 || volume > 1000;
                           
                           return (
                             <tr 
                               key={`${index}-kw-${kidx}`}
                               className={`border-b border-gray-200 dark:border-gray-700/50 last:border-b-0 ${
                                 isHighVolume ? 'bg-white/40 dark:bg-gray-800/20' : ''
                               }`}
                             >
                               <td className="py-2 px-2 w-10 text-center text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                                 {kidx + 1}
                               </td>
                               <td className={`py-2 px-2 text-sm sm:text-base ${isHighVolume ? 'font-semibold ' + colors.text : 'text-gray-800 dark:text-gray-200'}`}>
                                 {keyword}
                               </td>
                               <td className={`py-2 px-2 text-right whitespace-nowrap text-xs sm:text-sm ${isHighVolume ? 'font-bold ' + colors.volume : 'text-gray-500 dark:text-gray-400'}`}>
                                 {volume > 0 ? new Intl.NumberFormat().format(volume) : '-'}
                               </td>
                             </tr>
                           );
                         })}
                       </tbody>
                     </table>
                   </div>
                 </div>
              )}
              
              {/* Show More Keywords Button */}
              {!isExpanded && cluster.keywordList.length > DEFAULT_KEYWORDS_PER_CLUSTER && (
                <button 
                  className={`mt-3 text-sm sm:text-base ${colors.text} hover:underline font-medium w-full text-center py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10`}
                  onClick={() => toggleClusterExpand(cluster.clusterName)}
                >
                  顯示全部 {cluster.keywordList.length} 個關鍵詞
                </button>
              )}

            </div> // End cluster card
          );
        })} 
      </div> {/* End space-y-8 */} 

      {/* Show All Clusters Button (if applicable) - Moved outside the map */} 
      {sortedClusters.length > DEFAULT_VISIBLE_CLUSTERS && !showAllClusters && (
          <div className="mt-8 text-center">
            <Button variant="outline" onClick={toggleShowAll}>
              顯示全部 {sortedClusters.length} 個分群
            </Button>
          </div>
      )}

    </div> // End main container
  );
} 