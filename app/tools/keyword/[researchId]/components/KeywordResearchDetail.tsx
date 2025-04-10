"use client"

import { ToolHeader } from "../../ToolHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResearchStore } from "@/store/keywordResearchStore";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Actions
import { performSemanticClustering } from "@/app/actions";
import { generateUserPersonaFromClusters } from "@/app/actions/generatePersona";

// Internal Components
import { LoadingButton } from "@/components/ui/LoadingButton";
import { EmptyState } from "../../EmptyState";
import KeywordClustering from "../../KeywordClustering";

// Types
import { type KeywordResearchItem } from "@/app/types/keyword-research.types";

// Define the steps for the results page workflow
type WorkflowStep = "loadingDetails" | "clustering" | "generatingPersonas" | "results" | "error";

interface KeywordResearchDetailProps {
  initialResearchDetail: KeywordResearchItem;
  researchId: string;
}

export default function KeywordResearchDetail({ initialResearchDetail, researchId }: KeywordResearchDetailProps) {
  // Access stores
  const settingsState = useSettingsStore((store) => store.state)
  const { selectedResearchDetail, loadingDetail } = useResearchStore((store) => store.state)
  const {
    setSelectedResearchId,
    saveClusters,
    savePersonas,
  } = useResearchStore((store) => store.actions)

  // State to track client-side mount and prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  // Main workflow state
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("loadingDetails");
  // Local state for errors
  const [localError, setLocalError] = useState<string | null>(null);
  // State for model selection
  const [selectedModel, setSelectedModel] = useState<"gpt-4o-mini" | "gpt-4o">("gpt-4o");

  // Get keywords, clusters, and personas from the selected research detail
  const currentKeywords = useMemo(() => {
    if (!selectedResearchDetail || selectedResearchDetail.id !== researchId) return [];
    return selectedResearchDetail.keywords || [];
  }, [selectedResearchDetail, researchId]);

  const currentClusters = useMemo(() => {
    if (!selectedResearchDetail || selectedResearchDetail.id !== researchId) return null;
    return selectedResearchDetail.clusters || null;
  }, [selectedResearchDetail, researchId]);

  const currentPersonas = useMemo(() => {
    if (!selectedResearchDetail || selectedResearchDetail.id !== researchId) return null;
    return selectedResearchDetail.personas || null;
  }, [selectedResearchDetail, researchId]);

  // Create a map of lowercase keyword to volume for KeywordClustering
  const keywordVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentKeywords.forEach(item => {
      const keywordText = (typeof item?.text === 'string') ? item.text.trim().toLowerCase() : '';
      const volume = (typeof item?.searchVolume === 'number') ? item.searchVolume : 0;
      if (keywordText) {
        map[keywordText] = volume;
      }
    });
    return map;
  }, [currentKeywords]);

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Clustering Logic ---
  const triggerClustering = useCallback(async () => {
    if (!researchId || !currentKeywords || currentKeywords.length < 5) {
      console.error("[Clustering] Pre-conditions not met.", { researchId, keywords: currentKeywords?.length });
      setLocalError("Cannot start clustering: Missing data or insufficient keywords.");
      setWorkflowStep("error");
      return;
    }

    console.log(`[Clustering] Starting clustering for research ID: ${researchId}`);
    setWorkflowStep("clustering");

    const keywordsToCluster = currentKeywords
      .map(k => k.text?.trim())
      .filter((text): text is string => Boolean(text))
      .slice(0, 150);

    const timeoutId = setTimeout(() => {
      if (workflowStep === "clustering") {
          toast.error('Clustering request timed out (60 seconds)');
          setLocalError('Clustering request timed out.');
          setWorkflowStep("error");
      }
    }, 60000);

    try {
      const result = await performSemanticClustering({
        keywords: keywordsToCluster,
        model: selectedModel
      });
      clearTimeout(timeoutId);

      if (result.clusters && Object.keys(result.clusters).length > 0) {
        console.log("[Clustering] Clustering successful. Saving results.");
        await saveClusters(researchId, { clusters: result.clusters, updatedAt: new Date() });
        console.log("[Clustering] Clusters saved.");
        setWorkflowStep("results");
        toast.success("Keyword clustering complete!");
      } else {
         const errorMessage = (result as { error?: string }).error || 'Clustering result format incorrect or no clusters found.';
         throw new Error(errorMessage);
      }
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        console.error("[Clustering] Clustering failed:", error);
        const message = error instanceof Error ? error.message : 'Unknown clustering error';
        toast.error(`Clustering failed: ${message}`);
        setLocalError(`Clustering failed: ${message}`);
        setWorkflowStep("error");
    }
  }, [
      researchId,
      currentKeywords,
      selectedModel,
      saveClusters,
      workflowStep
  ]);

  // --- Effect to progress workflow after details load ---
  useEffect(() => {
    if (!isMounted) return;

    // If we're still loading, don't do anything yet
    if (loadingDetail) {
      console.log(`[Workflow] Still loading details for ${researchId}...`);
      return;
    }

    // Check if we have the correct research detail
    if (selectedResearchDetail?.id === researchId) {
      console.log(`[Workflow] Details loaded for ${researchId}. Determining next step.`);
      
      if (workflowStep === "loadingDetails") {
        if (currentClusters && Object.keys(currentClusters).length > 0) {
          console.log("[Workflow] Clusters found. Moving to results state.");
          setWorkflowStep("results");
        } else if (currentKeywords.length >= 5) {
          console.log(`[Workflow] Keywords found (${currentKeywords.length}), but no clusters. Triggering clustering.`);
          triggerClustering();
        } else if (currentKeywords.length > 0) {
          console.warn(`[Workflow] Insufficient keywords (${currentKeywords.length}) for clustering.`);
          setLocalError("Selected research has keywords, but not enough (minimum 5) to perform clustering.");
          setWorkflowStep("error");
        } else {
          console.warn("[Workflow] Loaded research has no keywords.");
          setLocalError("Selected research contains no keywords.");
          setWorkflowStep("error");
        }
      }
    } else if (!selectedResearchDetail && !loadingDetail) {
      // Only set error if we're not still loading and we've tried to load the data
      if (workflowStep === "loadingDetails") {
        console.warn(`[Workflow] No data found for ${researchId}. Attempting to reload...`);
        // Try to reload the data
        setSelectedResearchId(researchId);
      } else {
        console.error(`[Workflow] Failed to load details for ${researchId} after retry.`);
        setLocalError(`Could not find research data for ID: ${researchId}. It might have been deleted.`);
        setWorkflowStep("error");
      }
    }
  }, [
    isMounted,
    researchId,
    selectedResearchDetail,
    loadingDetail,
    currentKeywords,
    currentClusters,
    triggerClustering,
    workflowStep,
    setSelectedResearchId
  ]);

  // --- Fetch details based on researchId from URL ---
  useEffect(() => {
    if (researchId && isMounted) {
      console.log(`[ResultPage] Setting selected ID and fetching details for: ${researchId}`);
      setWorkflowStep("loadingDetails");
      setLocalError(null);
      setSelectedResearchId(researchId);
    }
  }, [researchId, setSelectedResearchId, isMounted]);

  // --- Persona Generation Logic ---
  const handleGenerateAllPersonas = useCallback(async () => {
    if (!researchId || !currentClusters || Object.keys(currentClusters).length === 0) {
      toast.error("Cannot generate personas: No clusters available.");
      return;
    }

    console.log(`[Personas] Starting persona generation for all clusters (Research ID: ${researchId})`);
    setWorkflowStep("generatingPersonas");
    setLocalError(null);

    const clusterEntries = Object.entries(currentClusters);
    const generatedPersonas: Record<string, string> = { ...(currentPersonas || {}) };
    let errorsEncountered = 0;

    const personaPromises = clusterEntries.map(async ([clusterName, keywords]) => {
      if (!clusterName || !keywords || keywords.length === 0) {
        console.warn(`[Personas] Skipping invalid cluster entry: ${clusterName}`);
        return;
      }
      try {
        console.log(`[Personas] Generating for cluster: "${clusterName}"`);
        const personaResult = await generateUserPersonaFromClusters({
          clusterName,
          keywords,
          model: selectedModel,
        });
        generatedPersonas[clusterName] = personaResult.userPersona;
        console.log(`[Personas] Success for cluster: "${clusterName}"`);
      } catch (error) {
        errorsEncountered++;
        console.error(`[Personas] Failed for cluster "${clusterName}":`, error);
        toast.error(`Persona generation failed for cluster "${clusterName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    await Promise.allSettled(personaPromises);

    console.log("[Personas] All generations attempted. Saving results.");

    try {
      await savePersonas(researchId, { personas: generatedPersonas, updatedAt: new Date() });
      console.log("[Personas] Personas saved.");
      if (errorsEncountered === 0) {
        toast.success("All user personas generated successfully!");
      } else {
        toast.warning(`Generated personas for ${clusterEntries.length - errorsEncountered} out of ${clusterEntries.length} clusters.`);
      }
      setWorkflowStep("results");
    } catch (saveError) {
        console.error("[Personas] Failed to save personas:", saveError);
        toast.error(`Failed to save updated personas: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
        setLocalError(`Failed to save updated personas.`);
        setWorkflowStep("error");
    }

  }, [
    researchId,
    currentClusters,
    currentPersonas,
    selectedModel,
    savePersonas
  ]);

  // Helper to get loading text
  const getLoadingText = () => {
    switch (workflowStep) {
      case "loadingDetails": return "Loading research details...";
      case "clustering": return "Performing semantic clustering...";
      case "generatingPersonas": return "Generating user personas...";
      default: return "Loading..."; // Fallback
    }
  };

  if (!isMounted) {
    return null;
  }

  // --- RENDER STATES --- 

  // 1. Loading States (Details, Clustering, Personas)
  if (workflowStep === "loadingDetails" || workflowStep === "clustering" || workflowStep === "generatingPersonas") {
     return (
       <div className="space-y-4">
         <ToolHeader
            title="關鍵詞研究結果"
            description={selectedResearchDetail?.id === researchId && selectedResearchDetail.query 
              ? `正在分析關鍵詞 "${selectedResearchDetail.query}" 的相關數據...` 
              : "正在加載研究數據..."}
            region={settingsState.region}
            language={settingsState.language}
            icon={<FileText className="h-5 w-5 text-blue-500" />}
         />
         <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-lg text-muted-foreground">{getLoadingText()}</p>
         </div>
       </div>
     );
  }

  // 2. Error State
  if (workflowStep === "error") {
    return (
       <div className="space-y-4">
         <ToolHeader
            title="關鍵詞研究結果"
            description={selectedResearchDetail?.id === researchId && selectedResearchDetail.query 
              ? `關鍵詞 "${selectedResearchDetail.query}" 分析過程中發生錯誤` 
              : "加載數據時發生錯誤"}
            region={settingsState.region}
            language={settingsState.language}
            icon={<FileText className="h-5 w-5 text-blue-500" />}
         />
         <div className="flex items-center justify-center h-[50vh] text-center">
             <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-lg max-w-md">
                <h3 className="text-xl font-semibold text-destructive mb-2">發生錯誤</h3>
                <p className="text-destructive/90">{localError || "An unexpected error occurred. Please try again or select a different research item."}</p>
             </div>
         </div>
       </div>
    );
  }

  // 3. Results State (Data loaded, clusters available)
  if (workflowStep === "results" && selectedResearchDetail?.id === researchId && currentClusters) {
    const hasPersonas = !!(currentPersonas && Object.keys(currentPersonas).length > 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={selectedModel}
            onValueChange={(value) => setSelectedModel(value as "gpt-4o-mini" | "gpt-4o")}
            disabled={hasPersonas}
          >
            <SelectTrigger className="w-[150px] sm:w-[180px]">
              <SelectValue placeholder="選擇模型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">GPT-4o (最佳質量)</SelectItem>
              <SelectItem value="gpt-4o-mini">GPT-4o-mini (推薦)</SelectItem>
            </SelectContent>
          </Select>

          <LoadingButton
            onClick={handleGenerateAllPersonas}
            className="whitespace-nowrap"
          >
            {hasPersonas ? "更新所有用戶畫像" : "生成所有用戶畫像"}
          </LoadingButton>
           {hasPersonas && (
             <span className="text-sm text-muted-foreground italic">用戶畫像已生成</span>
           )}
        </div>

        <KeywordClustering
          keywordVolumeMap={keywordVolumeMap}
          clusters={currentClusters}
          personasMap={currentPersonas}
          researchLocation={selectedResearchDetail.location || 'tw'}
          researchLanguage={selectedResearchDetail.language || 'zh-TW'}
          currentKeywords={currentKeywords.map(k => k.text || '').filter(Boolean)}
          selectedResearchDetail={selectedResearchDetail}
        />
      </div>
    );
  }

  // Fallback render state (If data doesn't load or ID mismatch persists)
  console.warn("[Workflow] Reached fallback render state.", { workflowStep, researchId, loadingDetail, selectedResearchDetail });
   return (
     <div className="space-y-4">
       <ToolHeader
         title="關鍵詞研究工具"
         description="無法加載結果"
         region={settingsState.region}
         language={settingsState.language}
         icon={<FileText className="h-5 w-5 text-blue-500" />}
       />
       <div className="flex items-center justify-center h-[50vh]">
          <EmptyState
            title="無法加載數據"
            description="請檢查研究 ID 或嘗試返回歷史記錄頁面。"
          />
       </div>
     </div>
   );
} 