'use client';

import { ArrowLeft, FileText, Loader2, RefreshCw } from 'lucide-react';
import React, { useMemo } from 'react'; // Import useMemo

// Internal Components
import { EmptyState } from '@/app/keyword-mapping/components/empty-state';
import KeywordClustering from '@/app/keyword-mapping/components/keyword-clustering'; // Adjusted path
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/LoadingButton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

// Types from schema
import {
  type Cluster,
  type ClusteringStatus,
  type KeywordVolumeItem,
  type UserPersona
} from '@/lib/schema'; // Import KeywordVolumeItem

interface KeywordClusteringDetailProps {
  researchId: string;
  currentClusters: Cluster | null;
  currentPersonas: UserPersona[] | null; // Pass the original array
  keywordVolumeMap: Record<string, number>;
  currentClusteringStatus: ClusteringStatus | null;
  isRequestingClustering: boolean;
  isGeneratingPersonas: boolean; // Receive this state
  isSavingPersona: string | null;
  sortedUniqueKeywords: KeywordVolumeItem[]; // Use KeywordVolumeItem
  initialQuery: string; // Pass query for selectedResearchDetail
  initialRegion?: string;
  initialLanguage?: string;
  onHandleRequestClustering: () => Promise<void>;
  onHandleSavePersona: (
    clusterName: string,
    keywords: string[]
  ) => Promise<void>;
  onHandleGenerateAllPersonas: () => Promise<void>; // Receive this handler
  onBackToVolumeView: () => void; // Callback to switch view back
}

// Helper function to get status text (Moved from parent)
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

// Helper function to get status color (Moved from parent)
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

const KeywordClusteringDetail: React.FC<KeywordClusteringDetailProps> = ({
  researchId,
  currentClusters,
  currentPersonas,
  keywordVolumeMap,
  currentClusteringStatus,
  isRequestingClustering,
  isGeneratingPersonas, // Destructure prop
  isSavingPersona,
  sortedUniqueKeywords,
  initialQuery,
  initialRegion,
  initialLanguage,
  onHandleRequestClustering,
  onHandleSavePersona,
  onHandleGenerateAllPersonas, // Destructure prop
  onBackToVolumeView
}) => {
  // Memoize the personas map locally within this component
  const personasMapForClustering = useMemo(() => {
    if (!currentPersonas || !Array.isArray(currentPersonas)) return null;
    return currentPersonas.reduce((acc, persona) => {
      acc[persona.name] = persona.description;
      return acc;
    }, {} as Record<string, string>);
  }, [currentPersonas]);

  return (
    <div className="space-y-4">
      {/* Button to switch back to volume view */}
      <div className="mb-4">
        <Button
          onClick={onBackToVolumeView} // Use callback prop
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

      {/* Status Display & Re-cluster button */}
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
            <p className="text-xs text-destructive mt-1">處理失敗，請重試。</p>
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
                onClick={onHandleRequestClustering} // Use callback prop
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
      {/* End Status Display */}

      {/* Check if clusters exist OR if clustering is currently processing */}
      {(currentClusters && Object.keys(currentClusters).length > 0) ||
      currentClusteringStatus === 'processing' ? (
        <>
          <KeywordClustering
            clusters={currentClusters}
            personasMap={personasMapForClustering} // Use the locally memoized map
            keywordVolumeMap={keywordVolumeMap}
            onSavePersona={onHandleSavePersona} // Use callback prop
            isSavingPersona={isSavingPersona}
            researchId={researchId}
            clusteringStatus={currentClusteringStatus}
            researchRegion={initialRegion || ''}
            researchLanguage={initialLanguage || ''}
            currentKeywords={sortedUniqueKeywords
              .map(k => k.text || '')
              .filter(Boolean)}
            selectedResearchDetail={{
              query: initialQuery // Pass query from props
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
  );
};

export default KeywordClusteringDetail;
