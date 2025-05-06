"use client";

import { MEDIASITE_DATA } from "@/app/global-config";
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
import { useClientStorage } from "@/components/hooks/use-client-storage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Wand2,
  Settings2,
} from "lucide-react";
import type React from "react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ErrorDisplay } from "./components/error-display";
import { RevalidateButton, FineTuneButton } from "@/app/actions/actions-buttons";

import type {
  KeywordVolumeListItem,
  KeywordVolumeObject,
} from "@/app/services/firebase/schema";
import { submitGetKeywordVolumeObj } from "@/app/actions/actions-keyword-volume";
import { getSerpDataAction } from "@/app/actions/actions-ai-serp-result";
import { generateRevisionFromInputTextAndUrlGraph } from '@/app/actions/actions-ai-graph';

import { PromptGeneratorForm } from "./components/prompt-generator-form";
import { PromptGenerationResult } from "./components/prompt-generation-result";
import { ArticleRefinementInput } from "./components/article-refinement-input";
import { FinalArticleGeneratorControls } from "./components/final-article-generator-controls";
import { FinalArticleDisplay } from "./components/final-article-display";

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

const STEP_ID_FETCH_SERP = "fetch-serp";
const STEP_ID_ANALYZE_CONTENT_TYPE = "analyze-content-type";
const STEP_ID_ANALYZE_USER_INTENT = "analyze-user-intent";
const STEP_ID_ANALYZE_TITLE = "analyze-title";
const STEP_ID_ANALYZE_BETTER_HAVE = "analyze-better-have";
const STEP_ID_GENERATE_ACTION_PLAN = "generate-action-plan";
const STEP_ID_GENERATE_FINAL_PROMPT = "generate-final-prompt";

