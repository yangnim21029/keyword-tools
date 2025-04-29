'use client';

import { MEDIASITE_DATA } from '@/app/global-config';
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA
} from '@/app/prompt/fine-tune';
import { useClientStorage } from '@/components/hooks/use-client-storage';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronsUpDown,
  Layers,
  Loader2,
  Settings2,
  TerminalSquare
} from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ErrorDisplay } from './components/error-display';
import { ProgressChecklistDisplay } from './components/progress-checklist-display';
import { ResultDisplay } from './components/result-display';
import { RevalidateButton } from '@/app/actions/actions-buttons';

// --- Import Corrected Types from Schema ---
import type {
  KeywordVolumeListItem, // Renamed from KeywordResearchSummaryItem
  KeywordVolumeObject // Renamed from ProcessedKeywordResearchData
} from '@/app/services/firebase/schema';
// --- Import Server Actions ---
import { submitGetKeywordVolumeObj } from '@/app/actions/actions-keyword-volume';
import { getSerpDataAction } from '@/app/actions/actions-ai-serp-result'; // SERP actions
// --- End Import ---

// --- Define New API Endpoints ---
const API_BASE_URL = '/api/writing';
const API_OUTLINE_URL = `${API_BASE_URL}/outline`; // Keep outline separate for now
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;
const API_KEYWORD_LIST_URL = `${API_BASE_URL}/keyword-list`;

// --- Define New Step IDs ---
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

