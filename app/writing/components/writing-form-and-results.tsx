'use client';

import type { ClientSafeSerpDataDoc } from '@/app/actions/serp-action';
import { MEDIASITE_DATA } from '@/app/global-config';
import type {
  AiSerpBetterHaveAnalysisJson as BetterHaveAnalysisJson,
  KeywordVolumeObject as ProcessedKeywordResearchData,
  AiTitleAnalysisJson as TitleAnalysisJson
} from '@/app/services/firebase/schema';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Settings2, TerminalSquare } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Step, useWritingContext } from '../context/writing-context';
import { ErrorDisplay } from './error-display';
import { InputParametersForm } from './input-parameters-form';
import { ProgressChecklistDisplay } from './progress-checklist-display';
import { ResultDisplay } from './result-display';

const API_BASE_URL = '/api/writing';
const API_OUTLINE_URL = `${API_BASE_URL}/outline`;
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;

const STEP_ID_OUTLINE = 'outline';
const STEP_ID_FETCH_SERP = 'fetch-serp';
const STEP_ID_ANALYZE_CONTENT_TYPE = 'analyze-content-type';
const STEP_ID_ANALYZE_USER_INTENT = 'analyze-user-intent';
const STEP_ID_ANALYZE_TITLE = 'analyze-title';
const STEP_ID_ANALYZE_BETTER_HAVE = 'analyze-better-have';
const STEP_ID_GENERATE_ACTION_PLAN = 'generate-action-plan';
const STEP_ID_GENERATE_FINAL_PROMPT = 'generate-final-prompt';

