'use client';

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartBarIcon, TrendingUpIcon } from "lucide-react";

interface ResearchResult {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
}

interface KeywordSuggestion {
  keyword: string;
  searchVolume: number;
  relevance: number;
}

interface ResearchResultsProps {
  isLoading?: boolean;
  suggestions?: KeywordSuggestion[];
  adPlanningData?: ResearchResult;
}

export default function ResearchResults({
  isLoading,
  suggestions = [],
  adPlanningData,
}: ResearchResultsProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUpIcon className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-medium">相關關鍵詞</h3>
        </div>
        
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{suggestion.keyword}</span>
                <Badge variant="secondary" className="text-xs">
                  相關度: {suggestion.relevance}%
                </Badge>
              </div>
              <span className="text-sm text-gray-500">
                {suggestion.searchVolume.toLocaleString()} 次/月
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-medium">廣告規劃數據</h3>
        </div>

        {adPlanningData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">搜尋量</p>
                <p className="text-lg font-semibold">
                  {adPlanningData.searchVolume.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">競爭度</p>
                <p className="text-lg font-semibold">
                  {(adPlanningData.competition * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">每次點擊成本</p>
                <p className="text-lg font-semibold">
                  ${adPlanningData.cpc.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">無廣告規劃數據</p>
        )}
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUpIcon className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-medium">相關關鍵詞</h3>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <ChartBarIcon className="h-4 w-4 text-green-500" />
          <h3 className="text-sm font-medium">廣告規劃數據</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
} 