"use client";

import { GeneratePersonaButton } from "@/app/actions/actions-buttons";
import {
  AiClusterItem,
  KeywordVolumeItem,
  KeywordVolumeObject,
} from "@/app/services/firebase/schema";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatVolume } from "@/lib/utils";
import { LayoutGrid, TrendingUp, User } from "lucide-react";
import { useState } from "react";

interface KeywordClusteringProps {
  keywordVolumeObject: KeywordVolumeObject | null;
}

const INITIAL_VISIBLE_COUNT = 3;

export default function KeywordClustering({
  keywordVolumeObject,
}: KeywordClusteringProps) {
  const [expandedKeywords, setExpandedKeywords] = useState<
    Record<string, boolean>
  >({});

  const toggleExpanded = (clusterName: string) => {
    setExpandedKeywords((prev) => ({
      ...prev,
      [clusterName]: !prev[clusterName],
    }));
  };

  if (!keywordVolumeObject) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">無法載入分群資料</h3>
        <p className="text-sm text-muted-foreground">
          數據無法載入，請稍後再試。
        </p>
      </div>
    );
  }

  const { clustersWithVolume, id: researchId } = keywordVolumeObject;
  const hasValidClusters =
    clustersWithVolume &&
    Array.isArray(clustersWithVolume) &&
    clustersWithVolume.length > 0;

  if (!hasValidClusters) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/30">
        <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-xl font-medium mb-2">未找到分群結果</h3>
        <p className="text-sm text-muted-foreground">
          此研究尚未進行分群或分群結果為空。
        </p>
      </div>
    );
  }

  const sortedClusters = [...(clustersWithVolume as AiClusterItem[])].sort(
    (a, b) => (b.totalVolume ?? 0) - (a.totalVolume ?? 0),
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="max-w-5xl mx-auto">
        <div className="hidden md:flex bg-muted rounded-t-lg border-b border-border font-medium text-sm text-muted-foreground sticky top-0 z-10">
          <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0">
            主題 / 總量
          </div>
          <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0">
            主軸關鍵字 / 量
          </div>
          <div className="p-3 md:w-1/2 lg:w-[30%] flex-grow">
            輔助關鍵字 / 量
          </div>
          <div className="p-3 md:w-auto lg:w-[15%] flex-shrink-0">長尾字詞</div>
          <div className="p-3 md:w-auto lg:w-[25%] flex-shrink-0">用戶畫像</div>
        </div>

        <div className="md:border-x md:border-b md:border-border md:rounded-b-lg space-y-4 md:space-y-0">
          {sortedClusters.map((cluster, index) => {
            const clusterName = cluster.clusterName || `cluster-${index}`;
            const isExpanded = !!expandedKeywords[clusterName];

            const mainAxisKeywordItem = cluster.keywords?.find(
              (kw: KeywordVolumeItem) => kw.text === cluster.mainKeyword,
            );
            const mainAxisKeywordText =
              mainAxisKeywordItem?.text || cluster.mainKeyword || "-";
            const mainAxisVolume = formatVolume(
              mainAxisKeywordItem?.searchVolume ?? 0,
            );
            const validKeywords = Array.isArray(cluster.keywords)
              ? cluster.keywords
              : [];
            const allSupportingKeywords = validKeywords
              .filter((kw) => kw.text !== mainAxisKeywordText)
              .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));

            const keywordsToShow = isExpanded
              ? allSupportingKeywords
              : allSupportingKeywords.slice(0, INITIAL_VISIBLE_COUNT);
            const remainingCount =
              allSupportingKeywords.length - keywordsToShow.length;

            const rowBackground =
              index % 2 === 0 ? "md:bg-card" : "md:bg-muted/40";
            const currentPersona = cluster.personaDescription;
            const longTail = cluster.longTailKeywords;

            return (
              <div
                key={clusterName}
                className={`flex flex-col md:flex-row text-sm border border-border rounded-lg md:border-t md:border-x-0 md:border-b-0 md:rounded-none md:-mt-px ${rowBackground} bg-card md:bg-transparent`}
              >
                <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    主題 / 總量
                  </div>
                  <div className="font-semibold" title={cluster.clusterName}>
                    {cluster.clusterName}
                  </div>
                  <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    <TrendingUp className="inline-block h-3 w-3 mr-0.5" />
                    {formatVolume(cluster.totalVolume ?? 0)}
                  </div>
                </div>

                <div className="p-3 md:w-1/4 lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    主軸關鍵字 / 量
                  </div>
                  <div title={mainAxisKeywordText}>
                    {mainAxisKeywordText}{" "}
                    <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80">
                      ({mainAxisVolume})
                    </span>
                  </div>
                </div>

                <div className="p-3 md:w-1/2 lg:w-[30%] flex-grow border-b md:border-b-0 md:border-r border-border">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    輔助關鍵字 / 量
                  </div>
                  {allSupportingKeywords.length === 0 ? (
                    <span className="text-muted-foreground text-xs italic">
                      (無輔助關鍵字)
                    </span>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {keywordsToShow.map((kwItem, i, arr) => (
                          <span
                            key={kwItem.text || i}
                            className="inline-flex items-baseline"
                          >
                            <span>{kwItem.text}</span>
                            <span className="text-xs font-mono text-indigo-600/80 dark:text-indigo-400/80 ml-0.5">
                              ({formatVolume(kwItem.searchVolume ?? 0)})
                            </span>
                            {i < keywordsToShow.length - 1 && (
                              <span className="text-muted-foreground/60 mx-1">
                                /
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      {allSupportingKeywords.length > INITIAL_VISIBLE_COUNT && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs h-auto p-0 m-0 text-muted-foreground justify-start hover:no-underline focus-visible:ring-0"
                          onClick={() => toggleExpanded(clusterName)}
                        >
                          {isExpanded
                            ? "顯示較少"
                            : `+ ${remainingCount} 個更多`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 md:w-auto lg:w-[15%] flex-shrink-0 border-b md:border-b-0 md:border-r border-border whitespace-normal">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    長尾字詞
                  </div>
                  {longTail && longTail.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {longTail.map((lt, i) => (
                        <span key={i}>{lt}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">
                      (無長尾字詞)
                    </span>
                  )}
                </div>

                <div className="p-3 md:w-auto lg:w-[25%] flex-shrink-0 space-y-2">
                  <div className="font-medium text-xs text-muted-foreground md:hidden mb-1">
                    用戶畫像
                  </div>
                  {currentPersona ? (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        用戶畫像
                      </div>
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {currentPersona}
                      </div>
                    </div>
                  ) : (
                    <GeneratePersonaButton
                      researchId={researchId!}
                      clusterName={cluster.clusterName}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
