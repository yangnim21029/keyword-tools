'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { FileText, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ToolHeader } from '../../ToolHeader';

// Shadcn UI Tabs
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Actions
import {
  triggerKeywordClustering,
  updateKeywordResearchPersonas
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
  const [isClustering, setIsClustering] = useState(false);
  const [isGeneratingPersonas, setIsGeneratingPersonas] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [view, setView] = useState<'volume' | 'cluster'>('volume');

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
  const triggerClustering = useCallback(async () => {
    console.log(
      '[KeywordResearchDetail] triggerClustering (calling server action) called.'
    );

    // Add check: If clusters already exist, don't re-trigger immediately
    if (currentClusters && Object.keys(currentClusters).length > 0) {
      console.log(
        '[KeywordResearchDetail] triggerClustering aborted: Clusters already exist.'
      );
      toast.info('關鍵詞已經分群，無需重新觸發。'); // Inform the user
      return; // Exit the function
    }

    // Keep basic guard
    if (!researchId) {
      console.warn(
        '[KeywordResearchDetail] triggerClustering aborted: Missing researchId.'
      );
      setLocalError('Cannot start clustering: Missing research ID.');
      return;
    }
    // Remove keyword count check, server action will handle it

    console.log('[KeywordResearchDetail] Setting isClustering = true');
    setIsClustering(true);
    setLocalError(null);
    toast.info('開始重新分群...'); // Give user feedback

    try {
      console.log(
        `[KeywordResearchDetail] Calling triggerKeywordClustering server action for ${researchId}...`
      );
      const result = await triggerKeywordClustering(researchId);

      if (result.success) {
        console.log(
          '[KeywordResearchDetail] Server action triggerKeywordClustering successful. Refreshing router...'
        );
        toast.success('關鍵詞重新分群完成!');
        router.refresh(); // Refresh to get updated clusters
      } else {
        console.error(
          '[KeywordResearchDetail] Server action triggerKeywordClustering failed:',
          result.error
        );
        throw new Error(result.error || 'Failed to trigger clustering.');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown clustering trigger error';
      console.error(
        '[KeywordResearchDetail] Error calling triggerKeywordClustering server action:',
        message,
        error
      );
      toast.error(`重新分群失敗: ${message}`);
      setLocalError(`重新分群失敗: ${message}`);
    } finally {
      console.log('[KeywordResearchDetail] Setting isClustering = false');
      setIsClustering(false);
    }
    // Remove dependencies on sortedUniqueKeywords and selectedModel
  }, []);

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
          router.refresh();
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
          title="關鍵詞研究結果"
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
    <div className="space-y-6">
      <Tabs
        value={view}
        onValueChange={value => setView(value as 'volume' | 'cluster')}
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-2 mb-4">
          <TabsList>
            <TabsTrigger value="volume">分布視圖</TabsTrigger>
            <TabsTrigger
              value="cluster"
              disabled={!hasClusters && !isClustering}
            >
              {isClustering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  分群中...
                </>
              ) : (
                '分群視圖'
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="volume">
          {/* Render the new KeywordDistribute component here */}
          {volumeDistribution.count > 0 ? (
            <KeywordDistribute
              volumeDistribution={volumeDistribution}
              keywords={sortedUniqueKeywords}
            />
          ) : (
            // Show empty state if no volume data for distribution
            <div className="border rounded-lg p-6 text-center">
              <p className="text-muted-foreground italic py-4">
                沒有足夠的搜索量數據來計算分布。
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cluster">
          {/* --- Cluster View Rendering (props passed correctly) --- */}
          {hasClusters ? (
            <div className="space-y-4">
              {/* --- Persona Generation Controls --- */}
              <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                {/* Recluster Button - Added */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={triggerClustering}
                        disabled={isClustering}
                        className="h-9"
                      >
                        {isClustering ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        重新分群
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isClustering ? '正在重新分群...' : '重新觸發關鍵詞分群'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <LoadingButton
                  onClick={handleGenerateAllPersonas}
                  isLoading={isGeneratingPersonas}
                  disabled={isGeneratingPersonas || isClustering}
                  loadingText="生成中..."
                  className="whitespace-nowrap h-9"
                >
                  {currentPersonas && Object.keys(currentPersonas).length > 0
                    ? '更新所有用戶畫像'
                    : '生成所有用戶畫像'}
                </LoadingButton>
              </div>
              {/* --- Keyword Clustering Component --- */}
              <KeywordClustering
                keywordVolumeMap={keywordVolumeMap}
                clusters={currentClusters}
                personasMap={currentPersonas}
                researchLocation={
                  initialResearchDetail.location || settingsState.region
                }
                researchLanguage={
                  initialResearchDetail.language || settingsState.language
                }
                currentKeywords={sortedUniqueKeywords
                  .map(k => k.text || '')
                  .filter(Boolean)}
                selectedResearchDetail={initialResearchDetail}
                researchId={researchId}
                onSavePersona={handleSavePersona}
                isSavingPersona={isSavingPersona}
              />
            </div>
          ) : isClustering ? (
            <div className="flex flex-col items-center justify-center h-[40vh] space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-md text-muted-foreground">
                正在進行語義分群...
              </p>
            </div>
          ) : (
            // Updated empty state message
            <div className="flex flex-col items-center justify-center h-[40vh] text-center">
              <EmptyState
                title="無分群數據"
                description="系統在處理關鍵詞時未自動生成分群，或尚未觸發分群。"
              />
              {/* Optionally add the button here too if you want a trigger in this state */}
              {sortedUniqueKeywords.length >= 5 && (
                <LoadingButton
                  variant="outline"
                  className="mt-4"
                  onClick={triggerClustering}
                  disabled={isClustering}
                >
                  {isClustering ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  立即嘗試分群
                </LoadingButton>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
