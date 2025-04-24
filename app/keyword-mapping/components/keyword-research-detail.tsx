'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

// Actions
import {
  requestClustering,
  revalidateKeywordResearch,
  generateAndSavePersonaForCluster
} from '@/app/actions';

// UI Components
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
import { ListTree } from 'lucide-react';

// Internal Components
import KeywordClustering from './keyword-clustering';
import KeywordVolumeVisualization, {
  type VolumeFilterType
} from './keyword-volume-visualization';

// Types from the centralized types file
import { type KeywordVolumeItem } from '@/app/services/firebase/types';
// Import the specific client data type from schema.ts now
import type { ProcessedKeywordResearchData } from '@/app/services/firebase/schema';
import type { ClusterItem } from '@/app/services/firebase/types';

export default function KeywordResearchDetail({
  keywordResearchObject
}: { keywordResearchObject: ProcessedKeywordResearchData }) {
  const router = useRouter();
  // Extract researchId from the object
  const researchId = keywordResearchObject.id;

  // --- Pagination State (Re-added) ---
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(12);

  // --- Volume Filter State ---
  const [volumeFilter, setVolumeFilter] = useState<VolumeFilterType>('all');
  // Define thresholds consistent with the visualization component
  const HIGH_VOLUME_THRESHOLD = 10000;
  const MEDIUM_VOLUME_THRESHOLD = 500;

  // Local State
  const [isRequestingClustering, setIsRequestingClustering] = useState(false);
  const [isSavingPersona, setIsSavingPersona] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // --- Data Processing Memos ---
  const sortedUniqueKeywords = useMemo(() => {
    const uniqueKeywords = new Map<string, KeywordVolumeItem>();
    // Use keywordResearchObject
    (keywordResearchObject?.keywords || []).forEach((kw: KeywordVolumeItem) => { 
      const text = kw.text?.trim().toLowerCase();
      if (text && !uniqueKeywords.has(text)) {
        uniqueKeywords.set(text, kw);
      }
    });
    const keywordsArray = Array.from(uniqueKeywords.values());
    keywordsArray.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
    return keywordsArray;
  }, [keywordResearchObject?.keywords]); // <-- Update dependency

  const filteredKeywords = useMemo(() => {
    if (volumeFilter === 'all') {
      return sortedUniqueKeywords;
    }
    return sortedUniqueKeywords.filter(kw => {
      const volume = kw.searchVolume;
      switch (volumeFilter) {
        case 'high':
          // Handle null/undefined as 0 for filtering
          return (volume ?? 0) >= HIGH_VOLUME_THRESHOLD;
        case 'medium':
          return (
            (volume ?? 0) >= MEDIUM_VOLUME_THRESHOLD &&
            (volume ?? 0) < HIGH_VOLUME_THRESHOLD
          );
        case 'low':
          return (
            (volume ?? 0) > 0 &&
            (volume ?? 0) < MEDIUM_VOLUME_THRESHOLD
          );
        default:
          return true;
      }
    });
  }, [sortedUniqueKeywords, volumeFilter]); // Removed thresholds from dependencies

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

  // --- Memos for Clustering (UPDATED) ---
  const currentClustersArray = useMemo(() => {
    // Use keywordResearchObject.clustersWithVolume
    const clusters = keywordResearchObject?.clustersWithVolume;
    if (clusters && Array.isArray(clusters) && clusters.length > 0) {
        // Ensure ClusterItem structure is expected
        return clusters.filter(c => c && c.clusterName && Array.isArray(c.keywords)) as ClusterItem[];
    }
    return null;
  }, [keywordResearchObject?.clustersWithVolume]); // <-- Depend on clustersWithVolume

  const hasValidClusters = useMemo(() =>
    !!currentClustersArray && currentClustersArray.length > 0,
    [currentClustersArray]
  );

  const keywordVolumeRecord: Record<string, number> = useMemo(() => {
    const map = new Map<string, number>();
    // Use keywordResearchObject
    (keywordResearchObject?.keywords || []).forEach((kw: KeywordVolumeItem) => { 
      if (kw.text) {
        map.set(kw.text.toLowerCase(), kw.searchVolume ?? 0);
      }
    });
    return Object.fromEntries(map.entries());
  }, [keywordResearchObject?.keywords]); // <-- Update dependency

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
    // researchId is now derived from keywordResearchObject
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
        await revalidateKeywordResearch(researchId);
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
    async (clusterName: string) => {
      // researchId is derived from props
      if (!researchId || !clusterName) {
        toast.error('無法生成用戶畫像：缺少必要數據 (ID or Cluster Name)。');
        return;
      }

      setIsSavingPersona(clusterName); // Set loading state
      setLocalError(null);
      toast.info(`正在為分群 "${clusterName}" 生成並保存用戶畫像...`);

      try {
        // Call the NEW server action
        const result = await generateAndSavePersonaForCluster(researchId, clusterName);

        if (result.success) {
          toast.success(`用戶畫像 "${clusterName}" 已生成並保存！頁面將自動刷新。`);
          // Revalidation is handled by the action, just refresh the client
          router.refresh(); 
        } else {
          // Throw error to be caught below
          throw new Error(result.error || '生成或保存用戶畫像時發生未知服務器錯誤');
        }

      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : '處理用戶畫像時發生客戶端錯誤';
        toast.error(`處理 "${clusterName}" 時出錯: ${errorMsg}`);
        setLocalError(`處理 "${clusterName}" 時出錯: ${errorMsg}`);
      } finally {
        setIsSavingPersona(null); // Clear loading state
      }
    },
    // Only depends on researchId and router now
    [researchId, router]
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
      <div className="flex items-center justify-end mb-6">
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
          {hasValidClusters && currentClustersArray && (
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
                clusters={currentClustersArray}
                keywordVolumeMap={keywordVolumeRecord}
                researchRegion={keywordResearchObject.region || 'us'}
                researchLanguage={keywordResearchObject.language || 'en'}
                currentKeywords={filteredKeywords.map(kw => kw.text || '')}
                selectedResearchDetail={{ query: keywordResearchObject.query }}
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