const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map((item) => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map((item) => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map((item) => item.name),
];

const AVAILABLE_MODELS = ["ChatGPT", "Gemini", "Perplexity"];

export interface Step {
  id: string;
  name: string;
  status: "pending" | "loading" | "completed" | "error";
  durationMs?: number;
}

export default function WritingPage() {
  const [keyword, setKeyword] = useClientStorage("writing:keyword", "");
  const [mediaSiteName, setMediaSiteName] = useClientStorage(
    "writing:mediaSiteName",
    "",
  );
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    "writing:researchPrompt",
    null,
  );
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>(
    "writing:selectedFineTunes",
    [],
  );
  const [selectedKeywordReport, setSelectedKeywordReport] =
    useClientStorage<KeywordVolumeObject | null>(
      "writing:selectedKeywordReport",
      null,
    );
  const [selectedClusterName, setSelectedClusterName] =
    useState<string>("__ALL_CLUSTERS__");
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);
  const [realKeywordList, setRealKeywordList] = useState<KeywordVolumeListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listFetchError, setListFetchError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    "writing:generationAttempted",
    false,
  );
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false);
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >("writing:generatedOutlineText", null);
  const [steps, setSteps] = useState<Step[]>([]);

  const [inputText, setInputText] = useClientStorage<string>("writing:inputText", "");
  const [targetUrl, setTargetUrl] = useClientStorage<string>("writing:targetUrl", "");
  const [finalArticle, setFinalArticle] = useClientStorage<string | null>("writing:finalArticle", null);
  const [isGeneratingArticle, startArticleGeneration] = useTransition();
  const [articleError, setArticleError] = useState<string | null>(null);

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

  useEffect(() => {
    setIsMounted(true);
    if (!generationAttempted) {
        setSteps(initialSteps);
    }
  }, [generationAttempted]);

  useEffect(() => {
    if (generationAttempted) {
        setSteps(initialSteps); 
    }
  }, [keyword]);

  useEffect(() => {
    const loadKeywordsFromApi = async () => {
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
      } catch (error: any) { setListFetchError(error.message || "Unknown error"); }
      finally { setIsListLoading(false); }
    };
    loadKeywordsFromApi();
  }, []);

  useEffect(() => {
    setSelectedClusterName("__ALL_CLUSTERS__");
  }, [selectedKeywordReport]);

  useEffect(() => {
    if (selectedClusterName === "__ALL_CLUSTERS__" || !selectedKeywordReport?.clustersWithVolume) {
      setDisplayedPersona(null);
      return;
    }
    const foundCluster = selectedKeywordReport.clustersWithVolume.find((c: any) => c.clusterName === selectedClusterName);
    setDisplayedPersona(foundCluster?.personaDescription || null);
    if (selectedClusterName !== "__ALL_CLUSTERS__" && !foundCluster?.personaDescription) {
      console.warn(`Persona description not found for cluster: ${selectedClusterName}`);
    }
  }, [selectedClusterName, selectedKeywordReport]);

  const hasClusters = (selectedKeywordReport?.clustersWithVolume ?? []).length > 0;

  const handleCopyToClipboard = async (textToCopy: string | null) => {
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        toast.success("Copied to clipboard!");
        if (textToCopy === researchPrompt) {
            setCopiedPrompt(true);
            setTimeout(() => setCopiedPrompt(false), 2000);
        }
      } catch (err) { toast.error("Failed to copy."); }
    }
  };

  const handleFineTuneChange = (checked: boolean | string, name: string) => {
    setSelectedFineTunes((prev) => checked === true ? [...prev, name] : prev.filter((item) => item !== name));
  };

  const updateStepStatus = (stepId: string, status: Step["status"], durationMs?: number) => {
    setSteps((prevSteps) => prevSteps.map((step) => step.id === stepId ? { ...step, status, durationMs } : step));
  };

  const callPromptApi = async <T,>(stepId: string, url: string, payload: any): Promise<T> => {
    updateStepStatus(stepId, "loading");
    const startTime = performance.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const durationMs = performance.now() - startTime;
      if (!response.ok) {
        let errorDetails = `API Error (${stepId}): ${response.statusText}`;
        try { const errorBody = await response.json(); errorDetails = errorBody.details || errorBody.error || JSON.stringify(errorBody); }
        catch { try { const textError = await response.text(); if (textError) errorDetails += ` - ${textError}`; } catch {} }
        throw new Error(errorDetails);
      }
      const result = await response.json();
      updateStepStatus(stepId, "completed", durationMs);
      return result as T;
    } catch (error) {
      updateStepStatus(stepId, "error");
      throw error;
    }
  };

  const callFetchSerpApi = async (keyword: string, mediaSiteName: string) => callPromptApi<{ id: string; originalKeyword: string }>(STEP_ID_FETCH_SERP, API_STEP1_FETCH_SERP_URL, { keyword, mediaSiteName });
  const callAnalyzeContentTypeApi = async (serpDocId: string) => callPromptApi<{ recommendationText: string }>(STEP_ID_ANALYZE_CONTENT_TYPE, API_STEP2_ANALYZE_CONTENT_TYPE_URL, { serpDocId });
  const callAnalyzeUserIntentApi = async (serpDocId: string) => callPromptApi<{ recommendationText: string }>(STEP_ID_ANALYZE_USER_INTENT, API_STEP3_ANALYZE_USER_INTENT_URL, { serpDocId });
  const callAnalyzeTitleApi = async (serpDocId: string) => callPromptApi<{ recommendationText: string }>(STEP_ID_ANALYZE_TITLE, API_STEP4_ANALYZE_TITLE_URL, { serpDocId });
  const callAnalyzeBetterHaveApi = async (serpDocId: string) => callPromptApi<{ recommendationText: string }>(STEP_ID_ANALYZE_BETTER_HAVE, API_STEP5_ANALYZE_BETTER_HAVE_URL, { serpDocId });
  const callGenerateActionPlanApi = async (payload: any) => callPromptApi<{ actionPlanText: string }>(STEP_ID_GENERATE_ACTION_PLAN, API_STEP6_GENERATE_ACTION_PLAN_URL, payload);
  const callGenerateFinalPromptApi = async (payload: any) => callPromptApi<{ finalPrompt: string }>(STEP_ID_GENERATE_FINAL_PROMPT, API_STEP7_GENERATE_FINAL_PROMPT_URL, payload);

  const handleSubmitPrompt = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setIsLoadingPrompt(true);
    setGenerationAttempted(true);
    setPromptError(null);
    setResearchPrompt(null);
    setFinalArticle(null);
    setArticleError(null);
    setSteps(initialSteps);

    if (!keyword || !mediaSiteName) {
      setPromptError("Please provide keyword and media site.");
      setIsLoadingPrompt(false);
      return;
    }
    const firstKeyword = keyword.split(",")[0].trim();
    if (!firstKeyword) {
      setPromptError("Please provide a valid keyword.");
      setIsLoadingPrompt(false);
      return;
    }

    const outlineTemplate = generatedOutlineText || "<!-- Default Outline/Template -->";
    console.log(`Submitting Prompt Gen: Keyword=${firstKeyword}, MediaSite=${mediaSiteName}, Cluster=${selectedClusterName}`);

    try {
      let reportForStep6: any | null = selectedKeywordReport;
      let reportForStep7: any | null = selectedKeywordReport;
      const currentSelectedCluster = selectedClusterName;
      if (currentSelectedCluster !== "__ALL_CLUSTERS__" && selectedKeywordReport) {
          const clusterData = selectedKeywordReport.clustersWithVolume?.find((c: any) => c.clusterName === currentSelectedCluster);
        if (clusterData) {
              reportForStep6 = { query: selectedKeywordReport.query, language: selectedKeywordReport.language, region: selectedKeywordReport.region, clustersWithVolume: [clusterData] };
          reportForStep7 = null;
        } else {
          reportForStep6 = selectedKeywordReport;
          reportForStep7 = selectedKeywordReport;
        }
      } else {
        reportForStep6 = selectedKeywordReport;
        reportForStep7 = selectedKeywordReport;
      }

      const serpInfo = await callFetchSerpApi(firstKeyword, mediaSiteName);
      const serpId = serpInfo.id;
      const serpKeyword = serpInfo.originalKeyword;

      await callAnalyzeContentTypeApi(serpId);
      await callAnalyzeUserIntentApi(serpId);
      await callAnalyzeTitleApi(serpId);
      await callAnalyzeBetterHaveApi(serpId);

      updateStepStatus("fetch-updated-serp", "loading"); 
      const updatedSerpData = await getSerpDataAction(serpId);
      if (!updatedSerpData) {
        updateStepStatus("fetch-updated-serp", "error");
        throw new Error("Failed to retrieve updated SERP data after analysis.");
      }
      updateStepStatus("fetch-updated-serp", "completed");

      const actionPlanResult = await callGenerateActionPlanApi({
          keyword: serpKeyword, mediaSiteName,
          contentTypeReportText: updatedSerpData.contentTypeRecommendationText ?? "",
          userIntentReportText: updatedSerpData.userIntentRecommendationText ?? "",
          titleRecommendationText: updatedSerpData.titleRecommendationText ?? "",
          betterHaveRecommendationText: updatedSerpData.betterHaveRecommendationText ?? "",
          keywordReport: reportForStep6,
          selectedClusterName: currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster,
      });

      const finalPromptResult = await callGenerateFinalPromptApi({
          keyword: serpKeyword, actionPlan: actionPlanResult.actionPlanText, mediaSiteName,
          contentTypeReportText: updatedSerpData.contentTypeRecommendationText ?? "",
          userIntentReportText: updatedSerpData.userIntentRecommendationText ?? "",
          betterHaveRecommendationText: updatedSerpData.betterHaveRecommendationText ?? null,
          keywordReport: reportForStep7,
          selectedClusterName: currentSelectedCluster === "__ALL_CLUSTERS__" ? null : currentSelectedCluster,
          articleTemplate: outlineTemplate,
          contentMarketingSuggestion: null,
          fineTuneNames: selectedFineTunes,
      });

      setResearchPrompt(finalPromptResult.finalPrompt);
      console.log("[UI] Prompt Generation Complete.");

    } catch (err) {
        console.error("[UI Debug] Error caught in handleSubmitPrompt:", err);
        setPromptError(err instanceof Error ? err.message : "An unexpected error occurred during prompt generation.");
    } finally {
        setIsLoadingPrompt(false);
    }
  };

  const handleGenerateFinalArticle = () => {
      if (!researchPrompt) {
          setArticleError("Please generate a research prompt first.");
          return;
      }
      if (!inputText && !targetUrl) {
          setArticleError("Please provide either input text or a target URL for refinement.");
          return;
      }
      if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          setArticleError('Target URL for refinement must start with http:// or https://');
          return;
      }

      startArticleGeneration(async () => {
          setArticleError(null);
          setFinalArticle(null);
          console.log("--- Starting Final Article Generation (using graph action) ---");
          console.log("Input Text:", inputText ? inputText.substring(0, 100) + "..." : "(Not provided)");
          console.log("Target URL:", targetUrl || "(Not provided)");
          
          try {
              const result = await generateRevisionFromInputTextAndUrlGraph({ 
                  inputText: inputText || "",
                  targetUrl: targetUrl || ""
              });

              if (result.success && result.revisedArticle) {
                  setFinalArticle(result.revisedArticle);
                  toast.success("Final article generated successfully!");
              } else {
                  const errorMsg = result.error || "An unknown error occurred generating the final article.";
                  setArticleError(errorMsg);
                  toast.error(`Article generation failed: ${errorMsg}`); 
              }
          } catch (err) {
              console.error("[UI Debug] Error calling generateRevisionFromInputTextAndUrlGraph:", err);
              const message = err instanceof Error ? err.message : "An unexpected error occurred.";
              setArticleError(`Error: ${message}`);
              toast.error(`Article generation error: ${message}`);
          }
      });
  };

  const handleStartOver = () => {
    setKeyword("");
    setMediaSiteName("");
    setSelectedFineTunes([]);
    setSelectedKeywordReport(null);
    setSelectedClusterName("__ALL_CLUSTERS__");
    setDisplayedPersona(null);
    setSteps(initialSteps);
    setResearchPrompt(null);
    setGeneratedOutlineText(null);
    setInputText("");
    setTargetUrl("");
    setFinalArticle(null);
    setGenerationAttempted(false);
    setIsLoadingPrompt(false);
    setPromptError(null);
    setCopiedPrompt(false);
    setArticleError(null);
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          <div className="space-y-6 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                  PROMPT_GENERATION
                </span>
              </div>
              <div className="flex items-center gap-4">
                <FineTuneButton
                  onClick={() => setShowFineTuneOptions(!showFineTuneOptions)}
                  disabled={isLoadingPrompt || isDetailLoading || isGeneratingArticle}
                  count={selectedFineTunes.length}
                />
                <RevalidateButton size="sm" variant="ghost" />
              </div>
            </div>
            <PromptGeneratorForm
              keyword={keyword}
              setKeyword={setKeyword}
              mediaSiteName={mediaSiteName}
              setMediaSiteName={setMediaSiteName}
              selectedFineTunes={selectedFineTunes}
              handleFineTuneChange={handleFineTuneChange}
              allFineTuneNames={allFineTuneNames}
              selectedKeywordReport={selectedKeywordReport}
              setSelectedKeywordReport={setSelectedKeywordReport}
              selectedClusterName={selectedClusterName}
              setSelectedClusterName={setSelectedClusterName}
              displayedPersona={displayedPersona}
              realKeywordList={realKeywordList}
              isListLoading={isListLoading}
              listFetchError={listFetchError}
              isDetailLoading={isDetailLoading}
              setIsDetailLoading={setIsDetailLoading}
              isMounted={isMounted}
              isLoadingPrompt={isLoadingPrompt}
              isGeneratingArticle={isGeneratingArticle}
              showMediaSiteOptions={showMediaSiteOptions}
              setShowMediaSiteOptions={setShowMediaSiteOptions}
              showFineTuneOptions={showFineTuneOptions}
              comboboxOpen={comboboxOpen}
              setComboboxOpen={setComboboxOpen}
              hasClusters={hasClusters}
              handleSubmitPrompt={handleSubmitPrompt}
            />

            {generationAttempted && (
              <div className="mt-6 pt-6 border-t border-dashed dark:border-neutral-700">
                <PromptGenerationResult
                  generationAttempted={generationAttempted}
                  steps={steps}
                  isLoadingPrompt={isLoadingPrompt}
                  promptError={promptError}
                  researchPrompt={researchPrompt}
                  generatedOutlineText={generatedOutlineText}
                  handleCopyToClipboard={handleCopyToClipboard}
                  handleStartOver={handleStartOver}
                  copiedPrompt={copiedPrompt}
                  setPromptError={setPromptError}
                />
              </div>
            )}
                </div>

          <div className="space-y-8 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                <div className="w-2 h-2 rounded-full bg-orange-400 dark:bg-orange-500"></div>
                <div className="w-2 h-2 rounded-full bg-purple-400 dark:bg-purple-500"></div>
                        </div>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                ARTICLE_REFINEMENT & GENERATION
              </span>
                      </div>

            <ArticleRefinementInput
              inputText={inputText}
              setInputText={setInputText}
              targetUrl={targetUrl}
              setTargetUrl={setTargetUrl}
              isGeneratingArticle={isGeneratingArticle}
              isLoadingPrompt={isLoadingPrompt}
            />

            <div className="pt-6 border-t border-dashed dark:border-neutral-700">
              <FinalArticleGeneratorControls
                handleGenerateFinalArticle={handleGenerateFinalArticle}
                researchPrompt={researchPrompt}
                isGeneratingArticle={isGeneratingArticle}
                isLoadingPrompt={isLoadingPrompt}
                articleError={articleError}
                setArticleError={setArticleError}
              />
                          </div>

            <FinalArticleDisplay
              finalArticle={finalArticle}
              isGeneratingArticle={isGeneratingArticle}
              handleStartOver={handleStartOver}
              handleCopyToClipboard={handleCopyToClipboard}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
