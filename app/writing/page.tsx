"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
// Shadcn UI Select components import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle, Copy, CheckCircle2, ChevronRight, Search, TerminalSquare, Settings2, Check, ChevronsUpDown, Layers, XCircle, Circle } from "lucide-react"
import { MEDIASITE_DATA } from "@/app/global-config"
import { THEME_FINE_TUNE_DATA, MEDIA_SITE_FINE_TUNE_DATA, LANGUAGE_FINE_TUNE_DATA } from "@/app/prompt/fine-tune"
import { toast } from "sonner"
import Image from 'next/image'
import { cn } from "@/lib/utils"
import { useClientStorage } from "@/components/hooks/use-client-storage"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { fetchKeywordResearchSummaryList, fetchKeywordResearchDetail } from "@/app/actions/keyword-research-action";
import type { KeywordResearchSummaryItem } from '@/app/services/firebase/db-keyword-research';
import type { ProcessedKeywordResearchData, TitleAnalysisJson, BetterHaveAnalysisJson } from '@/app/services/firebase/schema';
import type { ClientSafeSerpDataDoc } from '@/app/actions/serp-action';
import { ProgressChecklistDisplay } from "./components/progress-checklist-display";
import { ErrorDisplay } from "./components/error-display";
import { ResultDisplay } from "./components/result-display";

// --- Define New API Endpoints ---
const API_BASE_URL = "/api/writing";
const API_OUTLINE_URL = `${API_BASE_URL}/outline`; // Keep outline separate for now
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;

// --- Define New Step IDs ---
const STEP_ID_OUTLINE = 'outline';
const STEP_ID_FETCH_SERP = 'fetch-serp';
const STEP_ID_ANALYZE_CONTENT_TYPE = 'analyze-content-type';
const STEP_ID_ANALYZE_USER_INTENT = 'analyze-user-intent';
const STEP_ID_ANALYZE_TITLE = 'analyze-title';
const STEP_ID_ANALYZE_BETTER_HAVE = 'analyze-better-have';
const STEP_ID_GENERATE_ACTION_PLAN = 'generate-action-plan';
const STEP_ID_GENERATE_FINAL_PROMPT = 'generate-final-prompt';

// Combine all fine-tune data names
const allFineTuneNames = [
    ...THEME_FINE_TUNE_DATA.map(item => item.name),
    ...MEDIA_SITE_FINE_TUNE_DATA.map(item => item.name),
    ...LANGUAGE_FINE_TUNE_DATA.map(item => item.name)
];

// --- UPDATED: Step Checklist Component ---
interface Step {
    id: string;
    name: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
    durationMs?: number; // Add optional duration
}

// TODO: Share this Step interface definition

