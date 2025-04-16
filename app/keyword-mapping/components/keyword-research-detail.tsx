'use client';

import { useSettingsStore } from '@/store/settings-store';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

// Actions
import {
  requestClustering,
  revalidateKeywordData,
  updateKeywordResearch
} from '@/app/actions';
import { generateUserPersonaFromClusters } from '@/app/actions/generate-persona';

// Internal Components
import { LoadingButton } from '@/components/ui/LoadingButton';
import { EmptyState } from './empty-state';
import KeywordClustering from './keyword-clustering';
import KeywordDistribute from './keyword-distribute';

import {
  UpdateKeywordResearchInput,
  type KeywordResearchItem,
  type UserPersona
} from '@/lib/schema';


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
  initialResearchDetail: KeywordResearchItem & { clusteringStatus?: string };
  researchId: string;
  volumeDistribution: VolumeDistributionStats;
}

export default function KeywordResearchDetail({
  initialResearchDetail,
  researchId,
  volumeDistribution
}: KeywordResearchDetailProps) {
  const router = useRouter();
  const settingsState = useSettingsStore(store => store.state);

  // Local State
  const [isRequestingClustering, setIsRequestingClustering] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
    // Additional validation to make sure clusters are non-empty and well-formed
    const clusters = initialResearchDetail?.clusters || null;
    
    // Check if clusters object exists and has at least one non-empty cluster
    if (clusters && typeof clusters === 'object') {
      const validClusters: Record<string, string[]> = {};
      let hasValidCluster = false;
      
      // Validate each cluster and only keep valid ones
      Object.entries(clusters).forEach(([clusterName, keywords]) => {
        // Ensure cluster has a name and non-empty keywords array
        if (clusterName && Array.isArray(keywords) && keywords.length > 0) {
          validClusters[clusterName] = keywords;
          hasValidCluster = true;
        }
      });
      
      console.log(`[KeywordResearchDetail] Valid clusters found: ${hasValidCluster}, count: ${Object.keys(validClusters).length}`);
      return hasValidCluster ? validClusters : null;
    }
    
    console.log('[KeywordResearchDetail] No valid clusters object found');
    return null;
  }, [initialResearchDetail]);
  
  // Advanced validation for clusters
  const hasValidClusters = useMemo(() => {
    if (!currentClusters) return false;
    
    // Make sure at least one cluster has keywords
    const isValid = Object.entries(currentClusters).some(
      ([name, keywords]) => name && Array.isArray(keywords) && keywords.length > 0
    );
    
    console.log(`[KeywordResearchDetail] hasValidClusters evaluation result: ${isValid}`);
    return isValid;
  }, [currentClusters]);

  // 3. Memoize raw personas from prop
  const currentPersonas = useMemo(() => {
    console.log('[KeywordResearchDetail] Recalculating currentPersonas...');
    const personasFromProp = initialResearchDetail?.personas;
    // Ensure it's an array, default to empty array otherwise
    if (Array.isArray(personasFromProp)) {
      return personasFromProp as UserPersona[];
    }
    console.warn('[KeywordResearchDetail] initialResearchDetail.personas was not an array, defaulting to []. Value:', personasFromProp);
    return [] as UserPersona[];
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

  // --- Clustering Logic ---
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
      // Call the server action
      const result = await requestClustering(researchId);

      if (result.success) {
        console.log(
          '[KeywordResearchDetail] Server action requestClustering successful.'
        );
        toast.success(
          '分群請求已發送! 頁面將在處理後刷新。(Clustering requested! Page will refresh after processing.)'
        );

        // Revalidate cache BEFORE refreshing, as polling is removed
        try {
          console.log(
            `[KeywordResearchDetail] Revalidating data after clustering request for ${researchId}...`
          );
          await revalidateKeywordData(researchId); // Call the server action
          console.log(
            `[KeywordResearchDetail] Revalidation requested via action. Refreshing router...`
          );
          router.refresh(); // Refresh to get potentially updated data
        } catch (revalError) {
          console.error(
            `[KeywordResearchDetail] Failed to request revalidation via action:`,
            revalError
          );
           // Also force reload if revalidation fails
          router.refresh(); // Still refresh even if revalidation fails
           // Optional: Force reload if refresh isn't enough
           // setTimeout(() => window.location.reload(), 500);
        }
      } else {
        console.error(
          '[KeywordResearchDetail] Server action requestClustering failed:',
          result.error
        );
        // Show specific error from action or generic one
        const errorMsg =
          result.error || '請求分群失敗 (Failed to request clustering).';
        toast.error(errorMsg);
        setLocalError(errorMsg);
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
  }, [researchId, router]);

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

  // --- RENDER LOGIC ---

  if (localError && !hasValidClusters) { // Show full error state only if no clusters
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-[calc(100vh-150px)]">
          <EmptyState
            title="無法加載數據或處理失敗"
            description={localError || "提供的研究數據無效或不完整。"}
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
        <KeywordDistribute keywords={sortedUniqueKeywords} />

        {/* --- Integrated Clustering Section --- */}

        {/* Render the Clustering Card ONLY when clusters exist */}
        {hasValidClusters && initialResearchDetail && (
          <div className="mt-6 w-full">
            <KeywordClustering
              clusters={currentClusters}
              personasMap={personasMapForClustering}
              keywordVolumeMap={Object.fromEntries(keywordVolumeMap.entries())}
              onSavePersona={handleSavePersona}
              isSavingPersona={isSavingPersona}
              researchId={researchId}
              researchRegion={initialResearchDetail.region || ''}
              researchLanguage={initialResearchDetail.language || ''}
              currentKeywords={sortedUniqueKeywords
                .map(k => k.text || '')
                .filter(Boolean)}
              selectedResearchDetail={{
                query: initialResearchDetail.query
              }}
            />
          </div>
        )}

        {/* Render the standalone button when clusters are not ready/valid */}
        {!hasValidClusters && (
          <div className="mt-6 flex flex-col items-center">
            <LoadingButton
              onClick={handleRequestClustering}
              isLoading={isRequestingClustering}
              disabled={isRequestingClustering}
              variant={'outline'}
            >
              查看關鍵字分群 (View Keyword Clusters)
            </LoadingButton>

            {/* Display error from the last request if no clusters are shown */}
            {localError && (
              <p className="mt-2 text-sm text-destructive">{localError}</p>
            )}
          </div>
        )}

        {/* Display local errors if any (redundant? kept for now) */}
        {localError && hasValidClusters && ( // Only show if clusters are also shown
          <div className="mt-4 text-center text-sm text-red-500">
            {localError}
          </div>
        )}
      </div>
    </div>
  );
}
