'use client';

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface KeywordCluster {
  id: string;
  name: string;
  keywords: string[];
  score?: number;
}

interface KeywordClusteringProps {
  researchId?: string;
  clusters?: KeywordCluster[];
  keywords: string[];
  onClusteringComplete?: (clusters: KeywordCluster[]) => void;
}

export default function KeywordClustering({
  researchId,
  clusters: initialClusters,
  keywords,
  onClusteringComplete
}: KeywordClusteringProps) {
  const [clusters, setClusters] = useState<KeywordCluster[]>(initialClusters || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 處理重新分群
  const handleRecluster = useCallback(async () => {
    if (!keywords.length) {
      toast.error('沒有可用的關鍵詞進行分群');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // TODO: 實現分群 API 調用
      const response = await fetch('/api/keyword-research/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          researchId,
          keywords
        }),
      });

      if (!response.ok) {
        throw new Error('分群請求失敗');
      }

      const data = await response.json();
      setClusters(data.clusters);
      
      if (onClusteringComplete) {
        onClusteringComplete(data.clusters);
      }

      toast.success('關鍵詞分群完成');
    } catch (err) {
      console.error('分群失敗:', err);
      setError(err instanceof Error ? err.message : '分群過程中發生錯誤');
      toast.error('分群失敗，請稍後重試');
    } finally {
      setIsLoading(false);
    }
  }, [keywords, researchId, onClusteringComplete]);

  if (!keywords.length) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        沒有可用的關鍵詞進行分群
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          關鍵詞分群
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecluster}
          disabled={isLoading}
          className="flex items-center"
        >
          {isLoading ? (
            <>
              <Sparkles className="h-5 w-5 mr-2 animate-spin" />
              <span>分群中...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 mr-2" />
              <span>重新分群</span>
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="grid grid-cols-1 gap-4">
          {clusters.map((cluster) => (
            <Card key={cluster.id} className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {cluster.name}
                  </h3>
                  {cluster.score !== undefined && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      相關度: {(cluster.score * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {cluster.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
} 