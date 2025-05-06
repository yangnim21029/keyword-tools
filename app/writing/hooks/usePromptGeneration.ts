import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Step } from "@/app/writing/types"; // Use the new types file
import type { KeywordVolumeObject } from "@/app/services/firebase/schema"; // Assuming type is exported or moved
import { getSerpDataAction } from "@/app/actions/actions-ai-serp-result";

// Define API URLs (Consider moving these to a config file)
const API_BASE_URL = "/api/writing";
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;

// Define Step IDs (Consider moving these to a config file or enum)
const STEP_ID_FETCH_SERP = "fetch-serp";
const STEP_ID_ANALYZE_CONTENT_TYPE = "analyze-content-type";
const STEP_ID_ANALYZE_USER_INTENT = "analyze-user-intent";
const STEP_ID_ANALYZE_TITLE = "analyze-title";
const STEP_ID_ANALYZE_BETTER_HAVE = "analyze-better-have";
const STEP_ID_GENERATE_ACTION_PLAN = "generate-action-plan";
const STEP_ID_GENERATE_FINAL_PROMPT = "generate-final-prompt";
const STEP_ID_FETCH_UPDATED_SERP = "fetch-updated-serp"; // Added for clarity

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
    id: STEP_ID_FETCH_UPDATED_SERP,
    name: "Intermediate: Fetch Updated SERP",
    status: "pending",
  }, // Added step
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

interface UsePromptGenerationProps {
  keyword: string;
  mediaSiteName: string;
  selectedKeywordReport: KeywordVolumeObject | null;
  selectedClusterName: string;
  generatedOutlineText: string | null;
  selectedFineTunes: string[];
  onGenerationStart?: () => void;
  onGenerationSuccess?: (prompt: string) => void;
  onGenerationError?: (error: string) => void;
  onReset?: () => void; // Callback to reset other states if needed
}

interface UsePromptGenerationReturn {
  steps: Step[];
  isLoading: boolean;
  error: string | null;
  generatePrompt: () => Promise<void>;
  resetPromptGeneration: () => void;
  clearError: () => void;
}

