'use client';

import { useSettingsStore } from '@/store/settings-store';
import { ArrowLeft, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

// Actions
import {
  fetchClusteringStatus,
  requestClustering,
  revalidateKeywordData,
  updateKeywordResearch
} from '@/app/actions';
import { generateUserPersonaFromClusters } from '@/app/actions/generate-persona';

// Internal Components
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { EmptyState } from './empty-state';
import KeywordClustering from './keyword-clustering';
import KeywordDistribute from './keyword-distribute';

import {
  UpdateKeywordResearchInput,
  type ClusteringStatus,
  type KeywordResearchItem,
  type UserPersona
} from '@/lib/schema';

// Import RefreshCw icon for the recluster button

// Import Tooltip components and Button
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

// Updated for Fixed Volume Ranges
interface VolumeDistributionStats {
  min: number; // Overall min volume (>= 0)
  max: number; // Overall max volume
  count: number; // Total count of keywords with volume >= 1
  countZero: number; // Count of keywords with volume 0
  countRange1: number; // Count in [1, 10]
  countRange2: number; // Count in [11, 1000]
  countRange3: number; // Count in [1001, 10000]
  countRange4: number; // Count in [10001, 100000]
  countRange5: number; // Count in >= 100001
}

interface KeywordResearchDetailProps {
  initialResearchDetail: KeywordResearchItem;
  researchId: string;
  volumeDistribution: VolumeDistributionStats; // Use the correct type imported above
}

export default function KeywordResearchDetail({
  initialResearchDetail,
  researchId,
  volumeDistribution // Destructure the correct prop type
}: KeywordResearchDetailProps) {
  const router = useRouter();
  const settingsState = useSettingsStore(store => store.state);

  // Local State
  const [isRequestingClustering, setIsRequestingClustering] = useState(false);
  const [isGeneratingPersonas, setIsGeneratingPersonas] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [view, setView] = useState<'volume' | 'cluster'>('volume');

  // State for current clustering status, initialize to null (or 'pending' if preferred)
  const [currentClusteringStatus, setCurrentClusteringStatus] =
    useState<ClusteringStatus | null>(null);

  // --- NEW Effect: Fetch initial status on mount ---
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchInitialStatus = async () => {
      if (!researchId) return; // Guard against missing ID
      try {
        console.log(
          `[KeywordResearchDetail] Fetching initial clustering status for ${researchId}...`
        );
        const status = await fetchClusteringStatus(researchId);
        if (isMounted) {
          console.log(
            `[KeywordResearchDetail] Initial status received: ${status}`
          );

          // --- Status Correction Logic (moved here) ---
          let finalStatus = status ?? null;
          // If clusters exist in the initially loaded detail, but the status isn't 'completed',
          // override the status to 'completed' for UI consistency.
          if (
            initialResearchDetail?.clusters &&
            Object.keys(initialResearchDetail.clusters).length > 0 &&
            finalStatus !== 'completed'
          ) {
            console.log(
              `[KeywordResearchDetail] Initial clusters found but status was ${finalStatus}. Correcting status to 'completed'.`
            );
            finalStatus = 'completed';
          }
          // --- End Status Correction ---

          setCurrentClusteringStatus(finalStatus);
        }
      } catch (error) {
        console.error(
          '[KeywordResearchDetail] Error fetching initial status:',
          error
        );
        if (isMounted) {
          // Optionally set an error state or default status
          setCurrentClusteringStatus(null); // Or 'failed'?
        }
      }
    };

    fetchInitialStatus();

    return () => {
      isMounted = false; // Cleanup: Set flag to false when unmounting
    };
  }, [researchId, initialResearchDetail?.clusters]); // Depend on researchId and initial clusters data

  // --- Polling Effect ---
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Only poll if the current status is 'processing' and we have an ID
    if (currentClusteringStatus === 'processing' && researchId) {
      console.log('[KeywordResearchDetail] Starting status polling interval.');
      intervalId = setInterval(async () => {
        try {
          console.log(
            '[KeywordResearchDetail] Polling for clustering status...'
          );
          const status = await fetchClusteringStatus(researchId);
          console.log(
            '[KeywordResearchDetail] Polling status received:',
            status
          );

          // If status changed from processing, update state and clear interval
          if (status !== 'processing') {
            console.log(
              '[KeywordResearchDetail] Clustering status changed. Stopping polling.'
            );
            setCurrentClusteringStatus(status ?? null);
            if (intervalId) clearInterval(intervalId);
            intervalId = null; // Ensure intervalId is nullified

            if (status === 'completed') {
              toast.success('分群處理完成 (Clustering completed)!');
              // Revalidate cache BEFORE refreshing
              try {
                console.log(
                  `[KeywordResearchDetail] Revalidating data after polling completion for ${researchId}...`
                );
                await revalidateKeywordData(researchId); // Call the server action
                console.log(
                  `[KeywordResearchDetail] Revalidation requested via action. Refreshing router...`
                );
              } catch (revalError) {
                console.error(
                  `[KeywordResearchDetail] Failed to request revalidation via action:`,
                  revalError
                );
                // Decide if you still want to refresh even if revalidation fails
              }
              router.refresh(); // Refresh after revalidation attempt
            } else if (status === 'failed') {
              toast.error('分群處理失敗 (Clustering failed).');
              // Optionally refresh on failure too?
              // router.refresh();
            }
          }
        } catch (error) {
          console.error(
            '[KeywordResearchDetail] Error during status polling:',
            error
          );
        }
      }, 5000); // Poll every 5 seconds (adjust as needed)
    }

    // Cleanup function: Clear interval on component unmount or if status changes away from 'processing'
    return () => {
      if (intervalId) {
        console.log(
          '[KeywordResearchDetail] Clearing polling interval on cleanup.'
        );
        clearInterval(intervalId);
      }
    };
  }, [currentClusteringStatus, researchId, router]); // Dependencies for the effect

  // --- Data Processing Memos ---

  // 1. Get Sorted Unique Keywords
  const sortedUniqueKeywords =
    useMemo((): KeywordResearchItem['keywords'] extends (infer K)[] | undefined
      ? K[]
      : never => {
      console.log(
        '[KeywordResearchDetail] Recalculating sortedUniqueKeywords...'
      );
      const uniqueKeywords = new Map<
        string,
        KeywordResearchItem['keywords'] extends (infer K)[] | undefined
          ? K
          : never
      >();
      (initialResearchDetail?.keywords || []).forEach(kw => {
        const keywordData = kw as KeywordResearchItem['keywords'] extends
          | (infer K)[]
          | undefined
          ? K
          : never;
        const text = keywordData.text?.trim().toLowerCase();
        if (text && !uniqueKeywords.has(text)) {
          uniqueKeywords.set(text, keywordData);
        }
      });
      const keywordsArray: KeywordResearchItem['keywords'] extends
        | (infer K)[]
        | undefined
        ? K[]
        : never[] = Array.from(uniqueKeywords.values());
      // Sort by volume descending
      keywordsArray.sort(
        (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0)
      );
      return keywordsArray;
    }, [initialResearchDetail?.keywords]);

  // 2. Memoize raw clusters from prop
  const currentClusters = useMemo(() => {
    console.log('[KeywordResearchDetail] Recalculating currentClusters...');
    return initialResearchDetail?.clusters || null;
  }, [initialResearchDetail]);

  // 3. Memoize raw personas from prop
  const currentPersonas = useMemo(() => {
    return initialResearchDetail?.personas || null;
  }, [initialResearchDetail]);

  // 4. Keyword Volume Map (for potential use later, uses deduplicated data)
  const keywordVolumeMap = useMemo(() => {
    const map: Record<string, number> = {};
    sortedUniqueKeywords.forEach(
      (
        item: KeywordResearchItem['keywords'] extends (infer K)[] | undefined
          ? K
          : never
      ) => {
        const keywordText = item.text?.trim().toLowerCase();
        const volume = item.searchVolume ?? 0;
        if (keywordText) {
          map[keywordText] = volume;
        }
      }
    );
    return map;
  }, [sortedUniqueKeywords]);

  // 5. Memoize personas map for clustering
  const personasMapForClustering = useMemo(() => {
    if (!currentPersonas || !Array.isArray(currentPersonas)) return null;
    return currentPersonas.reduce((acc, persona) => {
      acc[persona.name] = persona.description;
      return acc;
    }, {} as Record<string, string>);
  }, [currentPersonas]);

  // --- Clustering Logic (SIMPLIFIED: Calls Server Action) ---
  const handleRequestClustering = useCallback(async () => {
    console.log('[KeywordResearchDetail] handleRequestClustering called.');

    // Basic guards
    if (!researchId) {
      console.warn(
        '[KeywordResearchDetail] handleRequestClustering aborted: Missing researchId.'
      );
      setLocalError('Cannot start clustering: Missing research ID.');
      return;
    }
    if (currentClusteringStatus === 'processing') {
      console.warn(
        '[KeywordResearchDetail] handleRequestClustering aborted: Already processing.'
      );
      toast.info('分群已在處理中 (Clustering is already processing).');
      return;
    }

    console.log(
      '[KeywordResearchDetail] Setting isRequestingClustering = true'
    );
    setIsRequestingClustering(true);
    setLocalError(null);
    toast.info('請求開始分群... (Requesting clustering start...)');

    try {
      console.log(
        `[KeywordResearchDetail] Calling requestClustering server action for ${researchId}...`
      );
      // Call the new server action
      const result = await requestClustering(researchId);

      if (result.success) {
        console.log(
          '[KeywordResearchDetail] Server action requestClustering successful. Refreshing router...'
        );
        // Show success, the page refresh will show the 'processing' state
        toast.success(
          '已請求後端開始分群! 將開始檢查狀態。(Backend clustering requested! Will start checking status.)'
        );
        // **CRITICAL**: Update local status immediately to 'processing' to trigger polling
        setCurrentClusteringStatus('processing');
        // Switch view to cluster after requesting
        setView('cluster');
      } else {
        console.error(
          '[KeywordResearchDetail] Server action requestClustering failed:',
          result.error
        );
        // Show specific error from action or generic one
        toast.error(
          result.error || '請求分群失敗 (Failed to request clustering).'
        );
        setLocalError(result.error || '請求分群失敗.');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown clustering request error';
      console.error(
        '[KeywordResearchDetail] Error calling requestClustering server action:',
        message,
        error
      );
      toast.error(`請求分群時發生錯誤: ${message}`);
      setLocalError(`請求分群時發生錯誤: ${message}`);
    } finally {
      console.log(
        '[KeywordResearchDetail] Setting isRequestingClustering = false'
      );
      setIsRequestingClustering(false);
    }
  }, [researchId, router, currentClusteringStatus]); // Added currentClusteringStatus dependency

  // --- Persona Generation Logic (remains largely the same) ---
  const handleSavePersona = useCallback(
    async (clusterName: string, keywords: string[]) => {
      console.log(
        `[KeywordResearchDetail] handleSavePersona called for cluster: ${clusterName}`
      );
      if (!researchId || !clusterName || keywords.length === 0) {
        toast.error('Cannot generate persona: Missing required data.');
        return;
      }
      setIsSavingPersona(clusterName);
      setLocalError(null);
      try {
        toast.info(`Generating persona for "${clusterName}"...`);
        const personaResult = await generateUserPersonaFromClusters({
          clusterName,
          keywords,
          model: settingsState.personaModel || 'gpt-4o-mini'
        });
        const personaText = personaResult.userPersona;

        const existingPersonas = currentPersonas || [];
        const personaIndex = existingPersonas.findIndex(
          p => p.name === clusterName
        );

        let updatedPersonas: UserPersona[];

        if (personaIndex > -1) {
          // Update existing persona description
          updatedPersonas = existingPersonas.map((p, index) =>
            index === personaIndex ? { ...p, description: personaText } : p
          );
        } else {
          // Add new persona object
          const newPersona: UserPersona = {
            name: clusterName,
            description: personaText,
            keywords: keywords,
            characteristics: [],
            interests: [],
            painPoints: [],
            goals: []
          };
          updatedPersonas = [...existingPersonas, newPersona];
        }

        toast.info(`Saving persona for "${clusterName}"...`);
        const updateInput: UpdateKeywordResearchInput = {
          personas: updatedPersonas,
          updatedAt: new Date()
        };
        const updateResult = await updateKeywordResearch(
          researchId,
          updateInput
        );

        if (updateResult.success) {
          toast.success(`Persona for "${clusterName}" saved successfully!`);
          // Revalidate cache BEFORE refreshing
          try {
            console.log(
              `[KeywordResearchDetail] Revalidating data after persona save for ${researchId}...`
            );
            await revalidateKeywordData(researchId); // Call the server action
            console.log(
              `[KeywordResearchDetail] Revalidation requested via action. Refreshing router...`
            );
          } catch (revalError) {
            console.error(
              `[KeywordResearchDetail] Failed to request revalidation via action:`,
              revalError
            );
            // Decide if you still want to refresh even if revalidation fails
          }
          router.refresh(); // Refresh after revalidation attempt
        } else {
          throw new Error(
            updateResult.error || 'Failed to save the generated persona.'
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown error generating/saving persona';
        toast.error(`Failed for cluster "${clusterName}": ${message}`);
        setLocalError(`Failed to generate/save persona for "${clusterName}".`);
      } finally {
        setIsSavingPersona(null);
      }
    },
    [researchId, currentPersonas, router, settingsState.personaModel]
  );

  const handleGenerateAllPersonas = useCallback(async () => {
    console.log('[KeywordResearchDetail] handleGenerateAllPersonas called.');
    if (
      !researchId ||
      !currentClusters ||
      Object.keys(currentClusters).length === 0
    ) {
      toast.error('Cannot generate personas: No clusters available.');
      return;
    }
    setIsGeneratingPersonas(true);
    setLocalError(null);
    const clusterEntries = Object.entries(currentClusters);
    const generatedPersonas: Record<string, string> = (
      currentPersonas || []
    ).reduce(
      (acc, persona) => {
        acc[persona.name] = persona.description; // Map name to description
        return acc;
      },
      {} as Record<string, string> // Initialize accumulator as the target type
    );
    let errorsEncountered = 0;
    const personaPromises = clusterEntries.map(
      async ([clusterName, keywords]) => {
        if (!clusterName || !keywords || keywords.length === 0) return;
        if (generatedPersonas[clusterName]) return;
        try {
          const personaResult = await generateUserPersonaFromClusters({
            clusterName,
            keywords,
            model: settingsState.personaModel || 'gpt-4o-mini'
          });
          generatedPersonas[clusterName] = personaResult.userPersona;
        } catch (error) {
          errorsEncountered++;
          toast.error(
            `Persona generation failed for cluster "${clusterName}": ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }
    );
    await Promise.allSettled(personaPromises);
    if (
      Object.keys(generatedPersonas).length >
      Object.keys(currentPersonas || {}).length
    ) {
      try {
        const updateInput: UpdateKeywordResearchInput = {
          personas: Object.entries(generatedPersonas).map(
            ([name, description]): UserPersona => ({
              name,
              description,
              keywords: currentClusters?.[name] || [],
              characteristics: [],
              interests: [],
              painPoints: [],
              goals: []
            })
          ),
          updatedAt: new Date()
        };
        const updateResult = await updateKeywordResearch(
          researchId,
          updateInput
        );
        if (updateResult.success) {
          if (errorsEncountered === 0)
            toast.success('All new user personas generated successfully!');
          else
            toast.warning(
              `Generated personas for ${
                clusterEntries.length - errorsEncountered
              } out of ${clusterEntries.length} clusters.`
            );
          router.refresh();
        } else {
          throw new Error(updateResult.error || 'Failed to save personas.');
        }
      } catch (saveError) {
        toast.error(
          `Failed to save updated personas: ${
            saveError instanceof Error ? saveError.message : 'Unknown error'
          }`
        );
        setLocalError(`Failed to save updated personas.`);
      }
    } else {
      toast.info('No new personas were generated.');
    }
    setIsGeneratingPersonas(false);
  }, [
    researchId,
    currentClusters,
    currentPersonas,
    router,
    settingsState.personaModel
  ]);

  // --- RENDER LOGIC ---

  if (localError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-[calc(100vh-150px)]">
          <EmptyState
            title="無法加載數據"
            description="提供的研究數據無效或不完整。"
          />
        </div>
      </div>
    );
  }

  if (!initialResearchDetail || !initialResearchDetail.query) {
    console.warn(
      '[Render] Missing essential initial data.',
      initialResearchDetail
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-[calc(100vh-150px)]">
          <EmptyState
            title="無法加載數據"
            description="提供的研究數據無效或不完整。"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Conditional Rendering based on 'view' state */}

        {view === 'volume' && (
          <div className="space-y-4">
            {/* Title for Volume section */}
            <h2 className="text-xl font-semibold">搜索量分佈</h2>
            <KeywordDistribute keywords={sortedUniqueKeywords} />
            {/* Button to switch to cluster view */}
            <div className="flex justify-center mt-6">
              <Button onClick={() => setView('cluster')} variant="outline">
                查看關鍵詞分群
              </Button>
            </div>
          </div>
        )}

        {view === 'cluster' && (
          <div className="space-y-4">
            {/* Button to switch back to volume view */}
            <div className="mb-4">
              <Button
                onClick={() => setView('volume')}
                variant="ghost"
                size="sm"
                className="text-sm text-muted-foreground"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回搜索量分佈
              </Button>
            </div>

            {/* Title for Cluster section */}
            <h2 className="text-xl font-semibold">關鍵詞分群</h2>

            {/* --- Status Display & Re-cluster button (moved inside cluster view) --- */}
            <div className="mb-4 p-4 border rounded-lg bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-grow">
                <p className="text-sm font-medium">分群狀態:</p>
                <p
                  className={`text-lg font-semibold ${getStatusColor(
                    currentClusteringStatus
                  )}`}
                >
                  {getStatusText(currentClusteringStatus)}
                </p>
                {currentClusteringStatus === 'failed' && (
                  <p className="text-xs text-destructive mt-1">
                    處理失敗，請重試。
                  </p>
                )}
                {currentClusteringStatus === 'processing' && (
                  <div className="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>正在處理中...</span>
                  </div>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <LoadingButton
                      onClick={handleRequestClustering}
                      isLoading={
                        isRequestingClustering ||
                        currentClusteringStatus === 'processing'
                      }
                      loadingText="處理中..."
                      disabled={
                        !researchId || currentClusteringStatus === 'processing'
                      }
                      className="flex-shrink-0 mt-2 sm:mt-0"
                      variant={
                        currentClusteringStatus === 'completed'
                          ? 'outline'
                          : 'default'
                      }
                      size="sm" // Make button smaller
                    >
                      <RefreshCw className="mr-1 h-4 w-4" />
                      {currentClusteringStatus === 'completed'
                        ? '重新分群'
                        : '開始分群'}
                    </LoadingButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {currentClusteringStatus === 'completed'
                        ? '重新運行分群分析'
                        : '開始分群分析'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* --- End Status Display --- */}

            {/* Check if clusters exist OR if clustering is currently processing */}
            {(currentClusters && Object.keys(currentClusters).length > 0) ||
            currentClusteringStatus === 'processing' ? (
              <>
                <KeywordClustering
                  clusters={currentClusters}
                  personasMap={personasMapForClustering}
                  keywordVolumeMap={keywordVolumeMap}
                  onSavePersona={handleSavePersona}
                  isSavingPersona={isSavingPersona}
                  researchId={researchId}
                  clusteringStatus={currentClusteringStatus}
                  researchRegion={initialResearchDetail.region || ''}
                  researchLanguage={initialResearchDetail.language || ''}
                  currentKeywords={sortedUniqueKeywords
                    .map(k => k.text || '')
                    .filter(Boolean)}
                  selectedResearchDetail={{
                    query: initialResearchDetail.query
                  }}
                />
              </>
            ) : (
              // Show Empty state if no clusters and not currently processing.
              <EmptyState
                title={
                  currentClusteringStatus === 'failed'
                    ? '分群處理失敗'
                    : '尚未進行分群'
                }
                description={
                  currentClusteringStatus === 'failed'
                    ? '分群過程中發生錯誤，請點擊按鈕重試。'
                    : "點擊上方的 '開始分群' 按鈕來將您的關鍵詞分組。"
                }
                icon={<FileText className="h-12 w-12 text-muted-foreground" />}
              />
            )}
          </div>
        )}

        {/* Display local errors if any */}
        {localError && view !== 'cluster' && (
          <div className="mt-4 text-center text-sm text-red-500">
            {localError}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to get status text
function getStatusText(status: ClusteringStatus | null): string {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'processing':
      return '處理中...';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失敗';
    default:
      return '未開始'; // Or 'Idle' or '-'
  }
}

// Helper function to get status color (Tailwind classes)
function getStatusColor(status: ClusteringStatus | null): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'processing':
      return 'text-blue-600 dark:text-blue-400';
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'failed':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-muted-foreground';
  }
}
