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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    console.log('[KeywordResearchDetail] Recalculating currentPersonas...');
    // Default to an empty array if personas are null/undefined
    return (initialResearchDetail?.personas || []) as UserPersona[];
  }, [initialResearchDetail]);

  // 4. Create a map for quick persona lookup by cluster name
  const personasMapForClustering = useMemo(() => {
    console.log('[KeywordResearchDetail] Recalculating personasMapForClustering...');
    const map: Record<string, string> = {};
    // Iterate over the array of personas
    if (Array.isArray(currentPersonas)) {
      currentPersonas.forEach((persona: UserPersona) => {
        // Store the description string instead of the full object
        if (persona && persona.name && persona.description) {
          map[persona.name] = persona.description;
        } else {
          console.warn(
            '[KeywordResearchDetail] Persona object missing name or description:',
            persona
          );
        }
      });
    }
    return map;
  }, [currentPersonas]);

  // 5. Create Keyword Volume Map for quick lookup
  const keywordVolumeMap = useMemo(() => {
    console.log('[KeywordResearchDetail] Recalculating keywordVolumeMap...');
    const map = new Map<string, number>();
    sortedUniqueKeywords.forEach(kw => {
      if (kw.text) {
        map.set(kw.text.toLowerCase(), kw.searchVolume ?? 0);
      }
    });
    return map;
  }, [sortedUniqueKeywords]);

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

        {/* Always show Volume Distribution */}
        <KeywordDistribute
          keywords={sortedUniqueKeywords}
        />

        {/* --- Integrated Clustering Section --- */}

        {/* Render the Clustering Card ONLY when completed and clusters exist */} 
        {currentClusteringStatus === 'completed' &&
          currentClusters &&
          Object.keys(currentClusters).length > 0 && (
            <div className="mt-6 w-full">
              {/* {(() => {
                const clusterCount = Object.keys(currentClusters).length;
                const keywordCountInClusters = Object.values(currentClusters).reduce(
                  (sum, keywords) => sum + keywords.length,
                  0
                );
                return (
                  <h2 className="text-xl font-semibold mb-4">
                    關鍵詞 "{initialResearchDetail.query}" 的分群結果共 {clusterCount} 個分群，包含 {keywordCountInClusters} 個關鍵詞
                  </h2>
                );
              })()} */}

              <KeywordClustering
                clusters={currentClusters}
                personasMap={personasMapForClustering}
                keywordVolumeMap={Object.fromEntries(keywordVolumeMap.entries())}
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
                  query: initialResearchDetail.query,
                }}
              />
            </div>
          )}

        {/* Render the standalone button when table is not ready */} 
        {!(currentClusteringStatus === 'completed' &&
          currentClusters &&
          Object.keys(currentClusters).length > 0) && (
            <div className="mt-6 flex flex-col items-center"> 
              {/* Optional: Show specific messages based on status */} 
              {currentClusteringStatus === 'failed' && (
                <p className="mb-2 text-sm text-destructive">
                  分群處理失敗。(Clustering failed.)
                </p>
              )}
              {currentClusteringStatus === 'completed' &&
                (!currentClusters || Object.keys(currentClusters).length === 0) && (
                <p className="mb-2 text-sm text-muted-foreground">
                  分群完成，但未找到有效分群。(No valid clusters found.)
                </p>
              )}

              <LoadingButton
                onClick={handleRequestClustering}
                // Show loading if explicitly requesting OR if status is processing
                isLoading={isRequestingClustering || currentClusteringStatus === 'processing'}
                disabled={isRequestingClustering || currentClusteringStatus === 'processing'}
                variant="outline" // Use outline style for less emphasis
              >
                {
                // Determine button text
                (currentClusteringStatus === 'failed' ||
                  (currentClusteringStatus === 'completed' &&
                    (!currentClusters || Object.keys(currentClusters).length === 0)))
                  ? '重試分群 (Retry Clustering)' 
                  : '查看關鍵字分群 (View Keyword Clusters)' 
                }
              </LoadingButton>

              {/* Display specific error only when failed */}
              {currentClusteringStatus === 'failed' && localError && (
                <p className="mt-2 text-sm text-destructive">{localError}</p>
              )}
            </div>
        )}

        {/* Display local errors if any */}
        {localError && (
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
