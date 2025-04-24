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
import type { KeywordVolumeItem, ClusterItem } from '@/app/services/firebase/types'; // <-- CORRECT PATH & Added ClusterItem
import { formatVolume } from '@/lib/utils'; // <-- Import formatVolume

// Define structure for processed cluster data (used internally)
interface ProcessedCluster {
  clusterName: string;
  keywordList: KeywordVolumeItem[]; // Keep original KeywordVolumeItem structure
  totalVolume: number;
  longTailKeywords: KeywordVolumeItem[]; // Store KeywordVolumeItem
  highestVolumeKeyword: KeywordVolumeItem | null;
  personaDescription?: string; // Optional persona description
}

// Updated Props for the display component
interface KeywordClusteringProps {
  // keywordVolumeMap: Record<string, number>; // Keep this for quick lookups <-- Remove
  clusters: ClusterItem[] | null; // ClusterItem now includes personaDescription?
  // researchRegion: string; <-- Remove
  // researchLanguage: string; <-- Remove
  // currentKeywords: string[]; <-- Remove
  selectedResearchDetail: {
    query: string;
  } | null;
  researchId: string;
  onSavePersona: (clusterName: string) => Promise<void>;
  isSavingPersona: string | null;
}

export default function KeywordClustering({
  clusters,
  selectedResearchDetail,
  researchId,
  onSavePersona,
  isSavingPersona,
}: KeywordClusteringProps) {
  const router = useRouter();

  // Local UI state
  const [expandedSupportingMap, setExpandedSupportingMap] = useState<
    Record<number, boolean>
  >({});

  // Check if clusters array is valid and not empty 
  const hasValidClusters = useMemo(() => {
    return clusters && Array.isArray(clusters) && clusters.length > 0;
  }, [clusters]);

  // Memoize sorted clusters with summaries (SIMPLIFIED)
  const sortedClusters = useMemo((): ProcessedCluster[] => {
    if (!hasValidClusters || !clusters) return []; 
    
    const clustersWithSummaries = clusters.map(
      (clusterItem) => { // clusterItem is ClusterItem, includes personaDescription?
        const validKeywordList: KeywordVolumeItem[] = Array.isArray(clusterItem.keywords) ? clusterItem.keywords : [];
        
        if (validKeywordList.length === 0) {
          console.warn(`[KeywordClustering] Empty keyword list for cluster: ${clusterItem.clusterName}`);
        }
        
        // Sort keywords within the cluster by volume (descending)
        const sortedKeywords = [...validKeywordList].sort(
          (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0)
        );
        
        // Directly use the pre-calculated totalVolume from the prop
        // Provide a default of 0 if it's somehow missing or not a number
        const totalVolume = typeof clusterItem.totalVolume === 'number' 
            ? clusterItem.totalVolume 
            : 0; 
            
        // Find long-tail keywords (more than 2 words)
        const longTailKeywords = sortedKeywords.filter(
          keyword => keyword.text && keyword.text.trim().split(/\s+/).length > 2
        );
        
        return {
          clusterName: clusterItem.clusterName,
          keywordList: sortedKeywords, 
          totalVolume, // Use the direct totalVolume
          longTailKeywords, 
          highestVolumeKeyword: sortedKeywords[0] || null,
          personaDescription: clusterItem.personaDescription // Pass it through
        };
      }
    );
    
    // Sort the processed clusters by total volume (descending)
    return clustersWithSummaries.sort((a, b) => b.totalVolume - a.totalVolume);
    
  }, [clusters, hasValidClusters]); // Depend on the clusters prop


  // Modified: Use the passed callback for starting persona generation/saving
  const onStartPersonaChat = (clusterName: string) => { 
      if (!clusterName) { // Check only clusterName
        toast.error('無法生成用戶畫像：缺少分群名稱');
        return;
      }
      if (!researchId) {
        toast.error('無法生成用戶畫像：未找到研究項目ID');
        return;
      }
      // Call onSavePersona with only clusterName
      onSavePersona(clusterName);
    };

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
  const handleGoogleSearch = (keyword: KeywordVolumeItem | string | null) => {
    const text = typeof keyword === 'string' ? keyword : keyword?.text;
    if (!text) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Handler for starting new research - Simplified to use URL params
  const handleNewResearch = (keyword: KeywordVolumeItem | string | null) => {
      const text = typeof keyword === 'string' ? keyword : keyword?.text;
      if (!text) return;
      toast.info(`開始新研究: "${text}"`);
      const targetUrl = `/keyword-mapping?q=${encodeURIComponent(text)}`;
      router.push(targetUrl);
    };

  // --- Render Logic ---

  // Case: No clusters passed from parent
  if (!hasValidClusters || sortedClusters.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">未找到分群結果</h3>
      </div>
    );
  }

  // Display all clusters now
  const displayClusters = sortedClusters;
  
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
          {displayClusters.map((cluster: ProcessedCluster, index) => {
            // Use the KeywordVolumeItem object directly
            const mainAxisKeywordItem = cluster.highestVolumeKeyword;
            const mainAxisKeywordText = mainAxisKeywordItem?.text || '-';
            const mainAxisVolume = formatVolume(mainAxisKeywordItem?.searchVolume ?? 0);

            // Filter supporting keywords (which are KeywordVolumeItem)
            const allSupportingKeywords = cluster.keywordList
              .filter(kw => kw.text !== mainAxisKeywordText) // Compare text
              .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));

            const topSupportingKeywords = allSupportingKeywords.slice(0, 3);
            const remainingCount = allSupportingKeywords.length - topSupportingKeywords.length;
            const isExpanded = !!expandedSupportingMap[index];

            // Calculate unique remainders based on KeywordVolumeItem.text
            let clusterUniqueRemaindersString = '-';
            if (mainQuery) {
              const remainderStrings = new Set<string>();
              cluster.keywordList.forEach(keywordItem => {
                if (!keywordItem.text) return;
                const keywordChars = keywordItem.text.split('');
                const remainder = keywordChars
                  .filter((char: string) => !mainQueryChars.has(char)) // <-- ADDED TYPE
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

            const isGeneratingThisPersona = isSavingPersona === cluster.clusterName;

            // --- SIMPLIFY PERSONA ACCESS ---
            // const originalClusterItem = clusters?.find(c => c.clusterName === cluster.clusterName); // No longer needed
            // const currentPersona = originalClusterItem?.personaDescription; // Use directly from processed cluster
            const currentPersona = cluster.personaDescription; // <-- Use persona from ProcessedCluster

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
                    {formatVolume(cluster.totalVolume)}
                  </div>
                </div>

                {/* Cell 2: Main Keyword / Volume (Use KeywordVolumeItem) */}
                <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    主軸關鍵字 / 量
                  </div>
                  <div title={mainAxisKeywordText}>
                    {mainAxisKeywordText}{' '}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80 cursor-pointer hover:underline">
                          ({mainAxisVolume})
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => handleNewResearch(mainAxisKeywordItem)} // Pass item
                          disabled={!mainAxisKeywordItem}
                        >
                          <FilePlus2 className="mr-2 h-4 w-4" />
                          <span>以此關鍵詞開始新研究</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleGoogleSearch(mainAxisKeywordItem)} // Pass item
                          disabled={!mainAxisKeywordItem}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>Google 查詢</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Cell 3: Supporting Keywords / Volume (Use KeywordVolumeItem) */}
                <div className="p-3 md:w-1/2 lg:w-[30%] flex-grow border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    輔助關鍵字 / 量
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(isExpanded
                      ? allSupportingKeywords
                      : topSupportingKeywords
                    ).map((kwItem, i, arr) => (
                      <span key={kwItem.text || i} className="inline-flex items-baseline">
                        <span>{kwItem.text}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80 ml-0.5 cursor-pointer hover:underline">
                              ({formatVolume(kwItem.searchVolume ?? 0)})
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={() => handleNewResearch(kwItem)} // Pass item
                            >
                              <FilePlus2 className="mr-2 h-4 w-4" />
                              <span>以此關鍵詞開始新研究</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleGoogleSearch(kwItem)} // Pass item
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              <span>Google 查詢</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {i < arr.length - 1 && (
                          <span className="text-muted-foreground/60 mx-1">/</span>
                        )}
                      </span>
                    ))}
                    {!isExpanded && remainingCount > 0 && (
                      <Button
                        variant="ghost"
                        className="text-xs h-auto px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded ml-1"
                        onClick={() => toggleSupportingKeywords(index)}
                      >
                        <PlusCircle className="h-3 w-3 mr-0.5" />+{remainingCount}
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
                  {currentPersona ? ( // <-- Check the simplified currentPersona
                    // Display existing persona
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        用戶畫像
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {currentPersona} {/* <-- Display description */}
                      </div>
                    </div>
                  ) : (
                    // Show button to generate persona
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() =>
                        // Pass only clusterName to onStartPersonaChat
                        onStartPersonaChat(cluster.clusterName)
                      }
                      disabled={isGeneratingThisPersona || !!isSavingPersona}
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