export function usePromptGeneration({
  keyword,
  mediaSiteName,
  selectedKeywordReport,
  selectedClusterName,
  generatedOutlineText,
  selectedFineTunes,
  onGenerationStart,
  onGenerationSuccess,
  onGenerationError,
  onReset,
}: UsePromptGenerationProps): UsePromptGenerationReturn {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStepStatus = useCallback(
    (stepId: string, status: Step["status"], durationMs?: number) => {
      setSteps((prevSteps) =>
        prevSteps.map((step) =>
          step.id === stepId ? { ...step, status, durationMs } : step
        )
      );
    },
    []
  );

  const resetPromptGeneration = useCallback(() => {
    setSteps(initialSteps);
    setIsLoading(false);
    setError(null);
    onReset?.();
  }, [onReset]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const callPromptApi = useCallback(
    async <T>(stepId: string, url: string, payload: any): Promise<T> => {
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
          let errorDetails = `API Error (${stepId}): ${response.statusText || response.status}`;
          try {
            const errorBody = await response.json();
            errorDetails =
              errorBody.details || errorBody.error || JSON.stringify(errorBody);
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
        console.log(
          `[API Call Success] Step: ${stepId}, Duration: ${durationMs.toFixed(0)}ms`
        );
        return result as T;
      } catch (error) {
        console.error(`[API Call Error] Step: ${stepId}`, error);
        updateStepStatus(stepId, "error");
        throw error; // Re-throw to be caught by the main generation function
      }
    },
    [updateStepStatus]
  );

  // --- Specific API call wrappers ---
  const callFetchSerpApi = useCallback(
    (kw: string, siteName: string) =>
      callPromptApi<{ id: string; originalKeyword: string }>(
        STEP_ID_FETCH_SERP,
        API_STEP1_FETCH_SERP_URL,
        { keyword: kw, mediaSiteName: siteName }
      ),
    [callPromptApi]
  );

  const callAnalyzeContentTypeApi = useCallback(
    (serpDocId: string) =>
      callPromptApi<{ recommendationText: string }>(
        STEP_ID_ANALYZE_CONTENT_TYPE,
        API_STEP2_ANALYZE_CONTENT_TYPE_URL,
        { serpDocId }
      ),
    [callPromptApi]
  );

  const callAnalyzeUserIntentApi = useCallback(
    (serpDocId: string) =>
      callPromptApi<{ recommendationText: string }>(
        STEP_ID_ANALYZE_USER_INTENT,
        API_STEP3_ANALYZE_USER_INTENT_URL,
        { serpDocId }
      ),
    [callPromptApi]
  );

  const callAnalyzeTitleApi = useCallback(
    (serpDocId: string) =>
      callPromptApi<{ recommendationText: string }>(
        STEP_ID_ANALYZE_TITLE,
        API_STEP4_ANALYZE_TITLE_URL,
        { serpDocId }
      ),
    [callPromptApi]
  );

  const callAnalyzeBetterHaveApi = useCallback(
    (serpDocId: string) =>
      callPromptApi<{ recommendationText: string }>(
        STEP_ID_ANALYZE_BETTER_HAVE,
        API_STEP5_ANALYZE_BETTER_HAVE_URL,
        { serpDocId }
      ),
    [callPromptApi]
  );

  const callGenerateActionPlanApi = useCallback(
    (payload: any) =>
      callPromptApi<{ actionPlanText: string }>(
        STEP_ID_GENERATE_ACTION_PLAN,
        API_STEP6_GENERATE_ACTION_PLAN_URL,
        payload
      ),
    [callPromptApi]
  );

  const callGenerateFinalPromptApi = useCallback(
    (payload: any) =>
      callPromptApi<{ finalPrompt: string }>(
        STEP_ID_GENERATE_FINAL_PROMPT,
        API_STEP7_GENERATE_FINAL_PROMPT_URL,
        payload
      ),
    [callPromptApi]
  );
  // --- End specific API call wrappers ---

  const generatePrompt = useCallback(async () => {
    onGenerationStart?.();
    setIsLoading(true);
    setError(null);
    setSteps(initialSteps);

    if (!keyword || !mediaSiteName) {
      const errMsg = "Please provide keyword and media site.";
      setError(errMsg);
      setIsLoading(false);
      onGenerationError?.(errMsg);
      return;
    }
    const firstKeyword = keyword.split(",")[0].trim();
    if (!firstKeyword) {
      const errMsg = "Please provide a valid keyword.";
      setError(errMsg);
      setIsLoading(false);
      onGenerationError?.(errMsg);
      return;
    }

    const outlineTemplate =
      generatedOutlineText || "<!-- Default Outline/Template -->"; // Use provided or default
    console.log(
      `[Prompt Gen Hook] Starting: Keyword=${firstKeyword}, MediaSite=${mediaSiteName}, Cluster=${selectedClusterName}`
    );

    try {
      // Determine keyword report payloads for steps 6 & 7 based on cluster selection
      let reportForStep6: any | null = selectedKeywordReport;
      let reportForStep7: any | null = selectedKeywordReport;
      const currentSelectedCluster = selectedClusterName;

      if (
        currentSelectedCluster !== "__ALL_CLUSTERS__" &&
        selectedKeywordReport?.clustersWithVolume
      ) {
        const clusterData = selectedKeywordReport.clustersWithVolume.find(
          (c: any) => c.clusterName === currentSelectedCluster
        );
        if (clusterData) {
          // Create a minimal report containing only the selected cluster for step 6
          reportForStep6 = {
            query: selectedKeywordReport.query,
            language: selectedKeywordReport.language,
            region: selectedKeywordReport.region,
            clustersWithVolume: [clusterData],
          };
          // Use no report for step 7 if a specific cluster is selected
          // (Assuming final prompt doesn't need cluster details if action plan already used them)
          // If this assumption is wrong, adjust reportForStep7 accordingly.
          reportForStep7 = null;
        }
        // If clusterData is not found (edge case), fall back to using the full report.
      }

      // --- Execute API call sequence ---
      const serpInfo = await callFetchSerpApi(firstKeyword, mediaSiteName);
      const serpId = serpInfo.id;
      const serpKeyword = serpInfo.originalKeyword; // Use the keyword returned by the API

      await callAnalyzeContentTypeApi(serpId);
      await callAnalyzeUserIntentApi(serpId);
      await callAnalyzeTitleApi(serpId);
      await callAnalyzeBetterHaveApi(serpId);

      // Fetch the updated SERP data containing recommendations
      updateStepStatus(STEP_ID_FETCH_UPDATED_SERP, "loading");
      const startTimeSerpFetch = performance.now();
      const updatedSerpData = await getSerpDataAction(serpId); // Use server action
      const durationSerpFetch = performance.now() - startTimeSerpFetch;

      if (!updatedSerpData) {
        updateStepStatus(STEP_ID_FETCH_UPDATED_SERP, "error");
        throw new Error("Failed to retrieve updated SERP data after analysis.");
      }
      updateStepStatus(
        STEP_ID_FETCH_UPDATED_SERP,
        "completed",
        durationSerpFetch
      );
      console.log(
        `[Action Call Success] Step: ${STEP_ID_FETCH_UPDATED_SERP}, Duration: ${durationSerpFetch.toFixed(0)}ms`
      );

      const actionPlanResult = await callGenerateActionPlanApi({
        keyword: serpKeyword, // Use keyword from SERP fetch result
        mediaSiteName,
        contentTypeReportText:
          updatedSerpData.contentTypeRecommendationText ?? "",
        userIntentReportText:
          updatedSerpData.userIntentRecommendationText ?? "",
        titleRecommendationText: updatedSerpData.titleRecommendationText ?? "",
        betterHaveRecommendationText:
          updatedSerpData.betterHaveRecommendationText ?? "",
        keywordReport: reportForStep6,
        selectedClusterName:
          currentSelectedCluster === "__ALL_CLUSTERS__"
            ? null
            : currentSelectedCluster,
      });

      const finalPromptResult = await callGenerateFinalPromptApi({
        keyword: serpKeyword, // Use keyword from SERP fetch result
        actionPlan: actionPlanResult.actionPlanText,
        mediaSiteName,
        contentTypeReportText:
          updatedSerpData.contentTypeRecommendationText ?? "",
        userIntentReportText:
          updatedSerpData.userIntentRecommendationText ?? "",
        betterHaveRecommendationText:
          updatedSerpData.betterHaveRecommendationText ?? "",
        keywordReport: reportForStep7, // Can be null if specific cluster was chosen
        selectedClusterName:
          currentSelectedCluster === "__ALL_CLUSTERS__"
            ? null
            : currentSelectedCluster,
        articleTemplate: outlineTemplate,
        contentMarketingSuggestion: "", // Ensure this is handled if needed later
        fineTuneNames: selectedFineTunes,
      });

      onGenerationSuccess?.(finalPromptResult.finalPrompt);
      console.log("[Prompt Gen Hook] Generation Complete.");
    } catch (err: any) {
      console.error("[Prompt Gen Hook] Error during generation:", err);
      let errorMessage =
        "An unexpected error occurred during prompt generation.";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else {
        try {
          errorMessage = JSON.stringify(err);
        } catch {
          /* ignore */
        }
      }

      setError(errorMessage);
      onGenerationError?.(errorMessage);
      toast.error(`Prompt generation failed: ${errorMessage}`); // Show toast on error
    } finally {
      setIsLoading(false);
    }
  }, [
    keyword,
    mediaSiteName,
    selectedKeywordReport,
    selectedClusterName,
    generatedOutlineText,
    selectedFineTunes,
    onGenerationStart,
    onGenerationSuccess,
    onGenerationError,
    updateStepStatus,
    callFetchSerpApi,
    callAnalyzeContentTypeApi,
    callAnalyzeUserIntentApi,
    callAnalyzeTitleApi,
    callAnalyzeBetterHaveApi,
    callGenerateActionPlanApi,
    callGenerateFinalPromptApi,
  ]);

  return {
    steps,
    isLoading,
    error,
    generatePrompt,
    resetPromptGeneration,
    clearError,
  };
}

// Potential Improvements:
// - Move API URLs and Step IDs to a shared config file.
// - Define more specific types for API payloads and responses instead of 'any'.
// - Export the Step type from a central location (e.g., types file) instead of page.tsx.
// - Consider using a reducer for managing steps/loading/error state if it becomes more complex.