export function WritingFormAndResults() {
  const {
    keyword,
    mediaSiteName,
    researchPrompt,
    setResearchPrompt,
    selectedFineTunes,
    selectedKeywordReport,
    selectedClusterName,
    isDetailLoading,
    isMounted,
    generationAttempted,
    setGenerationAttempted,
    isLoading,
    setIsLoading,
    error,
    setError,
    copied,
    showFineTuneOptions,
    setShowFineTuneOptions,
    generatedOutlineText,
    setGeneratedOutlineText,
    steps,
    setSteps,
    handleCopyToClipboard,
    handleStartOver,
    realKeywordList
  } = useWritingContext();

  const [isMountedState, setIsMountedState] = useState(false);

  useEffect(() => {
    setIsMountedState(true);
  }, []);

  const updateStepStatus = (
    stepId: string,
    status: Step['status'],
    durationMs?: number
  ) => {
    const newSteps = steps.map((step: Step) =>
      step.id === stepId ? { ...step, status, durationMs } : step
    );
    setSteps(newSteps);
  };

  const callApi = async <T,>(
    stepId: string,
    url: string,
    payload: any
  ): Promise<T> => {
    updateStepStatus(stepId, 'loading');
    const startTime = performance.now();
    let durationMs = 0;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      durationMs = performance.now() - startTime;
      if (!response.ok) {
        let errorDetails = `API Error (${stepId}): ${response.statusText}`;
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {}
        if (errorBody && (errorBody.details || errorBody.error)) {
          errorDetails =
            typeof errorBody.details === 'string'
              ? errorBody.details
              : typeof errorBody.error === 'string'
              ? errorBody.error
              : JSON.stringify(errorBody);
        } else {
          try {
            const textError = await response.text();
            if (textError) errorDetails += ` - ${textError}`;
          } catch {}
        }
        console.error(
          `[API Call Error - ${stepId}] Status: ${response.status}, Details: ${errorDetails}`
        );
        throw new Error(errorDetails);
      }
      const result = await response.json();
      updateStepStatus(stepId, 'completed', durationMs);
      console.log(
        `[API Call Success - ${stepId}] (${(durationMs / 1000).toFixed(1)}s).`
      );
      return result as T;
    } catch (error) {
      updateStepStatus(stepId, 'error');
      console.error(`[API Call Error - ${stepId}] Catch block:`, error);
      throw error;
    }
  };

  const callOutlineApi = async (
    keyword: string,
    language: string,
    region: string
  ): Promise<{ outlineText: string }> => {
    const result = await callApi<{ outlineText: string }>(
      STEP_ID_OUTLINE,
      API_OUTLINE_URL,
      { keyword, language, region }
    );
    setGeneratedOutlineText(result.outlineText);
    return result;
  };

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

  type AnalyzeTitleResult = {
    analysisJson: TitleAnalysisJson;
    recommendationText: string;
  };
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

  type AnalyzeBetterHaveResult = {
    analysisJson: BetterHaveAnalysisJson;
    recommendationText: string;
  };
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
      {
        serpDocId,
        keyword,
        organicResults,
        peopleAlsoAsk,
        relatedQueries,
        aiOverview
      }
    );
  };

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
      {
        keyword,
        mediaSiteName,
        contentTypeReportText,
        userIntentReportText,
        titleRecommendationText,
        betterHaveRecommendationText,
        keywordReport,
        selectedClusterName
      }
    );
  };

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
    contentMarketingSuggestion: string | null,
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
        contentMarketingSuggestion: contentMarketingSuggestion || '',
        fineTuneNames,
        betterHaveAnalysisJson
      }
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setGenerationAttempted(true);
    setError(null);
    setResearchPrompt(null);
    const resetSteps = steps.map((s: Step) => ({
      ...s,
      status: 'pending' as const,
      durationMs: undefined
    }));
    setSteps(resetSteps);

    if (!keyword || !mediaSiteName) {
      setError('Please provide both a keyword and select a media site.');
      setIsLoading(false);
      return;
    }
    const firstKeyword = keyword.split(',')[0].trim();
    if (!firstKeyword) {
      setError('Please provide a valid keyword.');
      setIsLoading(false);
      return;
    }
    const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
    if (!mediaSite) {
      setError(`Media site configuration not found for name: ${mediaSiteName}`);
      setIsLoading(false);
      return;
    }
    const currentSelectedCluster = selectedClusterName;

    console.log(
      `Submitting: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName}, FineTunes=${selectedFineTunes.join(
        ', '
      )}, TargetCluster=${
        currentSelectedCluster === '__ALL_CLUSTERS__'
          ? 'All'
          : currentSelectedCluster
      }`
    );

    try {
      let reportForStep6: any | null = selectedKeywordReport;
      let reportForStep7: any | null = selectedKeywordReport;
      if (
        currentSelectedCluster !== '__ALL_CLUSTERS__' &&
        selectedKeywordReport
      ) {
        const clusterData = selectedKeywordReport.clustersWithVolume?.find(
          (c: any) => c.clusterName === currentSelectedCluster
        );
        if (clusterData) {
          reportForStep6 = {
            query: selectedKeywordReport.query,
            language: selectedKeywordReport.language,
            region: selectedKeywordReport.region,
            clustersWithVolume: [clusterData]
          };
          reportForStep7 = null;
        } else {
          console.warn(
            `[handleSubmit] Selected cluster '${currentSelectedCluster}' not found in report. Using full report.`
          );
          reportForStep6 = selectedKeywordReport;
          reportForStep7 = selectedKeywordReport;
        }
      } else {
        reportForStep6 = selectedKeywordReport;
        reportForStep7 = selectedKeywordReport;
      }

      const serpData = await callFetchSerpApi(firstKeyword, mediaSiteName);
      const contentTypeResult = await callAnalyzeContentTypeApi(
        serpData.id,
        serpData.query,
        serpData.organicResults ?? null
      );
      const userIntentResult = await callAnalyzeUserIntentApi(
        serpData.id,
        serpData.query,
        serpData.organicResults ?? null,
        serpData.relatedQueries ?? null
      );
      const titleResult = await callAnalyzeTitleApi(
        serpData.id,
        serpData.query,
        serpData.organicResults ?? null
      );
      const betterHaveResult = await callAnalyzeBetterHaveApi(
        serpData.id,
        serpData.query,
        serpData.organicResults ?? null,
        serpData.peopleAlsoAsk ?? null,
        serpData.relatedQueries ?? null,
        serpData.aiOverview ?? null
      );
      const actionPlanResult = await callGenerateActionPlanApi(
        serpData.query,
        mediaSiteName,
        contentTypeResult.recommendationText,
        userIntentResult.recommendationText,
        titleResult.recommendationText,
        betterHaveResult.recommendationText,
        reportForStep6,
        currentSelectedCluster === '__ALL_CLUSTERS__'
          ? null
          : currentSelectedCluster
      );
      const finalPromptResult = await callGenerateFinalPromptApi(
        serpData.query,
        actionPlanResult.actionPlanText,
        mediaSiteName,
        contentTypeResult.recommendationText,
        userIntentResult.recommendationText,
        betterHaveResult.recommendationText ?? null,
        reportForStep7,
        currentSelectedCluster === '__ALL_CLUSTERS__'
          ? null
          : currentSelectedCluster,
        generatedOutlineText || '<!-- Default Outline -->',
        null,
        selectedFineTunes,
        betterHaveResult.analysisJson ?? null
      );

      setResearchPrompt(finalPromptResult.finalPrompt);
      console.log('[UI] Process Complete. Final Research Prompt Generated.');
    } catch (err) {
      console.error('[UI Debug] Error caught in handleSubmit:', err);
      if (!error) {
        setError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during generation.'
        );
      }
    } finally {
      console.log(
        '[UI Debug] handleSubmit finally block reached. Setting isLoading=false.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        <div className="space-y-8">
          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFineTuneOptions(!showFineTuneOptions)}
                  className="text-xs font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-2 py-1 h-auto"
                  disabled={isLoading || isDetailLoading}
                >
                  <Settings2 className="h-3.5 w-3.5 mr-1" /> Fine-Tune (
                  {isMountedState ? selectedFineTunes.length : 0})
                </Button>
              </div>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <InputParametersForm />
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading || isDetailLoading}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors border',
                      'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600',
                      (isLoading || isDetailLoading) &&
                        'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <TerminalSquare className="h-4 w-4 mr-2" />
                    )}{' '}
                    Generate Research Prompt
                  </Button>
                </div>
                {isMountedState && generationAttempted && (
                  <ProgressChecklistDisplay steps={steps} />
                )}
                {!isLoading && (
                  <ErrorDisplay
                    error={error}
                    onDismiss={() => setError(null)}
                  />
                )}
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
