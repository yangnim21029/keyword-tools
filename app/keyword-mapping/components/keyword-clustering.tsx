'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ExternalLink,
  FilePlus2,
  LayoutGrid,
  Loader2,
  PlusCircle,
  Sparkles,
  TrendingUp,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ClusteringStatus } from '@/lib/schema';


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
  researchRegion: string; // Needed for SERP analysis
  researchLanguage: string; // Needed for SERP analysis
  currentKeywords: string[];
  selectedResearchDetail: {
    query: string;
  } | null;
  researchId: string;
  onSavePersona: (clusterName: string, keywords: string[]) => Promise<void>;
  isSavingPersona: string | null;
  clusteringStatus: ClusteringStatus;
}

export default function KeywordClustering({
  keywordVolumeMap,
  clusters,
  personasMap,
  researchRegion,
  researchLanguage,
  currentKeywords,
  selectedResearchDetail,
  researchId,
  onSavePersona,
  isSavingPersona,
  clusteringStatus
}: KeywordClusteringProps) {
  const router = useRouter();
  // Remove setQuery from store
  // const setQuery = useQueryStore((state) => state.actions.setQuery);

  // Local UI state
  const [uiState, setUiState] = useState({
    copiedClusterIndex: null as number | null
  });
  const { copiedClusterIndex } = uiState;
  const [expandedSupportingMap, setExpandedSupportingMap] = useState<
    Record<number, boolean>
  >({});

  // --- State for Persona Expansion ---
  const [expandedPersonas, setExpandedPersonas] = useState<
    Record<string, boolean>
  >({});

  const updateUiState = useCallback((newState: Partial<typeof uiState>) => {
    setUiState(prev => ({ ...prev, ...newState }));
  }, []);

  // --- Toggle Persona Expansion Function ---
  const togglePersonaExpansion = useCallback((clusterName: string) => {
    setExpandedPersonas(prev => ({
      ...prev,
      [clusterName]: !prev[clusterName]
    }));
  }, []);


  // Memoize sorted clusters with summaries including long-tail keyword list
  const sortedClusters = useMemo((): ProcessedCluster[] => {
    if (!clusters || !keywordVolumeMap) return [];
    const clustersWithSummaries = Object.entries(clusters).map(
      ([clusterName, keywordList]) => {
        const validKeywordList = Array.isArray(keywordList) ? keywordList : [];
        const sortedKeywords = [...validKeywordList].sort(
          (a, b) =>
            (keywordVolumeMap[b.toLowerCase()] || 0) -
            (keywordVolumeMap[a.toLowerCase()] || 0)
        );
        const totalVolume = sortedKeywords.reduce(
          (sum, keyword) =>
            sum +
            (typeof keyword === 'string'
              ? keywordVolumeMap[keyword.toLowerCase()] || 0
              : 0),
          0
        );
        const longTailKeywords = sortedKeywords.filter(
          keyword =>
            typeof keyword === 'string' && keyword.trim().split('s+').length > 2 // Fixed regex
        );
        return {
          clusterName,
          keywordList: sortedKeywords,
          totalVolume,
          longTailKeywords,
          highestVolumeKeyword: sortedKeywords[0] || null
        };
      }
    );
    return clustersWithSummaries.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [clusters, keywordVolumeMap]);


  // Modified: Use the passed callback for starting persona generation/saving
  const onStartPersonaChat = useCallback(
    (clusterName: string, keywords: string[]) => {
      if (!clusterName || !keywords || keywords.length === 0) {
        toast.error('無法生成用戶畫像：缺少必要數據');
        return;
      }
      if (!researchId) {
        toast.error('無法生成用戶畫像：未找到研究項目ID'); // Use prop for ID check
        return;
      }
      // Call the parent's handler
      onSavePersona(clusterName, keywords);
      // Note: Loading indication and toasts are now handled in the parent (KeywordResearchDetail)
    },
    [researchId, onSavePersona]
  ); // Depend on prop

  // Toggle function
  const toggleSupportingKeywords = (index: number) => {
    setExpandedSupportingMap(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Define main query variables here to be accessible in both scopes
  const mainQuery = selectedResearchDetail?.query || '';
  const mainQueryChars = mainQuery
    ? new Set(mainQuery.split(''))
    : new Set<string>();

  // Helper for Google Search
  const handleGoogleSearch = (keyword: string) => {
    if (!keyword) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(
      keyword
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handler for starting new research - Simplified to use URL params
  const handleNewResearch = useCallback(
    (keyword: string) => {
      if (!keyword) return;
      // Remove setQuery call
      // setQuery(keyword);
      toast.info(`開始新研究: "${keyword}"`);
      const targetUrl = `/keyword-mapping?q=${encodeURIComponent(keyword)}`;
      router.push(targetUrl);
    },
    [router]
  ); // Remove setQuery from dependencies

  // --- Render Logic ---

  // Case: No clusters passed from parent
  if (!clusters || sortedClusters.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">未找到分群結果</h3>
        <p className="text-muted-foreground">
          {clusters === null
            ? '正在等待分群數據...'
            : '未能從關鍵詞中生成有效分群。'}
        </p>
      </div>
    );
  }

  // Display all clusters now
  const displayClusters = sortedClusters;
  const totalKeywordsCount = sortedClusters.reduce(
    (sum, cluster) => sum + cluster.keywordList.length,
    0
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-5xl mx-auto">
        {/* Main Title and Summary List - This title is rendered inside the component */}

        {/* --- Table Layout Start --- */}
        {/* Hide traditional header on mobile, show labels in cards instead */}
        <div className="hidden md:flex bg-muted rounded-t-lg border-b border-border font-medium text-sm text-muted-foreground sticky top-0 z-10">
          <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0">
            主題 / 總量
          </div>
          <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0">
            主軸關鍵字 / 量
          </div>
          <div className="p-3 md:w-1/2 lg:w-[30%] flex-grow">
            輔助關鍵字 / 量
          </div>
          <div className="p-3 md:w-auto lg:w-[15%] flex-shrink-0">長尾字詞</div>
          <div className="p-3 md:w-auto lg:w-[25%] flex-shrink-0">用戶畫像</div>
        </div>

        {/* Table Body / Mobile Cards */}
        {/* Use space-y for mobile card spacing, border for desktop */}
        <div className="md:border-x md:border-b md:border-border md:rounded-b-lg space-y-4 md:space-y-0">
          {displayClusters.map((cluster, index) => {
            const mainAxisKeyword = cluster.highestVolumeKeyword || '-';
            const mainAxisVolume =
              keywordVolumeMap[
                mainAxisKeyword.toLowerCase()
              ]?.toLocaleString() ?? '-';

            const allSupportingKeywords = cluster.keywordList
              .filter(kw => kw !== mainAxisKeyword)
              .sort(
                (a, b) =>
                  (keywordVolumeMap[b.toLowerCase()] || 0) -
                  (keywordVolumeMap[a.toLowerCase()] || 0)
              );

            const topSupportingKeywords = allSupportingKeywords.slice(0, 3);
            const remainingCount =
              allSupportingKeywords.length - topSupportingKeywords.length;
            const isExpanded = !!expandedSupportingMap[index];

            let clusterUniqueRemaindersString = '-';
            if (mainQuery) {
              const remainderStrings = new Set<string>();
              cluster.keywordList.forEach(keyword => {
                const keywordChars = keyword.split('');
                const remainder = keywordChars
                  .filter(char => !mainQueryChars.has(char))
                  .join('')
                  .trim();
                if (remainder) {
                  remainderStrings.add(remainder);
                }
              });
              const sortedRemainders = [...remainderStrings].sort();
              if (sortedRemainders.length > 0) {
                clusterUniqueRemaindersString = sortedRemainders.join(', ');
              }
            }

            // Alternating background only for desktop rows
            const rowBackground =
              index % 2 === 0 ? 'md:bg-card' : 'md:bg-muted/40';

            const isPersonaExpanded = !!expandedPersonas[cluster.clusterName];
            const currentPersona = personasMap?.[cluster.clusterName] || null;
            const isGeneratingThisPersona =
              isSavingPersona === cluster.clusterName;

            return (
              // Mobile: card layout. Desktop: row layout.
              <div
                key={index}
                className={`flex flex-col md:flex-row text-sm border border-border rounded-lg md:border-t md:border-x-0 md:border-b-0 md:rounded-none md:-mt-px ${rowBackground} bg-card md:bg-transparent`} // Base bg-card for mobile cards
              >
                {/* Cell 1: Theme / Total Volume */}
                <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    主題 / 總量
                  </div>
                  <div
                    className="font-semibold"
                    title={cluster.clusterName}
                  >
                    {cluster.clusterName}
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    <TrendingUp className="inline-block h-3 w-3 mr-0.5" />
                    {cluster.totalVolume.toLocaleString()}
                  </div>
                </div>

                {/* Cell 2: Main Keyword / Volume */}
                <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    主軸關鍵字 / 量
                  </div>
                  <div title={mainAxisKeyword}>
                    {mainAxisKeyword}{' '}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80 cursor-pointer hover:underline">
                          ({mainAxisVolume})
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => handleNewResearch(mainAxisKeyword)}
                          disabled={!mainAxisKeyword || mainAxisKeyword === '-'}
                        >
                          <FilePlus2 className="mr-2 h-4 w-4" />
                          <span>以此關鍵詞開始新研究</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleGoogleSearch(mainAxisKeyword)}
                          disabled={!mainAxisKeyword || mainAxisKeyword === '-'}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>Google 查詢</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Cell 3: Supporting Keywords / Volume */}
                <div className="p-3 md:w-1/2 lg:w-[30%] flex-grow border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    輔助關鍵字 / 量
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(isExpanded
                      ? allSupportingKeywords
                      : topSupportingKeywords
                    ).map((kw, i, arr) => (
                      <span key={kw} className="inline-flex items-baseline">
                        <span>{kw}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80 ml-0.5 cursor-pointer hover:underline">
                              (
                              {keywordVolumeMap[
                                kw.toLowerCase()
                              ]?.toLocaleString() ?? '-'}
                              )
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleNewResearch(kw)}
                            >
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              <span>以此關鍵詞開始新研究</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleGoogleSearch(kw)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              <span>Google 查詢</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {i < arr.length - 1 && (
                          <span className="text-muted-foreground/60 mx-1">
                            /
                          </span>
                        )}
                      </span>
                    ))}
                    {!isExpanded && remainingCount > 0 && (
                      <Button
                        variant="ghost"
                        className="text-xs h-auto px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded ml-1"
                        onClick={() => toggleSupportingKeywords(index)}
                      >
                        <PlusCircle className="h-3 w-3 mr-0.5" />+
                        {remainingCount}
                      </Button>
                    )}
                  </div>
                  {isExpanded && remainingCount > 0 && (
                    <Button
                      variant="ghost"
                      className="text-xs h-auto px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded mt-1"
                      onClick={() => toggleSupportingKeywords(index)}
                    >
                      收合
                    </Button>
                  )}
                </div>

                {/* Cell 4: Long Tail Words */}
                <div className="p-3 md:w-auto lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border whitespace-normal">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    長尾字詞
                  </div>
                  {clusterUniqueRemaindersString}
                </div>

                {/* === Cell 5: Persona === */}
                <div className="p-3 md:w-auto lg:w-[25%] flex-shrink-0 space-y-2">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    用戶畫像
                  </div>
                  {currentPersona ? (
                    // Display existing persona directly
                    <div>
                      {/* Remove the toggle Button */}
                      {/* <Button ... /> */}

                      {/* Add a simple label */}
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        用戶畫像
                      </div>
                      {/* Display persona text directly */}
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {' '}
                        {/* Retain text styling */}
                        {currentPersona}
                      </div>
                    </div>
                  ) : (
                    // Show button to generate persona
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() =>
                        onStartPersonaChat(
                          cluster.clusterName,
                          cluster.keywordList
                        )
                      }
                      disabled={isGeneratingThisPersona || !!isSavingPersona} // Disable if generating this OR any other persona
                    >
                      {isGeneratingThisPersona ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      {isGeneratingThisPersona ? '正在生成...' : '生成用戶畫像'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {displayClusters.length ===
            0 /* Handle empty state inside table */ && (
            <div className="p-4 text-center text-muted-foreground italic bg-card">
              沒有找到分群數據。
            </div>
          )}
        </div>
        {/* --- Table Layout End --- */}
      </div>
    </TooltipProvider>
  );
}
