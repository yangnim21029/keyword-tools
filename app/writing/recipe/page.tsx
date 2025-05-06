"use client";

import { MEDIASITE_DATA } from "@/app/global-config";
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
import { useClientStorage } from "@/components/hooks/use-client-storage";
import { Button } from "@/components/ui/button";
// Removed Checkbox import as it's no longer used for fine-tunes
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronsUpDown,
  Layers,
  Loader2,
  // Removed Settings2 as fine-tune button is removed
  TerminalSquare,
} from "lucide-react";
// Removed Image import as media site selector is removed
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
// Adjusted import paths relative to the new file location if needed (assuming they are correct)
import { ErrorDisplay } from "../components/error-display";
import { ProgressChecklistDisplay } from "../components/progress-checklist-display";
import { ResultDisplay } from "../components/result-display";
import { RevalidateButton } from "@/app/actions/actions-buttons";

// --- Import Corrected Types from Schema ---
import type {
  KeywordVolumeListItem,
  KeywordVolumeObject,
} from "@/app/services/firebase/schema";
// --- Import Server Actions ---
import { submitGetKeywordVolumeObj } from "@/app/actions/actions-keyword-volume";
import { getSerpDataAction } from "@/app/actions/actions-ai-serp-result"; // SERP actions
// --- End Import ---

// --- Define New API Endpoints ---
// Keep API endpoints the same
const API_BASE_URL = "/api/writing";
const API_OUTLINE_URL = `${API_BASE_URL}/outline`;
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;
const API_KEYWORD_LIST_URL = `${API_BASE_URL}/keyword-list`;

// --- Define New Step IDs ---
// Keep Step IDs the same
const STEP_ID_FETCH_SERP = "fetch-serp";
const STEP_ID_ANALYZE_CONTENT_TYPE = "analyze-content-type";
const STEP_ID_ANALYZE_USER_INTENT = "analyze-user-intent";
const STEP_ID_ANALYZE_TITLE = "analyze-title";
const STEP_ID_ANALYZE_BETTER_HAVE = "analyze-better-have";
const STEP_ID_GENERATE_ACTION_PLAN = "generate-action-plan";
const STEP_ID_GENERATE_FINAL_PROMPT = "generate-final-prompt";

