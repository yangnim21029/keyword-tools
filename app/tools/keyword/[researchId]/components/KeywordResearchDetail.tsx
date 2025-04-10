"use client"

import { ToolHeader } from "../../ToolHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from 'next/navigation';

// Shadcn UI Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Actions
import { 
    performSemanticClustering, 
    updateKeywordResearchClusters, 
    updateKeywordResearchPersonas 
} from "@/app/actions";
import { generateUserPersonaFromClusters } from "@/app/actions/generatePersona";

// Internal Components
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "../../EmptyState";
import KeywordClustering from "../../KeywordClustering";

// Types
import { type KeywordResearchItem, UpdateClustersInput, UpdatePersonasInput, Keyword } from "@/app/types";

interface KeywordResearchDetailProps {
  initialResearchDetail: KeywordResearchItem;
  researchId: string;
}

export default function KeywordResearchDetail({ initialResearchDetail, researchId }: KeywordResearchDetailProps) {
  const router = useRouter();
  const settingsState = useSettingsStore((store) => store.state)
  
  // Local State
  const [isClustering, setIsClustering] = useState(false);
  const [isGeneratingPersonas, setIsGeneratingPersonas] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o-mini");
  const [view, setView] = useState<'volume' | 'cluster'>('volume'); 

  // --- Data Processing Memos ---

  // 1. Get Sorted Unique Keywords
  const sortedUniqueKeywords = useMemo((): Keyword[] => {
    console.log("[KeywordResearchDetail] Recalculating sortedUniqueKeywords...");
    const uniqueKeywords = new Map<string, Keyword>();
    (initialResearchDetail?.keywords || []).forEach(kw => {
      const text = kw.text?.trim().toLowerCase();
      if (text && !uniqueKeywords.has(text)) {
        uniqueKeywords.set(text, kw);
      }
    });
    const keywordsArray = Array.from(uniqueKeywords.values());
    // Sort by volume descending
    keywordsArray.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
    return keywordsArray;
  }, [initialResearchDetail?.keywords]);

  // 2. Memoize raw clusters from prop
  const currentClusters = useMemo(() => {
    console.log("[KeywordResearchDetail] Recalculating currentClusters...");
    return initialResearchDetail?.clusters || null;
  }, [initialResearchDetail]);

  // 3. Memoize raw personas from prop
  const currentPersonas = useMemo(() => {
    return initialResearchDetail?.personas || null;
  }, [initialResearchDetail]);

  // 4. Keyword Volume Map (for potential use later, uses deduplicated data)
  const keywordVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    sortedUniqueKeywords.forEach(item => {
      const keywordText = item.text?.trim().toLowerCase();
      const volume = item.searchVolume ?? 0;
      if (keywordText) {
        map[keywordText] = volume;
      }
    });
    return map;
  }, [sortedUniqueKeywords]);

  // --- Set Initial View --- 
  useEffect(() => {
    // Set view to 'cluster' if clusters exist, otherwise default to 'volume'
    if (currentClusters && Object.keys(currentClusters).length > 0) {
      setView('cluster');
    } else {
      setView('volume');
    }
  }, [currentClusters]); // Run when clusters data changes (e.g., after clustering finishes)

  // --- Clustering Logic (modified to use deduplicated keywords) --- 
  const triggerClustering = useCallback(async () => {
    console.log("[KeywordResearchDetail] triggerClustering called."); 

    if (!researchId || sortedUniqueKeywords.length < 5) {
      console.warn("[KeywordResearchDetail] triggerClustering aborted: Missing researchId or not enough keywords.", { researchId, keywordsCount: sortedUniqueKeywords.length });
      setLocalError("Cannot start clustering: Need research ID and at least 5 unique keywords.");
      return;
    }

    console.log("[KeywordResearchDetail] Setting isClustering = true");
    setIsClustering(true);
    setLocalError(null);
    // Use deduplicated and potentially volume-sorted keywords for clustering
    const keywordsToCluster = sortedUniqueKeywords
      .map(k => k.text?.trim())
      .filter((text): text is string => Boolean(text))
      .slice(0, 150); // Use slice if needed

    console.log(`[KeywordResearchDetail] Starting semantic clustering with ${keywordsToCluster.length} keywords using model ${selectedModel}...`);
    try {
      const clusterResult = await performSemanticClustering({ keywords: keywordsToCluster, model: selectedModel });
      
      console.log("[KeywordResearchDetail] Semantic clustering finished.", clusterResult);
      
      if (!clusterResult.clusters || Object.keys(clusterResult.clusters).length === 0) {
         console.error("[KeywordResearchDetail] Clustering result invalid or empty.");
         throw new Error((clusterResult as { error?: string }).error || 'Clustering failed or returned no clusters.');
      }
      
      console.log("[KeywordResearchDetail] Saving clusters...");
      const updateInput: UpdateClustersInput = { clusters: clusterResult.clusters, updatedAt: new Date() }; // Temp updatedAt
      const updateResult = await updateKeywordResearchClusters(researchId, updateInput);
      
      if (updateResult.success) {
          console.log("[KeywordResearchDetail] Clusters saved successfully. Refreshing router...");
          toast.success("Keyword clustering complete!");
          router.refresh(); // Refresh to get updated clusters
          // setView('cluster'); // View will update automatically via useEffect
      } else {
          console.error("[KeywordResearchDetail] Failed to save clusters:", updateResult.error);
          throw new Error(updateResult.error || "Failed to save clusters.");
      }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown clustering error';
        console.error("[KeywordResearchDetail] Error during clustering process:", message, error);
        toast.error(`Clustering failed: ${message}`);
        setLocalError(`Clustering failed: ${message}`);
    } finally {
        console.log("[KeywordResearchDetail] Setting isClustering = false");
        setIsClustering(false);
    }
  }, [ researchId, sortedUniqueKeywords, selectedModel, router ]);

  // --- Effect to auto-trigger clustering if needed --- 
  useEffect(() => {
    console.log("[KeywordResearchDetail Auto-Cluster Effect] Checking conditions:", {
      hasClusters: !!(currentClusters && Object.keys(currentClusters).length > 0), 
      keywordsCount: sortedUniqueKeywords.length,
      isClustering: isClustering,
      currentClustersValue: currentClusters
    });

    const shouldTrigger = 
      !(currentClusters && Object.keys(currentClusters).length > 0) && 
      sortedUniqueKeywords.length >= 5 && 
      !isClustering; // Check inside the effect is sufficient

    if (shouldTrigger) {
      console.log("[KeywordResearchDetail Auto-Cluster Effect] Conditions met. Calling triggerClustering().");
      triggerClustering();
    } else {
      console.log("[KeywordResearchDetail Auto-Cluster Effect] Conditions not met. Skipping trigger.");
    }
    
    // REVISED Dependency Array: Remove isClustering
    // Only re-run check when the input data changes, or the trigger function identity changes (rare).
  }, [initialResearchDetail, triggerClustering]); // Removed isClustering

  // --- Persona Generation Logic (remains largely the same) --- 
  const handleSavePersona = useCallback(async (clusterName: string, keywords: string[]) => {
    console.log(`[KeywordResearchDetail] handleSavePersona called for cluster: ${clusterName}`);
    if (!researchId || !clusterName || keywords.length === 0) {
      toast.error("Cannot generate persona: Missing required data.");
      return;
    }
    setIsSavingPersona(clusterName);
    setLocalError(null);
    try {
      toast.info(`Generating persona for "${clusterName}"...`);
      const personaResult = await generateUserPersonaFromClusters({ clusterName, keywords, model: selectedModel });
      const personaText = personaResult.userPersona;

      const updatedPersonas = { ...(currentPersonas || {}), [clusterName]: personaText };

      toast.info(`Saving persona for "${clusterName}"...`);
      const updateInput: UpdatePersonasInput = { personas: updatedPersonas, updatedAt: new Date() };
      const updateResult = await updateKeywordResearchPersonas(researchId, updateInput);

      if (updateResult.success) {
        toast.success(`Persona for "${clusterName}" saved successfully!`);
        router.refresh();
      } else {
        throw new Error(updateResult.error || "Failed to save the generated persona.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error generating/saving persona';
      toast.error(`Failed for cluster "${clusterName}": ${message}`);
      setLocalError(`Failed to generate/save persona for "${clusterName}".`);
    } finally {
      setIsSavingPersona(null);
    }
  }, [researchId, currentPersonas, selectedModel, router]);

  const handleGenerateAllPersonas = useCallback(async () => {
    console.log("[KeywordResearchDetail] handleGenerateAllPersonas called.");
    if (!researchId || !currentClusters || Object.keys(currentClusters).length === 0) {
      toast.error("Cannot generate personas: No clusters available.");
      return;
    }
    setIsGeneratingPersonas(true);
    setLocalError(null);
    const clusterEntries = Object.entries(currentClusters);
    const generatedPersonas: Record<string, string> = { ...(currentPersonas || {}) }; 
    let errorsEncountered = 0;
    const personaPromises = clusterEntries.map(async ([clusterName, keywords]) => {
      if (!clusterName || !keywords || keywords.length === 0) return;
      if (generatedPersonas[clusterName]) return; 
      try {
        const personaResult = await generateUserPersonaFromClusters({ clusterName, keywords, model: selectedModel });
        generatedPersonas[clusterName] = personaResult.userPersona;
      } catch (error) {
        errorsEncountered++;
        toast.error(`Persona generation failed for cluster "${clusterName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    await Promise.allSettled(personaPromises);
    if (Object.keys(generatedPersonas).length > Object.keys(currentPersonas || {}).length) {
        try {
          const updateInput: UpdatePersonasInput = { personas: generatedPersonas, updatedAt: new Date() };
          const updateResult = await updateKeywordResearchPersonas(researchId, updateInput);
          if (updateResult.success) {
            if (errorsEncountered === 0) toast.success("All new user personas generated successfully!");
            else toast.warning(`Generated personas for ${clusterEntries.length - errorsEncountered} out of ${clusterEntries.length} clusters.`);
            router.refresh(); 
          } else {
             throw new Error(updateResult.error || "Failed to save personas.");
          }
        } catch (saveError) {
            toast.error(`Failed to save updated personas: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
            setLocalError(`Failed to save updated personas.`);
        }
    } else {
        toast.info("No new personas were generated.");
    }
    setIsGeneratingPersonas(false);
  }, [ researchId, currentClusters, currentPersonas, selectedModel, router ]);

  // --- RENDER LOGIC --- 

  if (localError) {
    return (
       <div className="space-y-4">
         <ToolHeader
            title="關鍵詞研究結果"
            description={initialResearchDetail?.query 
              ? `關鍵詞 "${initialResearchDetail.query}" 分析過程中發生錯誤` 
              : "處理請求時發生錯誤"}
            region={settingsState.region}
            language={settingsState.language}
            icon={<FileText className="h-5 w-5 text-blue-500" />}
         />
         <div className="flex items-center justify-center h-[50vh] text-center">
             <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-lg max-w-md">
                <h3 className="text-xl font-semibold text-destructive mb-2">發生錯誤</h3>
                <p className="text-destructive/90">{localError}</p>
             </div>
         </div>
       </div>
    );
  }

  if (!initialResearchDetail || !initialResearchDetail.query) {
     console.warn("[Render] Missing essential initial data.", initialResearchDetail);
     return (
         <div className="space-y-4">
           <ToolHeader
             title="關鍵詞研究工具"
             description="無法加載研究數據"
             region={settingsState.region}
             language={settingsState.language}
             icon={<FileText className="h-5 w-5 text-blue-500" />} 
           />
           <div className="flex items-center justify-center h-[50vh]">
              <EmptyState
                title="無法加載數據"
                description="提供的研究數據無效或不完整。"
              />
           </div>
         </div>
       );
  }

  // Determine if clusters exist for enabling the tab
  const hasClusters = !!(currentClusters && Object.keys(currentClusters).length > 0);

  return (
    <div className="space-y-6">
       <ToolHeader
          title="關鍵詞研究結果"
          description={`關鍵詞 "${initialResearchDetail.query}" 的分析結果 (共 ${sortedUniqueKeywords.length} 個獨特關鍵詞)`} // Use count from new memo
          region={settingsState.region}
          language={settingsState.language}
          icon={<FileText className="h-5 w-5 text-blue-500" />} 
       />
      
       {/* --- View Tabs --- */} 
       <Tabs value={view} onValueChange={(value) => setView(value as 'volume' | 'cluster')} className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2 mb-4">
            <TabsList>
              <TabsTrigger value="volume">搜索量視圖</TabsTrigger>
              <TabsTrigger value="cluster" disabled={!hasClusters && !isClustering}>
                {isClustering ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />分群中...</>) : "分群視圖"}
              </TabsTrigger>
            </TabsList>
            {/* Action Buttons - Move controls near relevant view trigger */} 
            <div className="flex flex-wrap items-center justify-end gap-2">
                {view === 'volume' && !hasClusters && sortedUniqueKeywords.length >= 5 && (
                    <LoadingButton 
                        onClick={triggerClustering}
                        isLoading={isClustering}
                        disabled={isClustering}
                        loadingText="分群中..."
                    >
                        生成分群
                    </LoadingButton>
                )}
                {view === 'cluster' && hasClusters && (
                    <>
                        <Select
                            value={selectedModel}
                            onValueChange={(value) => setSelectedModel(value as "gpt-4o-mini" | "gpt-4o")}
                            disabled={isGeneratingPersonas} 
                        >
                            <SelectTrigger className="w-[150px] sm:w-[180px]"><SelectValue placeholder="選擇模型" /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o (最佳質量)</SelectItem>
                            <SelectItem value="gpt-4o-mini">GPT-4o-mini (推薦)</SelectItem>
                            </SelectContent>
                        </Select>
                        <LoadingButton
                            onClick={handleGenerateAllPersonas}
                            isLoading={isGeneratingPersonas}
                            disabled={isGeneratingPersonas} 
                            loadingText="生成中..."
                            className="whitespace-nowrap"
                        >
                            {currentPersonas && Object.keys(currentPersonas).length > 0 ? "更新所有用戶畫像" : "生成所有用戶畫像"}
                        </LoadingButton>
                    </>
                )}
            </div>
          </div>
          
          <TabsContent value="volume">
             {/* --- Simplified Volume View with Columns --- */}
             <div className="border rounded-lg p-4">
                 <h3 className="text-lg font-semibold mb-3">關鍵詞列表 (按搜索量排序)</h3>
                 {sortedUniqueKeywords.length > 0 ? (
                     <ul className="space-y-0 text-sm text-muted-foreground 
                                   md:columns-2 md:gap-x-6 
                                   lg:columns-3 lg:gap-x-8 
                                   xl:columns-4"> {/* Apply CSS Columns */} 
                         {sortedUniqueKeywords.map((kw) => (
                             <li key={kw.text} className="flex justify-between items-center py-0.5 mb-1 break-inside-avoid"> {/* Remove border, add mb, prevent breaking inside column */} 
                                <span className="truncate pr-2" title={kw.text}>{kw.text}</span>
                                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{kw.searchVolume?.toLocaleString() ?? 'N/A'}</span>
                             </li>
                         ))}
                     </ul>
                 ) : (
                     <p className="text-muted-foreground italic">此研究沒有關鍵詞數據。</p>
                 )}
             </div>
          </TabsContent>

          <TabsContent value="cluster">
            {/* --- Cluster View Rendering --- */} 
             {hasClusters ? (
                 <KeywordClustering
                    keywordVolumeMap={keywordVolumeMap}
                    clusters={currentClusters}
                    personasMap={currentPersonas}
                    researchLocation={initialResearchDetail.location || settingsState.region}
                    researchLanguage={initialResearchDetail.language || settingsState.language}
                    currentKeywords={sortedUniqueKeywords.map(k => k.text || '').filter(Boolean)}
                    selectedResearchDetail={initialResearchDetail}
                    researchId={researchId}
                    onSavePersona={handleSavePersona}
                    isSavingPersona={isSavingPersona}
                 />
             ) : isClustering ? ( 
                 <div className="flex flex-col items-center justify-center h-[40vh] space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-md text-muted-foreground">正在進行語義分群...</p>
                 </div>
             ) : (
                 // Should not be reachable if tab is disabled correctly, but include fallback
                 <div className="flex items-center justify-center h-[40vh]">
                    <EmptyState title="無分群數據" description="請先生成分群。"/>
                 </div>
             )}
          </TabsContent>
       </Tabs>
    </div>
  );
} 