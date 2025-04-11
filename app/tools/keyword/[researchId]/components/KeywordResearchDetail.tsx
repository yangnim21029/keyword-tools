'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ToolHeader } from '../../ToolHeader';

// Shadcn UI Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Actions
import {
  requestClustering,
  updateKeywordResearchPersonas,
  fetchClusteringStatus,
  revalidateKeywordData
} from '@/app/actions';
import { generateUserPersonaFromClusters } from '@/app/actions/generatePersona';

// Internal Components
import { LoadingButton } from '@/components/ui/LoadingButton';
import { EmptyState } from '../../EmptyState';
import KeywordClustering from '../../KeywordClustering';
import KeywordDistribute from './KeywordDistribute';

// Types
import {
  Keyword,
  type KeywordResearchItem,
  UpdatePersonasInput
} from '@/app/types';

// Import RefreshCw icon for the recluster button

// Import Tooltip components and Button
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

// Define the expected prop type (matching the one calculated in page.tsx)
// Updated for Fixed Volume Ranges
interface VolumeDistributionData {
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

// Type for clustering status (can be extended)
type ClusteringStatus = 'pending' | 'processing' | 'completed' | 'failed' | null;

interface KeywordResearchDetailProps {
  initialResearchDetail: KeywordResearchItem;
  researchId: string;
  volumeDistribution: VolumeDistributionData; // Use the updated interface
}

export default function KeywordResearchDetail({
  initialResearchDetail,
  researchId,
  volumeDistribution // Destructure the new prop
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
  const [currentClusteringStatus, setCurrentClusteringStatus] = useState<ClusteringStatus>(null);

  // --- NEW Effect: Fetch initial status on mount --- 
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchInitialStatus = async () => {
      if (!researchId) return; // Guard against missing ID
      try {
        console.log(`[KeywordResearchDetail] Fetching initial clustering status for ${researchId}...`);
        const status = await fetchClusteringStatus(researchId);
        if (isMounted) {
          console.log(`[KeywordResearchDetail] Initial status received: ${status}`);

          // --- Status Correction Logic (moved here) ---
          let finalStatus = status ?? null;
          // If clusters exist in the initially loaded detail, but the status isn't 'completed',
          // override the status to 'completed' for UI consistency.
          if (initialResearchDetail?.clusters && Object.keys(initialResearchDetail.clusters).length > 0 && finalStatus !== 'completed') {
            console.log(`[KeywordResearchDetail] Initial clusters found but status was ${finalStatus}. Correcting status to 'completed'.`);
            finalStatus = 'completed';
          }
          // --- End Status Correction ---

          setCurrentClusteringStatus(finalStatus);
        }
      } catch (error) {
        console.error('[KeywordResearchDetail] Error fetching initial status:', error);
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
          console.log('[KeywordResearchDetail] Polling for clustering status...');
          const status = await fetchClusteringStatus(researchId); 
          console.log('[KeywordResearchDetail] Polling status received:', status);
          
          // If status changed from processing, update state and clear interval
          if (status !== 'processing') {
            console.log('[KeywordResearchDetail] Clustering status changed. Stopping polling.');
            setCurrentClusteringStatus(status ?? null);
            if (intervalId) clearInterval(intervalId); 
            intervalId = null; // Ensure intervalId is nullified

            if (status === 'completed') {
                toast.success('分群處理完成 (Clustering completed)!');
                // Revalidate cache BEFORE refreshing
                try {
                   console.log(`[KeywordResearchDetail] Revalidating data after polling completion for ${researchId}...`);
                   await revalidateKeywordData(researchId); // Call the server action
                   console.log(`[KeywordResearchDetail] Revalidation requested via action. Refreshing router...`);
                } catch (revalError) {
                   console.error(`[KeywordResearchDetail] Failed to request revalidation via action:`, revalError);
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
          console.error('[KeywordResearchDetail] Error during status polling:', error);
          // Optional: Decide if polling should stop on error
          // setCurrentClusteringStatus('failed'); // Example: Set to failed
          // if (intervalId) clearInterval(intervalId);
          // intervalId = null;
        }
      }, 5000); // Poll every 5 seconds (adjust as needed)
    }

    // Cleanup function: Clear interval on component unmount or if status changes away from 'processing'
    return () => {
      if (intervalId) {
        console.log('[KeywordResearchDetail] Clearing polling interval on cleanup.');
        clearInterval(intervalId);
      }
    };
  }, [currentClusteringStatus, researchId, router]); // Dependencies for the effect

  // --- Data Processing Memos ---

  // 1. Get Sorted Unique Keywords
  const sortedUniqueKeywords = useMemo((): Keyword[] => {
    console.log(
      '[KeywordResearchDetail] Recalculating sortedUniqueKeywords...'
    );
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
    sortedUniqueKeywords.forEach(item => {
      const keywordText = item.text?.trim().toLowerCase();
      const volume = item.searchVolume ?? 0;
      if (keywordText) {
        map[keywordText] = volume;
      }
    });
    return map;
  }, [sortedUniqueKeywords]);

  // --- Clustering Logic (SIMPLIFIED: Calls Server Action) ---
  const handleRequestClustering = useCallback(async () => {
    console.log(
      '[KeywordResearchDetail] handleRequestClustering called.'
    );

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
        toast.info('分群已在處理中 (Clustering is already processing).')
        return;
    }

    console.log('[KeywordResearchDetail] Setting isRequestingClustering = true');
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
        toast.success('已請求後端開始分群! 將開始檢查狀態。(Backend clustering requested! Will start checking status.)');
        // **CRITICAL**: Update local status immediately to 'processing' to trigger polling
        setCurrentClusteringStatus('processing'); 
      } else {
        console.error(
          '[KeywordResearchDetail] Server action requestClustering failed:',
          result.error
        );
        // Show specific error from action or generic one
        toast.error(result.error || '請求分群失敗 (Failed to request clustering).');
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
      console.log('[KeywordResearchDetail] Setting isRequestingClustering = false');
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

        const updatedPersonas = {
          ...(currentPersonas || {}),
          [clusterName]: personaText
        };

        toast.info(`Saving persona for "${clusterName}"...`);
        const updateInput: UpdatePersonasInput = {
          personas: updatedPersonas,
          updatedAt: new Date()
        };
        const updateResult = await updateKeywordResearchPersonas(
          researchId,
          updateInput
        );

        if (updateResult.success) {
          toast.success(`Persona for "${clusterName}" saved successfully!`);
          // Revalidate cache BEFORE refreshing
          try {
             console.log(`[KeywordResearchDetail] Revalidating data after persona save for ${researchId}...`);
             await revalidateKeywordData(researchId); // Call the server action
             console.log(`[KeywordResearchDetail] Revalidation requested via action. Refreshing router...`);
          } catch (revalError) {
             console.error(`[KeywordResearchDetail] Failed to request revalidation via action:`, revalError);
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
    const generatedPersonas: Record<string, string> = {
      ...(currentPersonas || {})
    };
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
        const updateInput: UpdatePersonasInput = {
          personas: generatedPersonas,
          updatedAt: new Date()
        };
        const updateResult = await updateKeywordResearchPersonas(
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
        <ToolHeader
          title="關鍵詞分析結果"
          description={
            initialResearchDetail?.query
              ? `關鍵詞 "${initialResearchDetail.query}" 分析過程中發生錯誤`
              : '處理請求時發生錯誤'
          }
          region={settingsState.region}
          language={settingsState.language}
          icon={<FileText className="h-5 w-5 text-blue-500" />}
        />
        <div className="flex items-center justify-center h-[50vh] text-center">
          <div className="p-6 border border-destructive/50 bg-destructive/10 rounded-lg max-w-md">
            <h3 className="text-xl font-semibold text-destructive mb-2">
              發生錯誤
            </h3>
            <p className="text-destructive/90">{localError}</p>
          </div>
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

  // Determine if clusters exist for enabling the tab
  const hasClusters = !!(
    currentClusters && Object.keys(currentClusters).length > 0
  );

  // Helper function for formatting volume numbers (kept here)
  const formatVolume = (volume: number): string => {
    if (volume >= 10000) return `${(volume / 1000).toFixed(0)}k`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
    return volume.toLocaleString();
  };

  return (
    <div className="flex h-full flex-col">
      <ToolHeader
        title={`Keyword Analysis: "${initialResearchDetail.query || 'N/A'}"`}
        description={"Analysis results showing keyword volume distribution and clusters."}
      />

      <Tabs defaultValue={view} onValueChange={(value) => setView(value as 'volume' | 'cluster')} className="flex-grow p-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="volume">Volume Distribution</TabsTrigger>
          <TabsTrigger value="cluster">Keyword Clustering</TabsTrigger>
        </TabsList>

        {/* Volume Tab Content */}
        <TabsContent value="volume" className="mt-4">
          <KeywordDistribute
            keywords={sortedUniqueKeywords}
            volumeDistribution={volumeDistribution}
          />
        </TabsContent>

        {/* Cluster Tab Content */}
        <TabsContent value="cluster" className="mt-4">
           {/* --- Status Display --- */}
          {currentClusteringStatus === 'processing' && (
            <div className="mb-4 flex items-center justify-center rounded-md border border-dashed border-yellow-500 bg-yellow-50 p-4 text-sm text-yellow-700">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>後端正在處理分群，請稍後... (Backend clustering in progress...)</span>
            </div>
          )}
          {currentClusteringStatus === 'failed' && (
             <div className="mb-4 flex items-center justify-center rounded-md border border-dashed border-red-500 bg-red-50 p-4 text-sm text-red-700">
              {/* Optional: Add appropriate icon */}
              <span>先前分群處理失敗，請重試或聯繫支援。(Previous clustering attempt failed.)</span>
            </div>
          )}
          {/* --- End Status Display --- */}

          {/* Check if clusters exist OR if clustering is currently processing (Use currentClusteringStatus) */} 
          {(currentClusters && Object.keys(currentClusters).length > 0) || currentClusteringStatus === 'processing' ? (
             <>
               <KeywordClustering
                clusters={currentClusters}
                personasMap={currentPersonas}
                keywordVolumeMap={keywordVolumeMap}
                onSavePersona={handleSavePersona}
                isSavingPersona={isSavingPersona}
                researchId={researchId}
                clusteringStatus={currentClusteringStatus}
                researchLocation={initialResearchDetail.location || settingsState.region}
                researchLanguage={initialResearchDetail.language || settingsState.language}
                currentKeywords={sortedUniqueKeywords.map(k => k.text || '').filter(Boolean)}
                selectedResearchDetail={{ query: initialResearchDetail.query }}
              />
              {/* Show re-trigger button only if clustering is NOT currently processing (Use currentClusteringStatus) */} 
              {currentClusteringStatus !== 'processing' && (
                  <div className="mt-4 flex justify-end">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <LoadingButton
                            variant="outline"
                            size="sm"
                            onClick={handleRequestClustering}
                            isLoading={isRequestingClustering}
                            disabled={isRequestingClustering}
                            aria-label="Request Clustering"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </LoadingButton>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Request Re-clustering</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
             </>
          ) : (
             // Show Empty state if no clusters and not currently processing.
             // The label inside EmptyState handles 'Start' vs 'Retry'.
             <EmptyState
                 title="Cluster Keywords"
                 description="Group these keywords by similarity to uncover user intent."
                 // Adjust label based on whether it was initially pending or failed
                 actionLabel={currentClusteringStatus === 'failed' ? "Retry Clustering" : "Start Clustering"} 
                 onAction={handleRequestClustering}
             />
          )}
           {/* Display local errors if any */}
           {localError && (
             <p className="mt-4 text-center text-sm text-red-500">{localError}</p>
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