// Combine all fine-tune data names
const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map((item) => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map((item) => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map((item) => item.name),
];

// --- UPDATED: Step Checklist Component ---
interface Step {
  id: string;
  name: string;
  status: "pending" | "loading" | "completed" | "error";
  durationMs?: number; // Add optional duration
}

// --- RENAMED Component ---
export default function WritingRecipePage() {
  // Use useClientStorage for keyword and report state
  const [keyword, setKeyword] = useClientStorage("writingRecipe:keyword", ""); // Use different key for recipe page
  const [selectedKeywordReport, setSelectedKeywordReport] =
    useClientStorage<KeywordVolumeObject | null>(
      "writingRecipe:selectedKeywordReport", // Use different key
      null,
    );
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    "writingRecipe:researchPrompt", // Use different key
    null,
  );
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    "writingRecipe:generationAttempted", // Use different key
    false,
  );
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >("writingRecipe:generatedOutlineText", null); // Use different key

  // --- FIXED State for Media Site and Fine-tunes ---
  const [mediaSiteName, setMediaSiteName] = useState<string>("urbanlife"); // Fixed value
  const [selectedFineTunes, setSelectedFineTunes] =
    useState<string[]>(allFineTuneNames); // Pre-selected all

  // --- Cluster Selection State ---
  const [selectedClusterName, setSelectedClusterName] =
    useState<string>("__ALL_CLUSTERS__");
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);

  // --- State for keyword list ---
  const [realKeywordList, setRealKeywordList] = useState<
    KeywordVolumeListItem[]
  >([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listFetchError, setListFetchError] = useState<string | null>(null);

  // --- State for loading/UI ---
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);

  // --- State for steps ---
  const initialSteps: Step[] = [
    { id: STEP_ID_FETCH_SERP, name: "Step 1: Fetch SERP", status: "pending" },
    {
      id: STEP_ID_ANALYZE_CONTENT_TYPE,
      name: "Step 2: Analyze Content Type",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_USER_INTENT,
      name: "Step 3: Analyze User Intent",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_TITLE,
      name: "Step 4: Analyze Title",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_BETTER_HAVE,
      name: "Step 5: Analyze Better Have",
      status: "pending",
    },
    {
      id: STEP_ID_GENERATE_ACTION_PLAN,
      name: "Step 6: Generate Action Plan",
      status: "pending",
    },
    {
      id: STEP_ID_GENERATE_FINAL_PROMPT,
      name: "Step 7: Generate Final Prompt",
      status: "pending",
    },
  ];
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    // No need to set mediaSiteName or selectedFineTunes here, initialized above
  }, []);

  useEffect(() => {
    const loadKeywordsFromApi = async () => {
      // ... (keyword loading logic remains the same) ...
      setIsListLoading(true);
      setListFetchError(null);
      try {
        const response = await fetch(API_KEYWORD_LIST_URL, { method: "GET" });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch keywords: ${response.statusText || response.status} - ${errorText}`);
        }
        const summaries = await response.json();
        if (!Array.isArray(summaries)) {
          throw new Error("Failed to fetch keywords: Invalid response format.");
        }
        setRealKeywordList(summaries);
      } catch (error: any) {
        console.error("[API Fetch] Error fetching keyword list:", error);
        setListFetchError(error.message || "Unknown error");
      } finally {
        setIsListLoading(false);
      }
    };
    loadKeywordsFromApi();
  }, []);

  useEffect(() => {
    setSelectedClusterName("__ALL_CLUSTERS__");
  }, [selectedKeywordReport]);

  useEffect(() => {
    // ... (persona sync logic remains the same) ...
    if (selectedClusterName === "__ALL_CLUSTERS__" || !selectedKeywordReport?.clustersWithVolume) {
      setDisplayedPersona(null);
      return;
    }
    const foundCluster = selectedKeywordReport.clustersWithVolume.find(
      (c: any) => c.clusterName === selectedClusterName,
    );
    setDisplayedPersona(foundCluster?.personaDescription || null);
    if (selectedClusterName !== "__ALL_CLUSTERS__" && !foundCluster?.personaDescription) {
      console.warn(`[UI Persona Sync] Persona description not found for cluster: ${selectedClusterName}`);
    }
  }, [selectedClusterName, selectedKeywordReport]);

  // Fix: Add optional chaining for hasClusters calculation
  const hasClusters = (selectedKeywordReport?.clustersWithVolume ?? []).length > 0;

  // useEffect(() => {
  //   const key = `writingRecipe:stepsState:${keyword || "default"}`; // Use different key
  //   const storedSteps = localStorage.getItem(key);
  //   if (!generationAttempted || !storedSteps) {
  //     setSteps(initialSteps);
  //   } else {
  //     try {
  //         // Ensure stored steps match the current structure before setting
  //         const parsedSteps = JSON.parse(storedSteps);
  //         if (Array.isArray(parsedSteps) && parsedSteps.length === initialSteps.length && parsedSteps.every((step: any) => step.id && step.name && step.status)) {
  //             setSteps(parsedSteps);
  //         } else {
  //              localStorage.removeItem(key); // Remove invalid stored data
  //              setSteps(initialSteps);
  //         }
  //       } catch (e) {
  //         console.error("Failed to parse stored steps, resetting:", e);
  //         localStorage.removeItem(key); // Remove invalid stored data
  //         setSteps(initialSteps);
  //       }
  //   }
  // }, [keyword, generationAttempted]); // Depend on generationAttempted as well

  // useEffect(() => {
  //   // Save steps to localStorage whenever they change
  //   if (generationAttempted) {
  //     const key = `writingRecipe:stepsState:${keyword || "default"}`;
  //     localStorage.setItem(key, JSON.stringify(steps));
  //   }
  // }, [steps, keyword, generationAttempted]); // Added keyword dependency

  if (!isMounted) {
    return null;
  }

  // --- Handlers ---
  const handleCopyToClipboard = async () => {
    // ... (copy logic remains the same) ...
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

  // Removed handleFineTuneChange

  const updateStepStatus = (
    stepId: string,
    status: Step["status"],
    durationMs?: number,
  ) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId ? { ...step, status, durationMs } : step,
      ),
    );
  };

  // --- API Call Helpers (remain the same) ---
  const callApi = async <T,>(
    stepId: string,
    url: string,
    payload: any,
  ): Promise<T> => {
    updateStepStatus(stepId, "loading");
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
        try {
          const errorBody = await response.json();
          errorDetails = errorBody.details || errorBody.error || JSON.stringify(errorBody);
        } catch {
             try {
                const textError = await response.text();
                if (textError) errorDetails += ` - ${textError}`;
              } catch {}
        }
        throw new Error(errorDetails);
      }
      const result = await response.json();
      updateStepStatus(stepId, "completed", durationMs);
      return result as T;
    } catch (error) {
      updateStepStatus(stepId, "error");
      throw error; // Re-throw
    }
  };

  // Specific API call functions (callFetchSerpApi, etc.) remain the same

    // 1. Fetch SERP
  const callFetchSerpApi = async (
    keyword: string,
    mediaSiteName: string,
  ): Promise<{ id: string; originalKeyword: string }> => {
    return await callApi<{ id: string; originalKeyword: string }>(
      STEP_ID_FETCH_SERP,
      API_STEP1_FETCH_SERP_URL,
      { keyword, mediaSiteName },
    );
  };

  // 2. Analyze Content Type
  const callAnalyzeContentTypeApi = async (
    serpDocId: string,
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_CONTENT_TYPE,
      API_STEP2_ANALYZE_CONTENT_TYPE_URL,
      { serpDocId },
    );
  };

  // 3. Analyze User Intent
  const callAnalyzeUserIntentApi = async (
    serpDocId: string,
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_USER_INTENT,
      API_STEP3_ANALYZE_USER_INTENT_URL,
      { serpDocId },
    );
  };

  // 4. Analyze Title
  const callAnalyzeTitleApi = async (
    serpDocId: string,
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_TITLE,
      API_STEP4_ANALYZE_TITLE_URL,
      { serpDocId },
    );
  };

  // 5. Analyze Better Have
  const callAnalyzeBetterHaveApi = async (
    serpDocId: string,
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_BETTER_HAVE,
      API_STEP5_ANALYZE_BETTER_HAVE_URL,
      { serpDocId },
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
    keywordReport: KeywordVolumeObject | any | null,
    selectedClusterName: string | null,
  ): Promise<{ actionPlanText: string }> => {
    return await callApi<{ actionPlanText: string }>(
      STEP_ID_GENERATE_ACTION_PLAN,
      API_STEP6_GENERATE_ACTION_PLAN_URL,
      {
        keyword,
        mediaSiteName,
        contentTypeReportText,
        userIntentReportText,
        titleRecommendationText,
        betterHaveRecommendationText,
        keywordReport,
        selectedClusterName,
      },
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
    keywordReport: KeywordVolumeObject | any | null,
    selectedClusterName: string | null,
    articleTemplate: string,
    contentMarketingSuggestion: string | null,
    fineTuneNames: string[],
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
        contentMarketingSuggestion: contentMarketingSuggestion || "",
        fineTuneNames, // Pass the fixed fine-tunes
      },
    );
  };


  // --- handleSubmit (Updated for fixed values) ---
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setGenerationAttempted(true);
    setError(null);
    setResearchPrompt(null);
    // setGeneratedOutlineText(null); // Keep outline? Or reset? Let's reset for now.
    setGeneratedOutlineText(null);
    setSteps(initialSteps);

    // Use the fixed mediaSiteName directly
    if (!keyword || !mediaSiteName) {
      setError("Please provide a keyword."); // Simplified error
      setIsLoading(false);
      return;
    }

    const firstKeyword = keyword.split(",")[0].trim();
    if (!firstKeyword) {
      setError("Please provide a valid keyword.");
      setIsLoading(false);
      return;
    }

    // No need to find mediaSite, use fixed value
    // const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
    // if (!mediaSite) { ... } // This check is less critical now

    const outlineTemplate =
      generatedOutlineText || "<!-- Default Outline/Template -->";

    console.log(
      `Submitting Recipe: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName} (Fixed), FineTunes=All (${selectedFineTunes.length}) (Fixed), TargetCluster=${
        selectedClusterName === "__ALL_CLUSTERS__" ? "All" : selectedClusterName
      }`,
    );

    try {
      // --- Execute Steps Sequentially (logic remains mostly the same) ---

      let reportForStep6: any | null = selectedKeywordReport;
      let reportForStep7: any | null = selectedKeywordReport;
      const currentSelectedCluster = selectedClusterName;

      if (currentSelectedCluster !== "__ALL_CLUSTERS__" && selectedKeywordReport) {
        const clusterData = selectedKeywordReport.clustersWithVolume?.find(
          (c: any) => c.clusterName === currentSelectedCluster,
        );
        if (clusterData) {
          reportForStep6 = {
            query: selectedKeywordReport.query,
            language: selectedKeywordReport.language,
            region: selectedKeywordReport.region,
            clustersWithVolume: [clusterData],
          };
          reportForStep7 = null; // Only use cluster persona in step 6
        } else {
          reportForStep6 = selectedKeywordReport;
          reportForStep7 = selectedKeywordReport;
        }
      } else {
        reportForStep6 = selectedKeywordReport;
        reportForStep7 = selectedKeywordReport;
      }

      // Step 1: Fetch SERP
      const serpInfo = await callFetchSerpApi(firstKeyword, mediaSiteName); // Use fixed mediaSiteName
      const serpId = serpInfo.id;
      const serpKeyword = serpInfo.originalKeyword;

      // Steps 2-5: Analysis
      const contentTypeResult = await callAnalyzeContentTypeApi(serpId);
      const userIntentResult = await callAnalyzeUserIntentApi(serpId);
      const titleResult = await callAnalyzeTitleApi(serpId);
      const betterHaveResult = await callAnalyzeBetterHaveApi(serpId);

      // Fetch Updated SERP Data
       updateStepStatus("fetch-updated-serp", "loading");
       const updatedSerpData = await getSerpDataAction(serpId);
       if (!updatedSerpData) {
         updateStepStatus("fetch-updated-serp", "error");
         throw new Error("Failed to retrieve updated SERP data after analysis.");
       }
       updateStepStatus("fetch-updated-serp", "completed");


      // Step 6: Generate Action Plan
      const actionPlanResult = await callGenerateActionPlanApi(
        serpKeyword,
        mediaSiteName, // Use fixed mediaSiteName
        updatedSerpData.contentTypeRecommendationText ?? "",
        updatedSerpData.userIntentRecommendationText ?? "",
        updatedSerpData.titleRecommendationText ?? "",
        updatedSerpData.betterHaveRecommendationText ?? "",
        reportForStep6,
        currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster,
      );

      // Step 7: Generate Final Prompt
      const finalPromptResult = await callGenerateFinalPromptApi(
        serpKeyword,
        actionPlanResult.actionPlanText,
        mediaSiteName, // Use fixed mediaSiteName
        updatedSerpData.contentTypeRecommendationText ?? "",
        updatedSerpData.userIntentRecommendationText ?? "",
        updatedSerpData.betterHaveRecommendationText ?? null,
        reportForStep7,
        currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster,
        outlineTemplate,
        null,
        selectedFineTunes, // Use fixed selectedFineTunes
      );

      setResearchPrompt(finalPromptResult.finalPrompt);
      console.log("[UI] Recipe Process Complete. Final Prompt Generated.");
    } catch (err) {
      console.error("[UI Debug] Error in recipe handleSubmit:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during recipe generation.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- handleStartOver (Updated) ---
  const handleStartOver = () => {
    setResearchPrompt(null);
    // Don't reset mediaSiteName or selectedFineTunes
    setSelectedKeywordReport(null);
    setKeyword(""); // Reset keyword as well
    setSelectedClusterName("__ALL_CLUSTERS__"); // Reset cluster
    setDisplayedPersona(null);
    setSteps(initialSteps);
    setGenerationAttempted(false);
    setGeneratedOutlineText(null); // Reset outline
    setError(null);
    setCopied(false);
  };

  // --- Render ---
  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        {/* --- Add a title for the recipe page --- */}
        <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
          Writing Recipe: UrbanLife Special
        </h1>
        <div className="space-y-8">
          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            {/* Header - Simplified */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Window controls */}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                  URBANLIFE_RECIPE_INPUT
                </span>
              </div>
              {/* Right side controls - Removed Fine-Tune button */}
              <div className="flex items-center gap-4">
                 {/* Optionally show fixed site/fine-tune count here if needed */}
                 <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                   Site: urbanlife | Fine-Tunes: {selectedFineTunes.length} (All)
                 </span>
                 <RevalidateButton size="sm" variant="ghost" />
              </div>
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keyword Input Section (remains the same) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="keyword-combobox"
                    className="text-base font-medium"
                  >
                    Keyword
                  </Label>
                  <div className="relative">
                    <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                         <Button
                          id="keyword-combobox"
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          disabled={isLoading || isListLoading}
                          className="w-full h-12 justify-between pl-10 pr-28 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800" // Adjusted padding right
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
                        style={{ width: "var(--radix-popover-trigger-width)" }}
                      >
                        <Command shouldFilter={false} className="p-0">
                           <CommandInput
                            placeholder="Search keyword or type..."
                            value={keyword}
                            onValueChange={(search: string) => {
                              setKeyword(search);
                              setSelectedKeywordReport(null); // Clear report and cluster
                              setSelectedClusterName("__ALL_CLUSTERS__"); // Reset cluster on keyword change
                            }}
                            className="h-11"
                          />
                          <CommandList>
                            {isListLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />Loading keywords...</div>}
                            {!isListLoading && listFetchError && <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">Error: {listFetchError}</div>}
                            {!isListLoading && !listFetchError && realKeywordList.length === 0 && <CommandEmpty>No keyword research found.</CommandEmpty>}
                            {!isListLoading && !listFetchError && realKeywordList.length > 0 && (
                              <CommandGroup>
                                {realKeywordList.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.query}
                                    onSelect={async (currentValue: string) => {
                                      const selectedItem = realKeywordList.find(i => i.query.toLowerCase() === currentValue.toLowerCase());
                                      if (!selectedItem) return;

                                      setKeyword(selectedItem.query);
                                      setComboboxOpen(false);
                                      setSelectedKeywordReport(null);
                                      setSelectedClusterName("__ALL_CLUSTERS__"); // Reset cluster
                                      setIsDetailLoading(true);

                                      try {
                                        const detailResult = await submitGetKeywordVolumeObj({ researchId: selectedItem.id });
                                        if (!detailResult) {
                                          toast.error("Could not fetch keyword details.");
                                        } else {
                                          setSelectedKeywordReport(detailResult as KeywordVolumeObject);
                                        }
                                      } catch (error) {
                                        toast.error(error instanceof Error ? `Error fetching details: ${error.message}` : "Unknown error fetching details.");
                                      } finally {
                                        setIsDetailLoading(false);
                                      }
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", keyword.toLowerCase() === item.query.toLowerCase() ? "opacity-100" : "opacity-0")} />
                                    {item.query}
                                    {typeof item.totalVolume === "number" && <span className="ml-auto text-xs text-muted-foreground">Vol: {item.totalVolume.toLocaleString()}</span>}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {/* Action Buttons - Simplified */}
                    <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
                      <Button
                        type="submit"
                        disabled={isLoading || isDetailLoading}
                        className={cn(
                          "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                           "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700",
                          (isLoading || isDetailLoading) && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TerminalSquare className="h-3.5 w-3.5" />}
                        Generate
                      </Button>
                      {/* Removed Media Site Button */}
                    </div>
                  </div>
                </div>

                 {/* Cluster Selection Dropdown (remains the same) */}
                 {isMounted && hasClusters && (
                  <div className="space-y-2">
                    <Label htmlFor="cluster-select" className="text-base font-medium">
                      Target Cluster / Persona (Optional)
                    </Label>
                    <Select
                      value={selectedClusterName}
                      onValueChange={setSelectedClusterName}
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
                        <SelectItem value="__ALL_CLUSTERS__">
                          All Clusters (No Specific Persona)
                        </SelectItem>
                        {selectedKeywordReport?.clustersWithVolume?.map((cluster: any, index: number) => (
                          <SelectItem
                            key={cluster.clusterName || `cluster-${index}`}
                            value={cluster.clusterName || `Cluster ${index + 1}`}
                          >
                            {cluster.clusterName || `Cluster ${index + 1}`} (Vol: {cluster.totalVolume?.toLocaleString() ?? 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Display Area for Associated Persona */}
                    {selectedClusterName !== "__ALL_CLUSTERS__" && (
                      <div className="mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-900/10 text-sm text-indigo-800 dark:text-indigo-200">
                        {displayedPersona ? (
                          <>
                            <p className="font-medium mb-1">Targeting Persona: {selectedClusterName}</p>
                            <p className="text-xs opacity-80 line-clamp-3">{displayedPersona}</p>
                          </>
                        ) : (
                          <p className="text-xs opacity-70 italic">(Persona description not found or loading...)</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Removed Media Site and Fine-Tune Selection Areas */}

                {/* Progress Checklist */}
                {generationAttempted && (
                  <ProgressChecklistDisplay steps={steps} />
                )}

                {/* Error Display */}
                {!isLoading && (
                  <ErrorDisplay error={error} onDismiss={() => setError(null)} />
                )}

                {/* Result Display */}
                {!isLoading && researchPrompt && (
                  <ResultDisplay
                    researchPrompt={researchPrompt}
                    generatedOutlineText={generatedOutlineText}
                    onCopyToClipboard={handleCopyToClipboard}
                    onStartOver={handleStartOver}
                    copied={copied}
                  />
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