export default function WritingPage() {
  // Use useClientStorage for persistent state
  const [keyword, setKeyword] = useClientStorage('writing:keyword', '');
  const [mediaSiteName, setMediaSiteName] = useClientStorage(
    'writing:mediaSiteName',
    ''
  );
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    'writing:researchPrompt',
    null
  );
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>(
    'writing:selectedFineTunes',
    []
  );
  const [selectedKeywordReport, setSelectedKeywordReport] =
    useClientStorage<KeywordVolumeObject | null>(
      'writing:selectedKeywordReport',
      null
    );

  // --- Cluster Selection State ---
  const [selectedClusterName, setSelectedClusterName] =
    useState<string>('__ALL_CLUSTERS__');

  // --- UPDATED: State for the displayed Persona description ---
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);

  // --- State for real data ---
  const [realKeywordList, setRealKeywordList] = useState<
    KeywordVolumeListItem[]
  >([]);
  const [isListLoading, setIsListLoading] = useState(true); // Start loading initially
  const [listFetchError, setListFetchError] = useState<string | null>(null);

  // --- State for loading detail ---
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);

  // --- State to track if generation was attempted ---
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    'writing:generationAttempted',
    false
  );

  // Keep local state for UI elements like loading, error, copied status, and visibility toggle
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false);
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false); // State for Combobox popover
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >('writing:generatedOutlineText', null);

  // --- UPDATED: New state for 7-step tracking --- (plus Outline)
  const initialSteps: Step[] = [
    { id: STEP_ID_FETCH_SERP, name: 'Step 1: Fetch SERP', status: 'pending' },
    {
      id: STEP_ID_ANALYZE_CONTENT_TYPE,
      name: 'Step 2: Analyze Content Type',
      status: 'pending'
    },
    {
      id: STEP_ID_ANALYZE_USER_INTENT,
      name: 'Step 3: Analyze User Intent',
      status: 'pending'
    },
    {
      id: STEP_ID_ANALYZE_TITLE,
      name: 'Step 4: Analyze Title',
      status: 'pending'
    },
    {
      id: STEP_ID_ANALYZE_BETTER_HAVE,
      name: 'Step 5: Analyze Better Have',
      status: 'pending'
    },
    {
      id: STEP_ID_GENERATE_ACTION_PLAN,
      name: 'Step 6: Generate Action Plan',
      status: 'pending'
    },
    {
      id: STEP_ID_GENERATE_FINAL_PROMPT,
      name: 'Step 7: Generate Final Prompt',
      status: 'pending'
    }
  ];
  // Use regular useState for steps to test incremental updates
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  // --- Effect for hydration fix ---
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // --- End Effect ---

  // --- UPDATED: Effect to fetch real keyword data FROM API ---
  useEffect(() => {
    const loadKeywordsFromApi = async () => {
      setIsListLoading(true);
      setListFetchError(null);
      try {
        // Keep fetching list via API route
        console.log(
          '[API Fetch] Fetching keyword list from:',
          API_KEYWORD_LIST_URL
        );
        const response = await fetch(API_KEYWORD_LIST_URL, { method: 'GET' });
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[API Fetch] Failed to fetch keywords: ${response.status} - ${errorText}`
          );
          throw new Error(
            `Failed to fetch keywords: ${
              response.statusText || response.status
            }`
          );
        }
        const summaries = await response.json();

        if (!Array.isArray(summaries)) {
          console.error(
            '[API Fetch] Unexpected format from keyword list API:',
            summaries
          );
          throw new Error('Failed to fetch keywords: Invalid response format.');
        }
        setRealKeywordList(summaries);
        console.log(
          `[API Fetch] Successfully loaded ${summaries.length} keywords.`
        );
      } catch (error: any) {
        console.error(
          '[API Fetch] Error fetching keyword research list:',
          error
        );
        setListFetchError(error.message || 'Unknown error');
      } finally {
        setIsListLoading(false);
      }
    };
    loadKeywordsFromApi(); // Call the renamed function
  }, []); // Run only on mount
  // --- End Fetch Effect ---

  // --- Effect to reset cluster selection when keyword report changes ---
  useEffect(() => {
    setSelectedClusterName('__ALL_CLUSTERS__');
  }, [selectedKeywordReport]);
  // --- End Cluster Reset Effect ---

  // --- UPDATED: Effect to find and set the displayed Persona description ---
  useEffect(() => {
    if (
      selectedClusterName === '__ALL_CLUSTERS__' ||
      !selectedKeywordReport?.clustersWithVolume
    ) {
      setDisplayedPersona(null);
      return;
    }
    // Find the cluster with the matching name
    const foundCluster = selectedKeywordReport.clustersWithVolume.find(
      (c: any) => c.clusterName === selectedClusterName
    );
    // Set the persona description from the found cluster, or null if not found/no description
    setDisplayedPersona(foundCluster?.personaDescription || null);

    if (
      selectedClusterName !== '__ALL_CLUSTERS__' &&
      !foundCluster?.personaDescription
    ) {
      console.warn(
        `[UI Persona Sync] Persona description not found for selected cluster: ${selectedClusterName}`
      );
    }
  }, [selectedClusterName, selectedKeywordReport]);
  // --- End Persona Sync Effect ---

  // --- Moved useEffect for cluster/hasClusters logging BEFORE conditional return ---
  const hasClusters =
    selectedKeywordReport?.clustersWithVolume &&
    Array.isArray(selectedKeywordReport.clustersWithVolume) &&
    selectedKeywordReport.clustersWithVolume.length > 0;
  useEffect(() => {
    console.log(
      '[UI Debug] selectedKeywordReport updated:',
      selectedKeywordReport
    );
    console.log('[UI Debug] hasClusters calculated:', hasClusters);
  }, [selectedKeywordReport, hasClusters]);

  useEffect(() => {
    const key = `writing:stepsState:${keyword || 'default'}`;
    const storedSteps = localStorage.getItem(key);
    if (!generationAttempted || !storedSteps) {
      setSteps(initialSteps);
    }
  }, [keyword]);

  if (!isMounted) {
    return null; // Render nothing until mounted
  }

  const handleCopyToClipboard = async () => {
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt);
        setCopied(true);
        toast.success('Prompt copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy prompt.');
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
      // Re-throw the error to be caught by handleSubmit
      throw error;
    }
  };

  // --- NEW API Call Helpers for Steps 1-7 ---

  // 1. Fetch SERP (Now returns minimal data)
  const callFetchSerpApi = async (
    keyword: string,
    mediaSiteName: string
  ): Promise<{ id: string; originalKeyword: string }> => {
    return await callApi<{ id: string; originalKeyword: string }>(
      STEP_ID_FETCH_SERP,
      API_STEP1_FETCH_SERP_URL,
      { keyword, mediaSiteName }
    );
  };

  // 2. Analyze Content Type (Now only needs serpId)
  const callAnalyzeContentTypeApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_CONTENT_TYPE,
      API_STEP2_ANALYZE_CONTENT_TYPE_URL,
      { serpDocId }
    );
  };

  // 3. Analyze User Intent (Now only needs serpId)
  const callAnalyzeUserIntentApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_USER_INTENT,
      API_STEP3_ANALYZE_USER_INTENT_URL,
      { serpDocId }
    );
  };

  // 4. Analyze Title (Now only needs serpId)
  const callAnalyzeTitleApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_TITLE,
      API_STEP4_ANALYZE_TITLE_URL,
      { serpDocId }
    );
  };

  // 5. Analyze Better Have (Now only needs serpId)
  const callAnalyzeBetterHaveApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_BETTER_HAVE,
      API_STEP5_ANALYZE_BETTER_HAVE_URL,
      { serpDocId }
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
    contentMarketingSuggestion: string | null, // Assuming it might be null
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
        contentMarketingSuggestion: contentMarketingSuggestion || '', // Ensure default empty string if null
        fineTuneNames,
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
    const { region, language } = mediaSite;

    // Get outline template (ensure it defaults if null)
    const outlineTemplate =
      generatedOutlineText || '<!-- Default Outline/Template -->';

    console.log(
      `Submitting: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName}, FineTunes=${selectedFineTunes.join(
        ', '
      )}, TargetCluster=${
        selectedClusterName === '__ALL_CLUSTERS__' ? 'All' : selectedClusterName
      }`
    );

    try {
      // --- Execute Steps Sequentially ---

      let reportForStep6: any | null = selectedKeywordReport;
      let reportForStep7: any | null = selectedKeywordReport;

      // --- Filter Report Data if Cluster is Selected ---
      const currentSelectedCluster = selectedClusterName; // Read latest state here
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

      // Step 1: Fetch SERP Info (ID and Keyword)
      const serpInfo = await callFetchSerpApi(firstKeyword, mediaSiteName);
      if (!serpInfo || !serpInfo.id || !serpInfo.originalKeyword) {
        console.error(
          '[handleSubmit] Missing critical SERP info after Step 1:',
          serpInfo
        );
        throw new Error(
          'Failed to fetch or validate initial SERP info (missing ID or keyword).'
        );
      }
      const serpId = serpInfo.id;
      const serpKeyword = serpInfo.originalKeyword;

      // Steps 2-5: Call analysis APIs using only the serpId
      const contentTypeResult = await callAnalyzeContentTypeApi(serpId);
      const userIntentResult = await callAnalyzeUserIntentApi(serpId);
      const titleResult = await callAnalyzeTitleApi(serpId);
      const betterHaveResult = await callAnalyzeBetterHaveApi(serpId);

      // --- !! NEW: Fetch Updated SERP Data After Analysis !! ---
      updateStepStatus('fetch-updated-serp', 'loading'); // Add a temporary step for UI if needed
      console.log(
        `[handleSubmit] Fetching updated SERP data using ID: ${serpId}`
      );
      const updatedSerpData = await getSerpDataAction(serpId);
      if (!updatedSerpData) {
        updateStepStatus('fetch-updated-serp', 'error');
        console.error(
          `[handleSubmit] Failed to fetch updated SERP data for ID: ${serpId}`
        );
        throw new Error('Failed to retrieve updated SERP data after analysis.');
      }
      updateStepStatus('fetch-updated-serp', 'completed');
      console.log(`[handleSubmit] Successfully fetched updated SERP data.`);
      // --- End Fetch Updated SERP Data ---

      // Step 6: Generate Action Plan (Use data from updatedSerpData)
      const actionPlanResult = await callGenerateActionPlanApi(
        serpKeyword, // Use keyword obtained from step 1
        mediaSiteName,
        updatedSerpData.contentTypeRecommendationText ?? '', // <-- Use fetched data
        updatedSerpData.userIntentRecommendationText ?? '', // <-- Use fetched data
        updatedSerpData.titleRecommendationText ?? '', // <-- Use fetched top-level recommendation text
        updatedSerpData.betterHaveRecommendationText ?? '', // <-- Use fetched data
        reportForStep6,
        currentSelectedCluster === '__ALL_CLUSTERS__' ? null : currentSelectedCluster // Corrected ternary again
      );

      // Step 7: Generate Final Prompt (Use data from updatedSerpData)
      const finalPromptResult = await callGenerateFinalPromptApi(
        serpKeyword, // Use keyword obtained from step 1
        actionPlanResult.actionPlanText,
        mediaSiteName,
        updatedSerpData.contentTypeRecommendationText ?? '', // <-- Use fetched data
        updatedSerpData.userIntentRecommendationText ?? '', // <-- Use fetched data
        updatedSerpData.betterHaveRecommendationText ?? null, // <-- Use fetched data
        reportForStep7,
        currentSelectedCluster === '__ALL_CLUSTERS__'
          ? null
          : currentSelectedCluster,
        generatedOutlineText || '<!-- Default Outline -->',
        null, // contentMarketingSuggestion
        selectedFineTunes,
      );

      // --- Process Complete ---
      setResearchPrompt(finalPromptResult.finalPrompt);
      console.log('[UI] Process Complete. Final Research Prompt Generated.');
    } catch (err) {
      console.error('[UI Debug] Error caught in handleSubmit:', err);
      if (!error) {
        // Avoid overwriting specific API errors
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

  // Add handler for starting over to pass to ResultDisplay
  const handleStartOver = () => {
    setResearchPrompt(null);
    setMediaSiteName('');
    setSelectedFineTunes([]);
    setSelectedKeywordReport(null);
    setSteps(initialSteps);
    setGenerationAttempted(false);
    // Optionally reset keyword and outline
    // setKeyword("");
    // setGeneratedOutlineText(null);
  };

  // Add logging for final state before render
  console.log(
    `[UI Render State] isLoading=${isLoading}, hasResearchPrompt=${!!researchPrompt}, currentStep=${
      steps.find(step => step.status === 'loading')?.name
    }`
  );

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
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                  INPUT_PARAMETERS
                </span>
              </div>
              {/* Right side controls */}
              <div className="flex items-center gap-4">
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
                <RevalidateButton size="sm" variant="ghost" />
              </div>
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keyword Input Section */}
                <div className="space-y-2">
                  <Label
                    htmlFor="keyword-combobox"
                    className="text-base font-medium"
                  >
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
                            {!isMounted || !keyword
                              ? 'Select or type keyword...'
                              : keyword}
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
                            className="h-11"
                          />
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
                            {!isListLoading &&
                              !listFetchError &&
                              realKeywordList.length === 0 && (
                                <CommandEmpty>
                                  No keyword research found.
                                </CommandEmpty>
                              )}
                            {/* Real Data */}
                            {!isListLoading &&
                              !listFetchError &&
                              realKeywordList.length > 0 && (
                                <CommandGroup>
                                  {realKeywordList.map(item => (
                                    <CommandItem
                                      key={item.id}
                                      value={item.query} // Use query for value
                                      onSelect={async (
                                        currentValue: string
                                      ) => {
                                        const selectedItem =
                                          realKeywordList.find(
                                            i =>
                                              i.query.toLowerCase() ===
                                              currentValue.toLowerCase()
                                          );
                                        if (!selectedItem) return;

                                        const selectedQuery =
                                          selectedItem.query;
                                        setKeyword(selectedQuery);
                                        setComboboxOpen(false);
                                        setSelectedKeywordReport(null); // Clear previous report immediately
                                        setIsDetailLoading(true);

                                        // --- UPDATED: Fetch and set the detailed keyword report using SERVER ACTION ---
                                        try {
                                          console.log(
                                            `[UI] Calling Server Action for Keyword ID: ${selectedItem.id}`
                                          );
                                          // Call the Server Action directly
                                          const detailResult =
                                            await submitGetKeywordVolumeObj({
                                              researchId: selectedItem.id
                                            });

                                          if (!detailResult) {
                                            console.warn(
                                              `[UI] No details returned for ID: ${selectedItem.id}`
                                            );
                                            setSelectedKeywordReport(null); // Ensure it's null if fetch fails/returns null
                                            toast.error(
                                              'Could not fetch keyword details.'
                                            );
                                          } else {
                                            setSelectedKeywordReport(
                                              detailResult as KeywordVolumeObject
                                            );
                                            console.log(
                                              `[UI] Details fetched successfully for ID: ${selectedItem.id}`
                                            );
                                          }
                                        } catch (error) {
                                          console.error(
                                            `[UI] Error fetching keyword details for ID ${selectedItem.id}:`,
                                            error
                                          );
                                          setSelectedKeywordReport(null); // Clear report on error
                                          toast.error(
                                            error instanceof Error
                                              ? `Error fetching details: ${error.message}`
                                              : 'An unknown error occurred while fetching details.'
                                          );
                                        } finally {
                                          setIsDetailLoading(false); // Stop loading indicator
                                          console.log(
                                            '[UI] Detail fetching attempt complete.'
                                          );
                                        }
                                        // ----- End Fetch ---
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          keyword.toLowerCase() ===
                                            item.query.toLowerCase()
                                            ? 'opacity-100'
                                            : 'opacity-0'
                                        )}
                                      />
                                      {item.query}
                                      {typeof item.totalVolume === 'number' && (
                                        <span className="ml-auto text-xs text-muted-foreground">
                                          Vol:{' '}
                                          {item.totalVolume.toLocaleString()}
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
                          'flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full',
                          'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700',
                          (isLoading || isDetailLoading) &&
                            'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TerminalSquare className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </Button>
                      {/* Media Site Button */}
                      {!showMediaSiteOptions &&
                        (isMounted && mediaSiteName ? (
                          (() => {
                            const site = MEDIASITE_DATA.find(
                              s => s.name === mediaSiteName
                            );
                            let hostname = '';
                            try {
                              hostname = new URL(site?.url || '.').hostname;
                            } catch (e) {
                              /* ignore */
                            }
                            const faviconUrl =
                              hostname && hostname !== '.'
                                ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                                : null;
                            return (
                              <Button
                                type="button"
                                onClick={() => setShowMediaSiteOptions(true)}
                                disabled={isLoading || isDetailLoading}
                                title={`Selected: ${mediaSiteName}`}
                                className={cn(
                                  'flex items-center gap-1.5 px-2 text-xs font-mono transition-colors border h-full',
                                  'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700'
                                )}
                              >
                                {faviconUrl && (
                                  <Image
                                    src={faviconUrl}
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 flex-shrink-0"
                                    unoptimized
                                  />
                                )}
                                <span className="truncate max-w-[80px]">
                                  {mediaSiteName}
                                </span>
                              </Button>
                            );
                          })()
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setShowMediaSiteOptions(true)}
                            disabled={isLoading || isDetailLoading}
                            className={cn(
                              'flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full',
                              'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-gray-400 dark:border-neutral-700 dark:hover:bg-neutral-800'
                            )}
                          >
                            [Select Site...]
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>

                {/* --- Cluster Selection Dropdown (Render if clusters exist) --- */}
                {isMounted && hasClusters && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="cluster-select"
                      className="text-base font-medium"
                    >
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
                        <SelectItem value="__ALL_CLUSTERS__">
                          All Clusters (No Specific Persona)
                        </SelectItem>
                        {/* Map over clustersWithVolume */}
                        {selectedKeywordReport?.clustersWithVolume?.map(
                          (cluster: any, index: number) => (
                            <SelectItem
                              key={cluster.clusterName || `cluster-${index}`}
                              value={
                                cluster.clusterName || `Cluster ${index + 1}`
                              }
                            >
                              {cluster.clusterName || `Cluster ${index + 1}`}{' '}
                              (Vol:{' '}
                              {cluster.totalVolume?.toLocaleString() ?? 'N/A'})
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    {/* --- Display Area for Associated Persona --- */}
                    {selectedClusterName !== '__ALL_CLUSTERS__' && (
                      <div className="mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-900/10 text-sm text-indigo-800 dark:text-indigo-200">
                        {displayedPersona ? (
                          <>
                            <p className="font-medium mb-1">
                              Targeting Persona: {selectedClusterName}
                            </p>
                            <p className="text-xs opacity-80 line-clamp-3">
                              {displayedPersona}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs opacity-70 italic">
                            (Persona description not found or not yet generated
                            for this cluster)
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
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        SELECT_MEDIA_SITE:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {MEDIASITE_DATA.map(site => {
                          let hostname = '';
                          try {
                            hostname = new URL(site.url).hostname;
                          } catch (e) {
                            /* Ignore invalid URLs */
                          }
                          const faviconUrl = hostname
                            ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                            : null;
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
                                'flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors border',
                                'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900'
                              )}
                            >
                              {faviconUrl && (
                                <Image
                                  src={faviconUrl}
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 flex-shrink-0"
                                  unoptimized
                                />
                              )}
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
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        SELECT_FINE_TUNE_SETS (Experimental):
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {allFineTuneNames.map(name => (
                          <div
                            key={name}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`fine-tune-${name}`}
                              checked={selectedFineTunes.includes(name)}
                              onCheckedChange={checked =>
                                handleFineTuneChange(checked, name)
                              }
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
                        Selected sets will be appended to the final prompt for
                        the AI.
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress Checklist - Show if generation was attempted */}
                {generationAttempted && (
                  <ProgressChecklistDisplay steps={steps} />
                )}

                {/* Error Display - Show if error exists and not loading */}
                {!isLoading && (
                  <ErrorDisplay
                    error={error}
                    onDismiss={() => setError(null)}
                  />
                )}

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
  );
}
