'use client';

import { Button } from "@/components/ui/button";
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, FilePlus2, LayoutGrid, Loader2, Search, TrendingUp, User, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from 'next/navigation';

// Constants for display
// const DEFAULT_VISIBLE_CLUSTERS = 3; // Keep all visible by default now
// const DEFAULT_KEYWORDS_PER_CLUSTER = 5; // Show all keywords

// Define structure for processed cluster data
interface ProcessedCluster {
  clusterName: string;
  keywordList: string[];
  totalVolume: number;
  longTailKeywords: string[]; // Keep list
  highestVolumeKeyword: string | null;
}

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
  researchId: string; // <<< Added researchId prop
  onSavePersona: (clusterName: string, keywords: string[]) => Promise<void>; // <<< Added callback prop for saving persona
  isSavingPersona: string | null; // <<< Added prop to indicate saving state for a specific persona
  onRecluster: () => void; // <<< Added prop for recluster action
  isClustering: boolean; // <<< Added prop for loading state
}

export default function KeywordClustering({ 
  keywordVolumeMap, 
  clusters, 
  personasMap, 
  researchLocation, 
  researchLanguage,
  currentKeywords,
  selectedResearchDetail,
  researchId, // <<< Destructure new prop
  onSavePersona, // <<< Destructure new prop
  isSavingPersona, // <<< Destructure new prop
  onRecluster, // <<< Destructure new prop
  isClustering, // <<< Destructure new prop
}: KeywordClusteringProps) {
  const router = useRouter();
  // Remove setQuery from store
  // const setQuery = useQueryStore((state) => state.actions.setQuery);
  
  // Local UI state - Remove expandedClusters
  const [uiState, setUiState] = useState({
    copiedClusterIndex: null as number | null,
    // expandedClusters: {} as Record<string, boolean> 
  });
  const { copiedClusterIndex } = uiState; // Remove expandedClusters from destructuring
  
  // Global stores - Only needed for actions triggered from here
  // const requestSerpAnalysis = useResearchStore((state) => state.actions.requestSerpAnalysis);
  // const selectedResearchId = useResearchStore((state) => state.state.selectedResearchId);
  // const savePersonas = useResearchStore((state) => state.actions.savePersonas);
  
  const updateUiState = useCallback((newState: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...newState }));
  }, []);

  // Removed handleClustering and related useEffects - Logic moved to page.tsx
  
  // Removed useEffect for loading keywords/clusters - Data is passed via props

  // Memoize sorted clusters with summaries including long-tail keyword list
  const sortedClusters = useMemo((): ProcessedCluster[] => {
    if (!clusters) return [];
    const clustersWithSummaries = Object.entries(clusters).map(([clusterName, keywordList]) => {
      const sortedKeywords = [...keywordList].sort((a, b) => (keywordVolumeMap[b.toLowerCase()] || 0) - (keywordVolumeMap[a.toLowerCase()] || 0));
      const totalVolume = sortedKeywords.reduce((sum, keyword) => sum + (keywordVolumeMap[keyword.toLowerCase()] || 0), 0);
      const longTailKeywords = sortedKeywords.filter(keyword => keyword.trim().split('\s+').length > 2);
      return {
        clusterName,
        keywordList: sortedKeywords,
        totalVolume,
        longTailKeywords,
        highestVolumeKeyword: sortedKeywords[0] || null
      };
    });
    return clustersWithSummaries.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clusters, keywordVolumeMap]); 

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

  // Modified: Use the passed callback for starting persona generation/saving
  const onStartPersonaChat = useCallback((clusterName: string, keywords: string[]) => {
    if (!clusterName || !keywords || keywords.length === 0) {
      toast.error("無法生成用戶畫像：缺少必要數據");
      return;
    }
    if (!researchId) {
      toast.error("無法生成用戶畫像：未找到研究項目ID"); // Use prop for ID check
      return;
    }
    // Call the parent's handler
    onSavePersona(clusterName, keywords);
    // Note: Loading indication and toasts are now handled in the parent (KeywordResearchDetail)
  }, [researchId, onSavePersona]); // Depend on props

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

  // Define main query variables here to be accessible in both scopes
  const mainQuery = selectedResearchDetail?.query || '';
  const mainQueryChars = mainQuery ? new Set(mainQuery.split('')) : new Set<string>();

  // Helper for Google Search
  const handleGoogleSearch = (keyword: string) => {
      if (!keyword) return;
      const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handler for starting new research - Simplified to use URL params
  const handleNewResearch = useCallback((keyword: string) => {
      if (!keyword) return;
      // Remove setQuery call
      // setQuery(keyword);
      toast.info(`開始新研究: "${keyword}"`);
      const targetUrl = `/tools/keyword?q=${encodeURIComponent(keyword)}`;
      router.push(targetUrl);
  }, [router]); // Remove setQuery from dependencies

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

  // Display all clusters now
  const displayClusters = sortedClusters;
  const totalKeywordsCount = sortedClusters.reduce((sum, cluster) => sum + cluster.keywordList.length, 0);

  return (
    <TooltipProvider delayDuration={200}> 
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Title and Summary List */}
        <div className="mb-10 pb-5 border-b">
            <div className="flex justify-between items-center mb-3"> {/* Wrap title and button */}
                <h1 className="text-3xl font-semibold tracking-tight flex-1 mr-4"> {/* Allow title to shrink */}
                   關鍵詞 "{mainQuery}" 的分群結果共 {sortedClusters.length} 個分群，包含 {totalKeywordsCount} 個關鍵詞
                </h1>
                {/* Recluster Button Added Here */} 
                <Tooltip>
                    <TooltipTrigger asChild>
                        {/* Use LoadingButton if available or adapt Button */}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={onRecluster} 
                            disabled={isClustering}
                        >
                            {isClustering ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            重新分群
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        {isClustering ? "正在重新分群..." : "重新觸發關鍵詞分群"}
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                {sortedClusters.map((cluster, index) => (
                    <div key={index} className="flex-1 min-w-[150px]">
                        <p className="text-base font-medium text-foreground mb-0.5 truncate" title={cluster.clusterName}>{cluster.clusterName}</p>
                        <p className="text-sm text-muted-foreground"><TrendingUp className="inline-block h-3.5 w-3.5 mr-1" />{cluster.totalVolume.toLocaleString()}</p>
                    </div>
                ))}
            </div>
            {(() => {
                 if (!mainQuery) return null; // Cannot calculate without main query

                 const allKeywords = sortedClusters.flatMap(cluster => cluster.keywordList);
                 const remainderStrings = new Set<string>();

                 allKeywords.forEach(keyword => {
                     const keywordChars = keyword.split('');
                     const remainder = keywordChars.filter(char => !mainQueryChars.has(char)).join('').trim();
                     if (remainder) {
                         remainderStrings.add(remainder);
                     }
                 });
                 const uniqueRemainders = [...remainderStrings].sort();
                 if (uniqueRemainders.length === 0) return null;
                 return (
                     <div className="mt-5 pt-4 border-t border-dashed">
                        <p className="text-base font-medium text-foreground mb-1.5">
                            <LayoutGrid className="inline-block h-4 w-4 mr-1.5 align-text-bottom" /> 
                            長尾字詞：
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                           {uniqueRemainders.join(', ')}
                        </p>
                     </div>
                 );
             })()}
        </div>

        {/* Clusters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayClusters.map((cluster, index) => {
            const colors = getClusterColors(index);
            const personaText = personasMap?.[cluster.clusterName];
            const keywordsToShow = cluster.keywordList; // Always show all keywords
            
            // Calculate cluster-specific remainders here
            let clusterUniqueRemainders: string[] = [];
            if (mainQuery) { // Only calculate if mainQuery exists
                const remainderStrings = new Set<string>();
                cluster.keywordList.forEach(keyword => {
                    const keywordChars = keyword.split('');
                    const remainder = keywordChars.filter(char => !mainQueryChars.has(char)).join('').trim();
                    if (remainder) {
                        remainderStrings.add(remainder);
                    }
                });
                clusterUniqueRemainders = [...remainderStrings].sort();
            }

            const isCurrentlySaving = isSavingPersona === cluster.clusterName; // Check if this cluster is saving

            return (
              <div key={index} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200 flex flex-col`}>
                {/* Cluster Header */}
                <div className={`p-5 border-b ${colors.border} flex justify-between items-start gap-3`}>
                   <div className="flex-1 space-y-2">
                      <h3 className={`text-lg font-semibold ${colors.text} break-words`}>#{index + 1}. {cluster.clusterName}</h3>
                      <div className="text-sm text-muted-foreground flex items-center">
                          <TrendingUp className="h-4 w-4 mr-1.5 opacity-80" />
                          總搜尋量: <span className={`font-semibold text-base ml-1 ${colors.volume}`}>{cluster.totalVolume.toLocaleString()}</span>
                      </div>
                   </div>
                   <div className="flex flex-col items-end space-y-1.5 flex-shrink-0">
                       <Tooltip>
                           <TooltipTrigger asChild>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className={`h-7 w-7 rounded-full ${colors.text}/70 hover:${colors.text} ${personaText ? 'cursor-default' : ''}`} 
                               onClick={!personaText && !isCurrentlySaving ? () => onStartPersonaChat(cluster.clusterName, cluster.keywordList) : undefined} 
                               disabled={!!personaText || isCurrentlySaving} 
                               aria-label={personaText ? "用戶畫像已生成" : isCurrentlySaving ? "正在生成用戶畫像..." : "生成用戶畫像"}
                              >
                                {isCurrentlySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (personaText ? <User className="h-4 w-4 opacity-70" /> : <User className="h-4 w-4" />)}
                             </Button>
                           </TooltipTrigger>
                           <TooltipContent side="top">{personaText ? "用戶畫像已生成" : isCurrentlySaving ? "正在生成..." : "生成用戶畫像"}</TooltipContent>
                       </Tooltip>
                       <Tooltip>
                           <TooltipTrigger asChild><Button variant="ghost" size="icon" className={`h-7 w-7 rounded-full ${colors.text}/70 hover:${colors.text}`} onClick={() => copyKeywords(cluster.keywordList, index)} aria-label="複製關鍵詞">{copiedClusterIndex === index ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></TooltipTrigger>
                           <TooltipContent side="top">複製此分群的關鍵詞</TooltipContent>
                       </Tooltip>
                   </div>
                 </div>

                {/* Persona Display */}
                {personaText && (
                  <div className={`p-5 border-b ${colors.border} bg-background/40`}>
                      <p className="text-sm font-medium text-muted-foreground mb-2">用戶畫像:</p>
                      <p className="text-base italic text-foreground/90 leading-relaxed">{personaText}</p>
                  </div>
                )}

                {/* Keyword List with added New Research button */}
                <div className="p-5 max-h-80 overflow-y-auto flex-grow scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                  <ul className="space-y-2.5">
                    {keywordsToShow.map((keyword, kwIndex) => (
                      <li key={kwIndex} className="text-base flex justify-between items-center gap-2 group rounded-md p-1 -m-1 hover:bg-foreground/5 transition-colors duration-150">
                        <span className="flex-1 truncate" title={keyword}>{keyword}</span>

                        {/* Made volume and buttons always visible */}
                        <div className="flex items-center flex-shrink-0 space-x-1.5 transition-opacity duration-150"> 
                            {/* Add a subtle divider if volume exists */}
                            {keywordVolumeMap[keyword.toLowerCase()] !== undefined && <span className="text-muted-foreground/40">|</span>}
                            <span className={`text-sm font-mono ${colors.volume} ml-1`}>{keywordVolumeMap[keyword.toLowerCase()]?.toLocaleString() ?? '-'}</span>
                            
                            {/* Buttons section - still show on hover for less clutter? Or always visible? 
                                Let's keep buttons on hover for now to avoid visual overload. 
                                We can make them always visible too if preferred. 
                            */}
                             <div className="flex items-center flex-shrink-0 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-full ${colors.text}/60 hover:${colors.text}/90`} onClick={() => handleNewResearch(keyword)} aria-label={`以此關鍵詞開始新研究 "${keyword}"`}>
                                            <FilePlus2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">以此關鍵詞開始新研究</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-full ${colors.text}/60 hover:${colors.text}/90`} onClick={() => handleGoogleSearch(keyword)} aria-label={`Google 查詢 "${keyword}"`}>
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Google 查詢</TooltipContent>
                                </Tooltip>
                             </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cluster-Specific Long-Tail Section */}
                {clusterUniqueRemainders.length > 0 && (
                  <div className={`p-5 border-t ${colors.border} bg-gradient-to-b from-transparent to-${colors.bg.split('-')[1]}-50/30 dark:to-${colors.bg.split('-')[1]}-900/10`}>
                    <p className={`text-base font-medium ${colors.text} mb-1.5`}>
                        <LayoutGrid className="inline-block h-4 w-4 mr-1.5 align-text-bottom opacity-80" /> 
                        此分群長尾字詞：
                    </p> 
                    <p className={`text-sm ${colors.text}/90 leading-relaxed`}>
                      {clusterUniqueRemainders.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Remove Show More Button */}
        {/* {sortedClusters.length > DEFAULT_VISIBLE_CLUSTERS && ( ... )} */} 
      </div>
    </TooltipProvider>
  );
} 