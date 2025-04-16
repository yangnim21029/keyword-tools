'use client';

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

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/LoadingButton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatVolume } from '@/lib/utils';
import { Clock, Globe, Languages, ListTree, Tag } from 'lucide-react';

// Internal Components
import KeywordClustering from './keyword-clustering';
import KeywordVolumeVisualization, {
  type VolumeFilterType
} from './keyword-volume-visualization';

import {
  type KeywordResearchItem,
  type KeywordVolumeItem,
  type UserPersona
} from '@/lib/schema';

interface KeywordResearchDetailProps {
  initialResearchDetail: KeywordResearchItem & {
    clusters?: Record<string, string[]> | null;
    personas?: Partial<UserPersona>[];
    clusteringStatus?: string;
  };
  researchId: string;
}

// Helper function to format date/time
function formatDateTime(
  date: Date | { seconds: number; nanoseconds: number } | string | undefined
): string {
  if (!date) return 'N/A';
  let dateObj: Date;
  if (
    typeof date === 'object' &&
    date !== null &&
    'seconds' in date &&
    'nanoseconds' in date
  ) {
    dateObj = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    try {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
    } catch (error) {
      return 'Invalid Date Format';
    }
  }
  return dateObj.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

export default function KeywordResearchDetail({
  initialResearchDetail,
  researchId
}: KeywordResearchDetailProps) {
  const router = useRouter();

  // --- Pagination State (Re-added) ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(12);

  // --- Volume Filter State ---
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilterType>('all');
  const [highVolumeThreshold] = useState(10000);
  const [mediumVolumeThreshold] = useState(1000);

  // Local State
  const [isRequestingClustering, setIsRequestingClustering] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // --- Data Processing Memos ---
  const sortedUniqueKeywords = useMemo(() => {
    const uniqueKeywords = new Map<string, KeywordVolumeItem>();
    (initialResearchDetail?.keywords || []).forEach((kw: KeywordVolumeItem) => {
      const text = kw.text?.trim().toLowerCase();
      if (text && !uniqueKeywords.has(text)) {
        uniqueKeywords.set(text, kw);
      }
    });
    const keywordsArray = Array.from(uniqueKeywords.values());
    keywordsArray.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
    return keywordsArray;
  }, [initialResearchDetail?.keywords]);

  const filteredKeywords = useMemo(() => {
    if (volumeFilter === 'all') {
      return sortedUniqueKeywords;
    }
    return sortedUniqueKeywords.filter(kw => {
      const volume = kw.searchVolume;
      switch (volumeFilter) {
        case 'high':
          return (
            volume !== null &&
            volume !== undefined &&
            volume >= highVolumeThreshold
          );
        case 'medium':
          return (
            volume !== null &&
            volume !== undefined &&
            volume >= mediumVolumeThreshold &&
            volume < highVolumeThreshold
          );
        case 'low':
          return (
            volume !== null &&
            volume !== undefined &&
            volume > 0 &&
            volume < mediumVolumeThreshold
          );
        case 'na':
          return volume === null || volume === undefined;
        default:
          return true;
      }
    });
  }, [
    sortedUniqueKeywords,
    volumeFilter,
    highVolumeThreshold,
    mediumVolumeThreshold
  ]);

  // --- Pagination Calculation (based on filteredKeywords) ---
  const totalFilteredKeywords = filteredKeywords.length;
  const totalPages = Math.ceil(totalFilteredKeywords / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const keywordsForCurrentPage = filteredKeywords.slice(startIndex, endIndex);

  // --- Effect to adjust currentPage when filters change totalPages ---
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1 && totalPages > 0) {
      setCurrentPage(1);
    } else if (totalPages === 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // --- Memos for Clustering (Re-added) ---
  const currentClusters = useMemo(() => {
    const clusters = initialResearchDetail?.clusters || null;
    if (clusters && typeof clusters === 'object') {
      const validClusters: Record<string, string[]> = {};
      let hasValidCluster = false;
      Object.entries(clusters).forEach(([clusterName, keywords]) => {
        if (clusterName && Array.isArray(keywords) && keywords.length > 0) {
          validClusters[clusterName] = keywords;
          hasValidCluster = true;
        }
      });
      return hasValidCluster ? validClusters : null;
    }
    return null;
  }, [initialResearchDetail?.clusters]);

  const hasValidClusters = useMemo(
    () => !!currentClusters && Object.keys(currentClusters).length > 0,
    [currentClusters]
  );

  // Note: Personas are passed down but not displayed/generated here currently
  const currentPersonas = useMemo(() => {
    const personasFromProp = initialResearchDetail?.personas;
    if (Array.isArray(personasFromProp)) {
      return personasFromProp.map((p: Partial<UserPersona>) => ({
        name: p.name || '未命名畫像',
        description: p.description || '無描述',
        keywords: p.keywords || [],
        characteristics: p.characteristics || [],
        interests: p.interests || [],
        painPoints: p.painPoints || [],
        goals: p.goals || []
      })) as UserPersona[];
    }
    return [] as UserPersona[];
  }, [initialResearchDetail?.personas]);

  const personasMapForClustering = useMemo(() => {
    const map: Record<string, string> = {};
    currentPersonas.forEach(persona => {
      if (persona && persona.name && persona.description) {
        map[persona.name] = persona.description;
      }
    });
    return map;
  }, [currentPersonas]);

  const keywordVolumeRecord: Record<string, number> = useMemo(() => {
    const map = new Map<string, number>();
    filteredKeywords.forEach(kw => {
      if (kw.text) {
        map.set(kw.text.toLowerCase(), kw.searchVolume ?? 0);
      }
    });
    return Object.fromEntries(map.entries());
  }, [filteredKeywords]);

  // --- Filter Handler ---
  const handleVolumeFilterChange = useCallback(
    (newFilter: VolumeFilterType) => {
      setVolumeFilter(newFilter);
      setCurrentPage(1); // Reset to first page when filter changes
    },
    []
  );

  // Re-add handlePageChange
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Action Handlers
  const handleRequestClustering = useCallback(async () => {
    if (!researchId) {
      setLocalError('Cannot start clustering: Missing research ID.');
      return;
    }
    setIsRequestingClustering(true);
    setLocalError(null);
    toast.info('請求開始分群...');
    try {
      const result = await requestClustering(researchId);
      if (result.success) {
        toast.success('分群請求已發送! 頁面將在處理後刷新。');
        await revalidateKeywordData(researchId);
        router.refresh();
      } else {
        throw new Error(result.error || '請求分群失敗');
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : '請求分群時發生未知錯誤';
      toast.error(errorMsg);
      setLocalError(errorMsg);
    } finally {
      setIsRequestingClustering(false);
    }
  }, [researchId, router]);

  const handleSavePersonaForCluster = useCallback(
    async (clusterName: string, keywords: string[]) => {
      if (!researchId || !clusterName || !keywords || keywords.length === 0) {
        toast.error('無法生成用戶畫像：缺少必要數據。 ');
        return;
      }
      setIsSavingPersona(clusterName);
      setLocalError(null);
      toast.info(`正在為分群 "${clusterName}" 生成用戶畫像...`);

      try {
        const result = await generateUserPersonaFromClusters({
          clusterName,
          keywords
        });

        if (!result || !result.userPersona) {
          throw new Error('AI未能返回有效的用戶畫像文本。');
        }

        const newPersonaData = {
          name: clusterName,
          description: result.userPersona,
          keywords: keywords,
          characteristics: [],
          interests: [],
          painPoints: [],
          goals: []
        };

        const currentPersonasFromProp = initialResearchDetail.personas || [];
        const existingIndex = currentPersonasFromProp.findIndex(
          (p: Partial<UserPersona>) => p.name === clusterName
        );

        let updatedPersonas: Partial<UserPersona>[];
        if (existingIndex !== -1) {
          updatedPersonas = [...currentPersonasFromProp];
          updatedPersonas[existingIndex] = {
            ...currentPersonasFromProp[existingIndex],
            ...newPersonaData
          };
        } else {
          updatedPersonas = [...currentPersonasFromProp, newPersonaData];
        }

        // Use the dedicated action for updating
        await updateKeywordResearch(researchId, {
          personas: updatedPersonas as UserPersona[],
          updatedAt: new Date() // Let action handle timestamp if possible, or set here
        });

        toast.success(`用戶畫像 "${clusterName}" 已生成並保存！`);
        await revalidateKeywordData(researchId);
        router.refresh();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : '生成或保存用戶畫像時發生錯誤';
        toast.error(errorMsg);
        setLocalError(`處理 "${clusterName}" 時出錯: ${errorMsg}`);
      } finally {
        setIsSavingPersona(null);
      }
    },
    [researchId, router, initialResearchDetail]
  );

  // Render Logic
  return (
    <div className="space-y-6 p-4 md:p-6">
      {localError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/30 p-3 rounded-md text-sm mb-4">
          操作錯誤: {localError}
        </div>
      )}
      {/* Section 1: Metadata and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Metadata */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Globe className="mr-1.5 h-4 w-4" />
            地區: {initialResearchDetail.region || '未指定'}
          </div>
          <div className="flex items-center">
            <Languages className="mr-1.5 h-4 w-4" />
            語言: {initialResearchDetail.language || '未指定'}
          </div>
          <div className="flex items-center">
            <Clock className="mr-1.5 h-4 w-4" />
            最後更新: {formatDateTime(initialResearchDetail.updatedAt)}
          </div>
          {initialResearchDetail.tags &&
            initialResearchDetail.tags.length > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="mr-1 h-4 w-4" />
                {initialResearchDetail.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
        </div>
        {/* Action Button */}
        <LoadingButton
          onClick={handleRequestClustering}
          isLoading={isRequestingClustering}
          disabled={isRequestingClustering || sortedUniqueKeywords.length < 5}
          size="sm"
        >
          <ListTree className="mr-2 h-4 w-4" />
          {hasValidClusters ? '重新分群' : '請求分群'}
        </LoadingButton>
      </div>
      {/* Section 2: Volume Visualization */}
      <KeywordVolumeVisualization
        keywords={sortedUniqueKeywords}
        highVolumeThreshold={highVolumeThreshold}
        mediumVolumeThreshold={mediumVolumeThreshold}
        currentFilter={volumeFilter}
        onFilterChange={handleVolumeFilterChange}
      />
      {/* Section 3 & 4 Combined: Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (1/3 width): Keywords Table with Pagination */}
        <div className="md:col-span-1 space-y-3">
          {totalFilteredKeywords > 0 ? (
            <>
              <Table className="w-full">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-medium">關鍵字</TableHead>
                    <TableHead className="text-right pr-4 font-medium">
                      月搜索量
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordsForCurrentPage.map((kw, index) => (
                    <TableRow key={`${kw.text}-${startIndex + index}`}>
                      <TableCell className="font-medium truncate pr-2">
                        {kw.text}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        {formatVolume(kw.searchVolume ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      下一頁
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              {/* Use a more generic message now that the helper is removed */}
              {volumeFilter === 'all'
                ? '沒有找到關鍵字數據。'
                : '沒有找到符合當前條件的關鍵字。'}
            </p>
          )}
        </div>

        {/* Right Column (2/3 width): Clustering Results - Replace Card with Div */}
        <div className="md:col-span-2">
          {hasValidClusters && currentClusters && (
            <div className="h-full space-y-3">
              <div>
                <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center">
                  <ListTree className="mr-2 h-5 w-5" /> 語義分群結果
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  根據語義相關性對關鍵字進行的分組。
                </p>
              </div>
              <KeywordClustering
                clusters={currentClusters}
                keywordVolumeMap={keywordVolumeRecord}
                personasMap={personasMapForClustering}
                researchRegion={initialResearchDetail.region || 'us'}
                researchLanguage={initialResearchDetail.language || 'en'}
                currentKeywords={filteredKeywords.map(kw => kw.text || '')}
                selectedResearchDetail={{ query: initialResearchDetail.query }}
                researchId={researchId}
                onSavePersona={handleSavePersonaForCluster}
                isSavingPersona={isSavingPersona}
              />
            </div>
          )}
          {!hasValidClusters && !isRequestingClustering && (
            <div className="text-center text-muted-foreground text-sm p-4 h-full flex items-center justify-center">
              尚未進行分群，或分群結果不可用。點擊上方的「請求分群」按鈕開始。
            </div>
          )}
          {isRequestingClustering && (
            <div className="text-center text-muted-foreground text-sm p-4 h-full flex items-center justify-center">
              正在請求或處理分群...
            </div>
          )}
        </div>
      </div>{' '}
      {/* End Grid */}
    </div>
  );
}