export default function WritingPage() {
  // Use useClientStorage for persistent state
  const [keyword, setKeyword] = useClientStorage("writing:keyword", "")
  const [mediaSiteName, setMediaSiteName] = useClientStorage("writing:mediaSiteName", "")
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>("writing:researchPrompt", null);
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>("writing:selectedFineTunes", [])
  const [selectedKeywordReport, setSelectedKeywordReport] = useClientStorage<ProcessedKeywordResearchData | null>("writing:selectedKeywordReport", null)

  // --- Cluster Selection State --- 
  const [selectedClusterName, setSelectedClusterName] = useState<string>("__ALL_CLUSTERS__");
  
  // --- UPDATED: State for the displayed Persona description --- 
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);

  // --- State for real data ---
  const [realKeywordList, setRealKeywordList] = useState<KeywordResearchSummaryItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(true); // Start loading initially
  const [listFetchError, setListFetchError] = useState<string | null>(null);
  
  // --- State for loading detail ---
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  
  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);
  
  // --- State to track if generation was attempted ---
  const [generationAttempted, setGenerationAttempted] = useClientStorage("writing:generationAttempted", false);
  
  // Keep local state for UI elements like loading, error, copied status, and visibility toggle
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false)
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false) // State for Combobox popover
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<string | null>("writing:generatedOutlineText", null);

  // --- UPDATED: New state for 7-step tracking --- (plus Outline)
  const initialSteps: Step[] = [
    { id: STEP_ID_FETCH_SERP, name: 'Step 1: Fetch SERP', status: 'pending' },
    { id: STEP_ID_ANALYZE_CONTENT_TYPE, name: 'Step 2: Analyze Content Type', status: 'pending' },
    { id: STEP_ID_ANALYZE_USER_INTENT, name: 'Step 3: Analyze User Intent', status: 'pending' },
    { id: STEP_ID_ANALYZE_TITLE, name: 'Step 4: Analyze Title', status: 'pending' },
    { id: STEP_ID_ANALYZE_BETTER_HAVE, name: 'Step 5: Analyze Better Have', status: 'pending' },
    { id: STEP_ID_GENERATE_ACTION_PLAN, name: 'Step 6: Generate Action Plan', status: 'pending' },
    { id: STEP_ID_GENERATE_FINAL_PROMPT, name: 'Step 7: Generate Final Prompt', status: 'pending' }
  ];
  // Use regular useState for steps to test incremental updates
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  // --- Effect for hydration fix ---
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // --- End Effect ---

  // --- Effect to fetch real keyword data --- 
  useEffect(() => {
    const loadKeywords = async () => {
      setIsListLoading(true);
      setListFetchError(null);
      try {
        const summaries = await fetchKeywordResearchSummaryList(50);
        if (!Array.isArray(summaries)) {
          console.error("Unexpected format from fetchKeywordResearchSummaryAction");
          throw new Error("Failed to fetch keywords: Invalid response format.");
        }
        setRealKeywordList(summaries);
      } catch (error: any) {
        console.error("Failed to fetch keyword research list:", error);
        setListFetchError(error.message || "Unknown error");
      } finally {
        setIsListLoading(false);
      }
    };
    loadKeywords();
  }, []); // Run only on mount
  // --- End Fetch Effect --- 

  // --- Effect to reset cluster selection when keyword report changes --- 
  useEffect(() => {
    setSelectedClusterName("__ALL_CLUSTERS__");
  }, [selectedKeywordReport]);
  // --- End Cluster Reset Effect --- 

  // --- UPDATED: Effect to find and set the displayed Persona description --- 
  useEffect(() => {
    if (selectedClusterName === "__ALL_CLUSTERS__" || !selectedKeywordReport?.clustersWithVolume) {
      setDisplayedPersona(null);
      return;
    }
    // Find the cluster with the matching name
    const foundCluster = selectedKeywordReport.clustersWithVolume.find(
      (c: any) => c.clusterName === selectedClusterName
    );
    // Set the persona description from the found cluster, or null if not found/no description
    setDisplayedPersona(foundCluster?.personaDescription || null); 
    
    if(selectedClusterName !== "__ALL_CLUSTERS__" && !foundCluster?.personaDescription) {
        console.warn(`[UI Persona Sync] Persona description not found for selected cluster: ${selectedClusterName}`);
    }

  }, [selectedClusterName, selectedKeywordReport]);
  // --- End Persona Sync Effect --- 

  // --- Moved useEffect for cluster/hasClusters logging BEFORE conditional return ---
  const hasClusters = selectedKeywordReport?.clustersWithVolume && Array.isArray(selectedKeywordReport.clustersWithVolume) && selectedKeywordReport.clustersWithVolume.length > 0;
  useEffect(() => {
    console.log("[UI Debug] selectedKeywordReport updated:", selectedKeywordReport);
    console.log("[UI Debug] hasClusters calculated:", hasClusters);
  }, [selectedKeywordReport, hasClusters]);
  // --- End moved useEffect ---

  // --- Effect to reset steps if keyword changes (or on initial load without a keyword in storage)
  useEffect(() => {
    // Only reset if the keyword has actually changed and a generation hasn't been attempted yet
    // Or if the component mounts and steps are not the initial ones (meaning they were loaded from a previous keyword)
    const key = `writing:stepsState:${keyword || 'default'}`;
    const storedSteps = localStorage.getItem(key);
    if (!generationAttempted || !storedSteps) {
        setSteps(initialSteps);
    }
    // This effect depends on the keyword to trigger reset when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  // --- !! HYDRATION FIX: Ensure component only renders on client after mount !! ---
  if (!isMounted) {
    return null; // Render nothing until mounted
  }
  // --- End Hydration Fix ---

  const handleCopyToClipboard = async () => {
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt);
        setCopied(true);
        toast.success("Prompt copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy prompt.");
        setCopied(false);
      }
    }
  };

  const handleFineTuneChange = (checked: boolean | string, name: string) => {
    setSelectedFineTunes(prev => {
      if (checked === true) {
        return [...prev, name];
      } else {
        return prev.filter(item => item !== name);
      }
    });
  };

  // Helper to update step status
  const updateStepStatus = (
      stepId: string,
      status: Step['status'],
      durationMs?: number
  ) => {
      setSteps(prevSteps =>
          prevSteps.map(step =>
              step.id === stepId ? { ...step, status, durationMs } : step
          )
      );
  };

  // --- API Call Helper Function Structure ---
  const callApi = async <T,>(stepId: string, url: string, payload: any): Promise<T> => {
      updateStepStatus(stepId, 'loading');
      const startTime = performance.now();
      let durationMs = 0;
      try {
          const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
          });

          durationMs = performance.now() - startTime;

          if (!response.ok) {
              let errorDetails = `API Error (${stepId}): ${response.statusText}`;
              let errorBody = null;
              try { errorBody = await response.json(); } catch { }
              if (errorBody && (errorBody.details || errorBody.error)) {
                  errorDetails = typeof errorBody.details === 'string' ? errorBody.details : (typeof errorBody.error === 'string' ? errorBody.error : JSON.stringify(errorBody));
              } else {
                  try {
                      const textError = await response.text();
                      if (textError) errorDetails += ` - ${textError}`;
                  } catch { }
              }
              console.error(`[API Call Error - ${stepId}] Status: ${response.status}, Details: ${errorDetails}`);
              throw new Error(errorDetails);
          }

          const result = await response.json();
          updateStepStatus(stepId, 'completed', durationMs);
          console.log(`[API Call Success - ${stepId}] (${(durationMs / 1000).toFixed(1)}s).`);
          return result as T;
      } catch (error) {
          updateStepStatus(stepId, 'error');
          console.error(`[API Call Error - ${stepId}] Catch block:`, error);
          // Re-throw the error to be caught by handleSubmit
          throw error;
      }
  };

  // Helper for Outline API call (remains similar, uses generic helper)
  const callOutlineApi = async (
      keyword: string,
      language: string,
      region: string
  ): Promise<{ outlineText: string }> => { // Adjust return type if API returns object
      const result = await callApi<{ outlineText: string }>(
          STEP_ID_OUTLINE,
          API_OUTLINE_URL,
          { keyword, language, region }
      );
      setGeneratedOutlineText(result.outlineText);
      return result;
  };

  // --- NEW API Call Helpers for Steps 1-7 ---

  // 1. Fetch SERP
  const callFetchSerpApi = async (
      keyword: string,
      mediaSiteName: string
  ): Promise<ClientSafeSerpDataDoc> => {
      return await callApi<ClientSafeSerpDataDoc>(
          STEP_ID_FETCH_SERP,
          API_STEP1_FETCH_SERP_URL,
          { keyword, mediaSiteName }
      );
  };

  // 2. Analyze Content Type
  const callAnalyzeContentTypeApi = async (
      serpDocId: string,
      keyword: string,
      organicResults: any[] | null
  ): Promise<{ recommendationText: string }> => {
      return await callApi<{ recommendationText: string }>(
          STEP_ID_ANALYZE_CONTENT_TYPE,
          API_STEP2_ANALYZE_CONTENT_TYPE_URL,
          { serpDocId, keyword, organicResults }
      );
  };

  // 3. Analyze User Intent
  const callAnalyzeUserIntentApi = async (
      serpDocId: string,
      keyword: string,
      organicResults: any[] | null,
      relatedQueries: any[] | null
  ): Promise<{ recommendationText: string }> => {
      return await callApi<{ recommendationText: string }>(
          STEP_ID_ANALYZE_USER_INTENT,
          API_STEP3_ANALYZE_USER_INTENT_URL,
          { serpDocId, keyword, organicResults, relatedQueries }
      );
  };

  // 4. Analyze Title
  type AnalyzeTitleResult = { analysisJson: TitleAnalysisJson, recommendationText: string };
  const callAnalyzeTitleApi = async (
      serpDocId: string,
      keyword: string,
      organicResults: any[] | null
  ): Promise<AnalyzeTitleResult> => {
      return await callApi<AnalyzeTitleResult>(
          STEP_ID_ANALYZE_TITLE,
          API_STEP4_ANALYZE_TITLE_URL,
          { serpDocId, keyword, organicResults }
      );
  };

  // 5. Analyze Better Have
  type AnalyzeBetterHaveResult = { analysisJson: BetterHaveAnalysisJson, recommendationText: string };
  const callAnalyzeBetterHaveApi = async (
      serpDocId: string,
      keyword: string,
      organicResults: any[] | null,
      peopleAlsoAsk: any[] | null,
      relatedQueries: any[] | null,
      aiOverview: string | null | undefined
  ): Promise<AnalyzeBetterHaveResult> => {
      return await callApi<AnalyzeBetterHaveResult>(
          STEP_ID_ANALYZE_BETTER_HAVE,
          API_STEP5_ANALYZE_BETTER_HAVE_URL,
          { serpDocId, keyword, organicResults, peopleAlsoAsk, relatedQueries, aiOverview }
      );
  };

  // 6. Generate Action Plan
  const callGenerateActionPlanApi = async (
      keyword: string,
      mediaSiteName: string,
      contentTypeReportText: string,
      userIntentReportText: string,
      titleRecommendationText: string,
      betterHaveRecommendationText: string,
      keywordReport: ProcessedKeywordResearchData | any | null,
      selectedClusterName: string | null
  ): Promise<{ actionPlanText: string }> => {
      return await callApi<{ actionPlanText: string }>(
          STEP_ID_GENERATE_ACTION_PLAN,
          API_STEP6_GENERATE_ACTION_PLAN_URL,
          { keyword, mediaSiteName, contentTypeReportText, userIntentReportText, titleRecommendationText, betterHaveRecommendationText, keywordReport, selectedClusterName }
      );
  };

  // 7. Generate Final Prompt
  const callGenerateFinalPromptApi = async (
      keyword: string,
      actionPlan: string,
      mediaSiteName: string,
      contentTypeReportText: string,
      userIntentReportText: string,
      betterHaveRecommendationText: string | null,
      keywordReport: ProcessedKeywordResearchData | any | null,
      selectedClusterName: string | null,
      articleTemplate: string,
      contentMarketingSuggestion: string | null, // Assuming it might be null
      fineTuneNames: string[],
      betterHaveAnalysisJson: BetterHaveAnalysisJson | null
  ): Promise<{ finalPrompt: string }> => {
      return await callApi<{ finalPrompt: string }>(
          STEP_ID_GENERATE_FINAL_PROMPT,
          API_STEP7_GENERATE_FINAL_PROMPT_URL,
          {
              keyword,
              actionPlan,
              mediaSiteName,
              contentTypeReportText,
              userIntentReportText,
              betterHaveRecommendationText,
              keywordReport,
              selectedClusterName,
              articleTemplate,
              contentMarketingSuggestion: contentMarketingSuggestion || '', // Ensure default empty string if null
              fineTuneNames,
              betterHaveAnalysisJson
          }
      );
  };

  // --- Refactored handleSubmit --- 
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsLoading(true);
      setGenerationAttempted(true); // Mark that a generation has been attempted
      setError(null);
      setResearchPrompt(null);
      setGeneratedOutlineText(null);
      setSteps(initialSteps); // Reset steps state

      if (!keyword || !mediaSiteName) {
          setError("Please provide both a keyword and select a media site.");
          setIsLoading(false);
          return;
      }

      const firstKeyword = keyword.split(",")[0].trim();
      if (!firstKeyword) {
          setError("Please provide a valid keyword.");
          setIsLoading(false);
          return;
      }
      
      const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
      if (!mediaSite) {
          setError(`Media site configuration not found for name: ${mediaSiteName}`);
          setIsLoading(false);
          return;
      }
      const { region, language } = mediaSite;

      // Get outline template (ensure it defaults if null)
      const outlineTemplate = generatedOutlineText || "<!-- Default Outline/Template -->";

      console.log(`Submitting: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName}, FineTunes=${selectedFineTunes.join(', ')}, TargetCluster=${selectedClusterName === "__ALL_CLUSTERS__" ? 'All' : selectedClusterName}`);

      try {
          // --- Execute Steps Sequentially --- 

          let reportForStep6: any | null = selectedKeywordReport;
          let reportForStep7: any | null = selectedKeywordReport;

          // --- Filter Report Data if Cluster is Selected ---
          const currentSelectedCluster = selectedClusterName; // Read latest state here
          if (currentSelectedCluster !== "__ALL_CLUSTERS__" && selectedKeywordReport) {
              const clusterData = selectedKeywordReport.clustersWithVolume?.find(
                  (c: any) => c.clusterName === currentSelectedCluster
              );
              if (clusterData) {
                  // Create a minimal report for Step 6 containing only the selected cluster
                  reportForStep6 = {
                      query: selectedKeywordReport.query,
                      language: selectedKeywordReport.language,
                      region: selectedKeywordReport.region,
                      clustersWithVolume: [clusterData], // Array with only the selected cluster
                      // Include other top-level fields if needed by formatKeywordReportForPrompt
                  };
                  // Set report for Step 7 to null as info is now in action plan
                  reportForStep7 = null;
              } else {
                  console.warn(`[handleSubmit] Selected cluster '${currentSelectedCluster}' not found in report. Using full report.`);
                  // Fallback to full report if cluster not found somehow
                  reportForStep6 = selectedKeywordReport;
                  reportForStep7 = selectedKeywordReport;
              }
          } else {
              // If no cluster selected, use full report for both steps
              reportForStep6 = selectedKeywordReport;
              reportForStep7 = selectedKeywordReport;
          }

          // Step 1: Fetch SERP Data
          const serpData = await callFetchSerpApi(firstKeyword, mediaSiteName);

          // Step 2: Analyze Content Type
          const contentTypeResult = await callAnalyzeContentTypeApi(
              serpData.id,
              serpData.query,
              serpData.organicResults ?? null // Provide null if undefined
          );

          // Step 3: Analyze User Intent
          const userIntentResult = await callAnalyzeUserIntentApi(
              serpData.id,
              serpData.query,
              serpData.organicResults ?? null, // Provide null if undefined
              serpData.relatedQueries ?? null // Provide null if undefined
          );

          // Step 4: Analyze Title
          const titleResult = await callAnalyzeTitleApi(
              serpData.id,
              serpData.query,
              serpData.organicResults ?? null // Provide null if undefined
          );

          // Step 5: Analyze Better Have
          const betterHaveResult = await callAnalyzeBetterHaveApi(
              serpData.id,
              serpData.query,
              serpData.organicResults ?? null, // Provide null if undefined
              serpData.peopleAlsoAsk ?? null, // Provide null if undefined
              serpData.relatedQueries ?? null, // Provide null if undefined
              serpData.aiOverview ?? null // Provide null if undefined
          );

          // Step 6: Generate Action Plan
          const actionPlanResult = await callGenerateActionPlanApi(
              serpData.query, // Use query from SERP data
              mediaSiteName,
              contentTypeResult.recommendationText,
              userIntentResult.recommendationText,
              titleResult.recommendationText,
              betterHaveResult.recommendationText,
              reportForStep6,
              currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster // Pass potentially null cluster name
          );

          // Step 7: Generate Final Prompt
          const finalPromptResult = await callGenerateFinalPromptApi(
              serpData.query,
              actionPlanResult.actionPlanText,
              mediaSiteName,
              contentTypeResult.recommendationText,
              userIntentResult.recommendationText,
              betterHaveResult.recommendationText ?? null, // Provide null if undefined
              reportForStep7,
              currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster, // Pass potentially null cluster name
              generatedOutlineText || "<!-- Default Outline -->", // Use state or default
              null, // contentMarketingSuggestion - add if needed
              selectedFineTunes,
              betterHaveResult.analysisJson ?? null // Provide null if undefined
          );

          // --- Process Complete --- 
          setResearchPrompt(finalPromptResult.finalPrompt);
          console.log("[UI] Process Complete. Final Research Prompt Generated.");

      } catch (err) {
          console.error("[UI Debug] Error caught in handleSubmit:", err);
          if (!error) { // Avoid overwriting specific API errors
              setError(err instanceof Error ? err.message : "An unexpected error occurred during generation.");
          }
      } finally {
          console.log("[UI Debug] handleSubmit finally block reached. Setting isLoading=false.");
          setIsLoading(false);
      }
  };

  // Add handler for starting over to pass to ResultDisplay
  const handleStartOver = () => {
    setResearchPrompt(null)
    setMediaSiteName("")
    setSelectedFineTunes([])
    setSelectedKeywordReport(null)
    setSteps(initialSteps)
    setGenerationAttempted(false)
    // Optionally reset keyword and outline
    // setKeyword("");
    // setGeneratedOutlineText(null);
  };

  // Add logging for final state before render
  console.log(`[UI Render State] isLoading=${isLoading}, hasResearchPrompt=${!!researchPrompt}, currentStep=${steps.find(step => step.status === 'loading')?.name}`);

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        <div className="space-y-8">

          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 {/* Window controls */}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">INPUT_PARAMETERS</span>
              </div>
              {/* Right side controls */}
              <div className="flex items-center gap-4"> {/* Increased gap */} 
                {/* Fine-tune Toggle Button */} 
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFineTuneOptions(!showFineTuneOptions)}
                  className="text-xs font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-2 py-1 h-auto"
                  disabled={isLoading || isDetailLoading}
                >
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  Fine-Tune ({isMounted ? selectedFineTunes.length : 0})
                </Button>
              </div>
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keyword Input Section */}
                <div className="space-y-2">
                  <Label htmlFor="keyword-combobox" className="text-base font-medium">
                    Keyword
                  </Label>
                  <div className="relative">
                     {/* --- Combobox for Keyword Input --- */}
                     <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="keyword-combobox" // Add id for label association
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          disabled={isLoading || isListLoading} // Disable if form is loading OR list is loading
                          className="w-full h-12 justify-between pl-10 pr-52 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800"
                        >
                          <span className="truncate">
                            {!isMounted || !keyword ? "Select or type keyword..." : keyword}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        align="start" 
                        className="p-0" 
                        style={{ width: 'var(--radix-popover-trigger-width)' }}
                      >
                        <Command shouldFilter={false} className="p-0">
                          <CommandInput
                            placeholder="Search keyword or type..."
                            value={keyword}
                            onValueChange={(search: string) => {
                              setKeyword(search);
                              setSelectedKeywordReport(null); // Clear report and cluster
                            }}
                            className="h-11" />
                          <CommandList>
                            {/* Loading State */}
                            {isListLoading && (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                                Loading keywords...
                              </div>
                            )}
                            {/* Error State */}
                            {!isListLoading && listFetchError && (
                              <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
                                Error: {listFetchError}
                              </div>
                            )}
                            {/* Empty State */}
                            {!isListLoading && !listFetchError && realKeywordList.length === 0 && (
                              <CommandEmpty>No keyword research found.</CommandEmpty>
                            )}
                            {/* Real Data */}
                            {!isListLoading && !listFetchError && realKeywordList.length > 0 && (
                              <CommandGroup>
                                {realKeywordList.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.query} // Use query for value
                                    onSelect={async (currentValue: string) => {
                                      const selectedItem = realKeywordList.find(i => i.query.toLowerCase() === currentValue.toLowerCase());
                                      if (!selectedItem) return;

                                      const selectedQuery = selectedItem.query;
                                      setKeyword(selectedQuery);
                                      setComboboxOpen(false);
                                      setSelectedKeywordReport(null); // Clear previous report immediately
                                      setIsDetailLoading(true);

                                      // --- Fetch and set the detailed keyword report --- 
                                      try {
                                        console.log(`[UI] Fetching details for Keyword ID: ${selectedItem.id}`);
                                        // Call the server action to get details
                                        const detailResult = await fetchKeywordResearchDetail(selectedItem.id); 
                                        
                                        if (!detailResult) {
                                            console.warn(`[UI] No details returned for ID: ${selectedItem.id}`);
                                            setSelectedKeywordReport(null); // Ensure it's null if fetch fails/returns null
                                            toast.error("Could not fetch keyword details.");
                                        } else {
                                            setSelectedKeywordReport(detailResult as ProcessedKeywordResearchData); 
                                            console.log(`[UI] Details fetched successfully for ID: ${selectedItem.id}`);
                                        }
                                      } catch (error) {
                                        console.error(`[UI] Error fetching keyword details for ID ${selectedItem.id}:`, error);
                                        setSelectedKeywordReport(null); // Clear report on error
                                        toast.error(error instanceof Error ? `Error fetching details: ${error.message}` : "An unknown error occurred while fetching details.");
                                      } finally {
                                        setIsDetailLoading(false); // Stop loading indicator
                                        console.log("[UI] Detail fetching attempt complete.");
                                      }
                                      // ----- End Fetch ---
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        keyword.toLowerCase() === item.query.toLowerCase() ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {item.query}
                                    {typeof item.totalVolume === 'number' && (
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        Vol: {item.totalVolume.toLocaleString()}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {/* --- End Combobox --- */}

                    {/* Action Buttons in Top Right */} 
                    <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
                      {/* Generate Button */}
                      <Button
                        type="submit"
                        disabled={isLoading || isDetailLoading}
                        className={cn(
                          "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                          "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700",
                          (isLoading || isDetailLoading) && "opacity-50 cursor-not-allowed" 
                        )}
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TerminalSquare className="h-3.5 w-3.5" />}
                        Generate
                      </Button>
                      {/* Media Site Button */} 
                      {!showMediaSiteOptions && (
                        isMounted && mediaSiteName ? (
                          (() => {
                            const site = MEDIASITE_DATA.find(s => s.name === mediaSiteName);
                            let hostname = "";
                            try { hostname = new URL(site?.url || ".").hostname; } catch (e) { /* ignore */ }
                            const faviconUrl = hostname && hostname !== "." ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}` : null;
                            return (
                                <Button
                                    type="button"
                                    onClick={() => setShowMediaSiteOptions(true)}
                                    disabled={isLoading || isDetailLoading}
                                    title={`Selected: ${mediaSiteName}`}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 text-xs font-mono transition-colors border h-full",
                                        "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700"
                                    )}
                                >
                                    {faviconUrl && <Image src={faviconUrl} alt="" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />}
                                    <span className="truncate max-w-[80px]">{mediaSiteName}</span>
                                </Button>
                            );
                          })()
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setShowMediaSiteOptions(true)}
                            disabled={isLoading || isDetailLoading} 
                            className={cn(
                              "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                              "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-gray-400 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            )}
                          >
                            [Select Site...]
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* --- Cluster Selection Dropdown (Render if clusters exist) --- */}
                {isMounted && hasClusters && (
                  <div className="space-y-2">
                    <Label htmlFor="cluster-select" className="text-base font-medium">
                      Target Cluster / Persona
                    </Label>
                    <Select
                      value={selectedClusterName}
                      onValueChange={setSelectedClusterName} // This will trigger the useEffect to find the persona
                      disabled={isLoading || isDetailLoading}
                    >
                      <SelectTrigger
                        id="cluster-select"
                        className="w-full h-12 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <SelectValue placeholder="Select a cluster..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ALL_CLUSTERS__">All Clusters (No Specific Persona)</SelectItem>
                        {/* Map over clustersWithVolume */}
                        {selectedKeywordReport?.clustersWithVolume?.map((cluster: any, index: number) => ( 
                          <SelectItem key={cluster.clusterName || `cluster-${index}`} value={cluster.clusterName || `Cluster ${index + 1}`}>
                            {cluster.clusterName || `Cluster ${index + 1}`} (Vol: {cluster.totalVolume?.toLocaleString() ?? 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* --- Display Area for Associated Persona --- */}
                    {selectedClusterName !== "__ALL_CLUSTERS__" && (
                       <div className="mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-900/10 text-sm text-indigo-800 dark:text-indigo-200">
                         {displayedPersona ? (
                           <>
                             <p className="font-medium mb-1">Targeting Persona: {selectedClusterName}</p>
                             <p className="text-xs opacity-80 line-clamp-3">{displayedPersona}</p>
                           </>
                         ) : (
                           <p className="text-xs opacity-70 italic">
                             (Persona description not found or not yet generated for this cluster)
                           </p>
                         )}
                       </div>
                    )}
                  </div>
                )}
                {/* --- End Cluster/Persona Section --- */}

                {/* Media Site Selection Area */}
                <div className="space-y-2 pt-1">
                  {showMediaSiteOptions && (
                    <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-2 bg-white dark:bg-neutral-900">
                       <p className="text-xs font-mono text-gray-500 dark:text-gray-400">SELECT_MEDIA_SITE:</p>
                       <div className="flex flex-wrap gap-2">
                          {MEDIASITE_DATA.map((site) => {
                             let hostname = "";
                             try { hostname = new URL(site.url).hostname; } catch (e) { /* Ignore invalid URLs */ }
                             const faviconUrl = hostname ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}` : null;
                             return (
                                <Button
                                   key={site.name}
                                   type="button"
                                   onClick={() => {
                                      setMediaSiteName(site.name);
                                      setShowMediaSiteOptions(false);
                                   }}
                                   disabled={isLoading || isDetailLoading} // Also disable if detail is loading
                                   className={cn(
                                      "flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors border",
                                      "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                   )}
                                >
                                   {faviconUrl && <Image src={faviconUrl} alt="" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />}
                                   {site.name}
                                </Button>
                             );
                          })}
                       </div>
                    </div>
                  )}
                </div>

                 {/* Fine-Tune Selection Area */}
                 {showFineTuneOptions && (
                  <div className="space-y-2 pt-1">
                    <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-3 bg-white dark:bg-neutral-900">
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">SELECT_FINE_TUNE_SETS (Experimental):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {allFineTuneNames.map((name) => (
                          <div key={name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`fine-tune-${name}`}
                              checked={selectedFineTunes.includes(name)}
                              onCheckedChange={(checked) => handleFineTuneChange(checked, name)}
                              disabled={isLoading || isDetailLoading} // Also disable if detail is loading
                            />
                            <Label
                              htmlFor={`fine-tune-${name}`}
                              className="text-sm font-mono text-gray-700 dark:text-gray-300 cursor-pointer"
                            >
                              {name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Selected sets will be appended to the final prompt for the AI.
                      </p>
                    </div>
                  </div>
                )}


                {/* Progress Checklist - Show if generation was attempted */}
                {generationAttempted && (
                  <ProgressChecklistDisplay steps={steps} />
                )}

                {/* Error Display - Show if error exists and not loading */}
                {!isLoading && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

                {/* Result Display - Show if not loading and prompt exists */}
                {!isLoading && researchPrompt && (
                  <ResultDisplay
                    researchPrompt={researchPrompt}
                    generatedOutlineText={generatedOutlineText}
                    onCopyToClipboard={handleCopyToClipboard}
                    onStartOver={handleStartOver} // Pass the new handler
                    copied={copied}
                  />
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
