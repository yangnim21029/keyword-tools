"use server";

import { formatVolume } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Clock, Globe, Languages, ListTree, Sigma, Tag } from "lucide-react";

import {
  getKeywordVolumeList,
  getKeywordVolumeObj,
} from "@/app/services/firebase";

import { notFound } from "next/navigation";
import MatchingSiteBar from "../components/matching-site-bar";

import { ClusterAnalysisButton } from "@/app/actions/actions-buttons";
import KeywordClustering from "./keyword-clustering";

import { KeywordVolumeListItem } from "@/app/services/firebase/schema";
import VolumeList from "./volume-list";

export async function generateStaticParams() {
  const data = await getKeywordVolumeList({ limit: 50 });

  if (!data) {
    console.error("Failed to fetch researches for static params");
    return [];
  }

  // Filter out items without an id before mapping
  return data
    .filter((d: KeywordVolumeListItem) => d && d.id)
    .map((d: KeywordVolumeListItem) => ({
      researchId: d.id as string,
    }));
}

// Redefine page props (searchParams are no longer directly used for filtering/pagination here)
interface KeywordResultPageProps {
  params: Promise<{ researchId: string }>;
  searchParams: Promise<{
    // Keep structure but might not use all values
    page?: string;
    filter?: string;
  }>;
}

export default async function KeywordResultPage({
  params,
}: KeywordResultPageProps) {
  const researchId = (await params).researchId;

  const dataObj = await getKeywordVolumeObj({ researchId });

  if (!dataObj) {
    notFound();
  }

  if (!dataObj.id) {
    console.error("[KeywordResultPage] Missing id in dataObj");
    return (
      <div className="text-center p-8 border rounded-lg bg-destructive/10 text-destructive">
        <h3 className="text-xl font-medium mb-2">錯誤：研究數據不完整</h3>
        <p className="text-sm">缺少必要的研究 ID。</p>
      </div>
    );
  }
  const verifiedResearchId = dataObj.id;

  const {
    query,
    totalVolume,
    region,
    language,
    updatedAt,
    tags,
    keywords: originalKeywords,
    clustersWithVolume,
  } = dataObj;

  const hasValidClusters = clustersWithVolume && clustersWithVolume.length > 0;

  // --- Server-side Data Processing (Keep sorting, remove filtering/slicing) ---
  const validKeywords = Array.isArray(originalKeywords) ? originalKeywords : [];
  const uniqueKeywords = Array.from(
    new Map(validKeywords.map((kw) => [kw.text, kw])).values(),
  );
  const sortedUniqueKeywords = [...uniqueKeywords].sort(
    (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0),
  );

  return (
    <>
      {/* --- Page Header (Keep) --- */}
      <div className="flex flex-row items-center gap-4 mb-4 sm:mb-6">
        <h1 className="text-2xl font-semibold text-left">{query}</h1>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center text-lg font-medium text-foreground/90 bg-muted/60 px-3 py-1 rounded-md">
            <Sigma
              size={16}
              className="mr-1.5 flex-shrink-0 text-muted-foreground"
            />
            {formatVolume(totalVolume)}
          </div>
          <MatchingSiteBar region={region ?? ""} />
        </div>
      </div>

      {/* --- Metadata Row (Keep) --- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6 border-b pb-4">
        <div className="flex items-center">
          <Globe className="mr-1.5 h-4 w-4 flex-shrink-0" />
          地區: {region || "未指定"}
        </div>
        <div className="flex items-center">
          <Languages className="mr-1.5 h-4 w-4 flex-shrink-0" />
          語言: {language || "未指定"}
        </div>
        <div className="flex items-center">
          <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
          最後更新:{" "}
          {updatedAt
            ? updatedAt.toLocaleString("zh-TW", {
                timeZone: "Asia/Taipei",
              })
            : "N/A"}
        </div>
        {tags && tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="mr-1 h-4 w-4 flex-shrink-0" />
            {tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* --- Content Area --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Keyword List Display (Client Component) */}
        <div className="md:col-span-1 space-y-3">
          <VolumeList
            keywords={sortedUniqueKeywords} // Pass the full sorted list
            researchId={verifiedResearchId}
          />
        </div>

        {/* Right Column: Clustering (Keep) */}
        <div className="md:col-span-2 space-y-6">
          {/* Section 1: Actions (Keep) */}
          <div className="flex items-center justify-end">
            <ClusterAnalysisButton
              researchId={verifiedResearchId}
              buttonText={hasValidClusters ? "重新分群" : "請求分群"}
            />
          </div>
          {/* Section 3: Clustering Display (Keep) */}
          {hasValidClusters ? (
            <div className="h-full space-y-3">
              <div>
                <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center">
                  <ListTree className="mr-2 h-5 w-5" /> 語義分群結果
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  根據語義相關性對關鍵字進行的分組。
                </p>
              </div>
              <KeywordClustering keywordVolumeObject={dataObj} />
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm p-4 h-full flex items-center justify-center">
              尚未進行分群，或分群結果不可用。點擊上方的「請求分群」按鈕開始。
            </div>
          )}
        </div>
      </div>
    </>
  );
}
