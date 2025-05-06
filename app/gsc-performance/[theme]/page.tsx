import Image from "next/image";
import React from "react";
import { cn } from "@/lib/utils";
import { getThemeData } from "../gsc-action";
import {
  getFaviconUrl,
  getPresetQueries,
  generateAiAnalysis,
} from "../gsc-action";
import { DataTable } from "../components/data-table";
import { KeywordTags } from "../components/keyword-tags";
import { Suspense } from "react";
import { RawTable } from "../components/raw-table";
import type { PresetQueryType } from "../gsc-action";
import { AiAnalysisDialog } from "../components/ai-analysis-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

// 強制使用靜態生成
export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const presetQueries = await getPresetQueries();
  return Object.keys(presetQueries).map((theme) => ({
    theme,
  }));
}

type Props = {
  params: Promise<{ theme: string }>;
};

async function ThemeDataContent({ theme }: { theme: string }) {
  const presetQueries = await getPresetQueries();
  const { topPagesBySite, siteKeywordData } = await getThemeData(theme);

  const topPagesColumns = [
    { key: "rank", label: "排名" },
    { key: "site", label: "網站" },
    { key: "page", label: "頁面" },
    { key: "impressionShare", label: "單頁面全站展示佔比 (%)" },
    { key: "topKeyword", label: "最高流量詞" },
    { key: "keywordCount", label: "關鍵字數" },
    { key: "keywords", label: "關鍵字 (依展示排序)" },
  ];

  const siteKeywordTableColumns = [
    { key: "rank", label: "排名" },
    { key: "siteId", label: "網站" },
    { key: "totalImpressions", label: "總展示" },
    { key: "impressionShare", label: "展示佔比 (%)" },
    { key: "avgCtr", label: "平均 CTR (%)" },
    { key: "topKeywords", label: "主要關鍵字 (依展示排序)" },
  ];

  const pagesSortedByImpressions = [...topPagesBySite].sort(
    (a, b) => b.total_impressions - a.total_impressions,
  );

  // Pre-fetch favicon URLs
  const faviconUrlCache: Map<string, string> = new Map();

  // Pre-fetch all favicon URLs
  for (const item of topPagesBySite) {
    faviconUrlCache.set(item.url, await getFaviconUrl(item.url));
  }

  for (const site of siteKeywordData) {
    if (site.siteUrl) {
      faviconUrlCache.set(site.siteUrl, await getFaviconUrl(site.siteUrl));
    }
  }

  const topSitesData = siteKeywordData.slice(0, 10);
  const totalImpressionsInTable = topSitesData.reduce(
    (sum, site) => sum + site.totalSiteImpressions,
    0,
  );

  return (
    <div className="space-y-4 relative">
      <div className="absolute top-0 right-0 p-4">
        <AiAnalysisDialog theme={theme} />
      </div>

      <DataTable
        title="主要流量網站與關鍵字"
        columns={siteKeywordTableColumns}
        data={topSitesData}
        headerClassName="bg-gray-100"
        renderRow={(siteInfo, index) => {
          const faviconUrl = siteInfo.siteUrl
            ? faviconUrlCache.get(siteInfo.siteUrl)
            : null;
          const percentage =
            totalImpressionsInTable > 0
              ? (siteInfo.totalSiteImpressions / totalImpressionsInTable) * 100
              : 0;
          return (
            <tr
              key={index}
              className="hover:bg-gray-50 text-sm border-b border-gray-200"
            >
              <td className="px-4 py-1.5 text-right font-mono text-gray-700">
                {index + 1}
              </td>
              <td className="px-4 py-1.5">
                <div className="flex items-center gap-2">
                  {faviconUrl && (
                    <Image
                      src={faviconUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 flex-shrink-0"
                      loading="lazy"
                    />
                  )}
                  <span className="text-gray-700 font-mono">
                    {siteInfo.siteId}
                  </span>
                </div>
              </td>
              <td className="px-4 py-1.5 text-right font-mono text-gray-700">
                {siteInfo.totalSiteImpressions.toLocaleString()}
              </td>
              <td className="px-4 py-1.5 text-right font-mono text-gray-700">
                {percentage.toFixed(1)}%
              </td>
              <td className="px-4 py-1.5 text-right font-mono text-gray-700">
                {siteInfo.avgCtr.toFixed(2)}%
              </td>
              <td className="px-4 py-1.5 min-w-[250px]">
                <KeywordTags
                  keywords={siteInfo.keywords
                    .slice(0, 15)
                    .map((kw) => kw.keyword)}
                />
              </td>
            </tr>
          );
        }}
      />

      <div className="h-4"></div>

      {/* Reordered Table 2: 最佳曝光頁面 (Formerly 各站最高流量頁面) - Sorted by Impressions */}
      <DataTable
        title="最佳曝光頁面"
        columns={topPagesColumns}
        data={pagesSortedByImpressions}
        headerClassName="bg-gray-100"
        renderRow={(item, index) => (
          <tr
            key={index}
            className="hover:bg-gray-50 text-sm border-b border-gray-200"
          >
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {index + 1}
            </td>
            <td className="px-4 py-1.5 text-gray-700 font-mono">
              {item.site_id}
            </td>
            <td className="px-4 py-1.5">
              <div className="flex items-center gap-2">
                {faviconUrlCache.get(item.url) && (
                  <Image
                    src={faviconUrlCache.get(item.url) || ""}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[300px] font-mono"
                >
                  {item.displayText}
                </a>
              </div>
            </td>
            <td className="px-4 py-1.5 text-right font-mono text-gray-700">
              {item.impressionShare.toFixed(1)}%
            </td>
            <td className="px-4 py-1.5 text-gray-700 font-mono">
              {item.top_keyword}
            </td>
            <td className="px-4 py-1.5 text-right">
              <div className="flex items-center justify-end gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${
                    item.keyword_count > 30
                      ? "bg-yellow-500"
                      : item.keyword_count > 20
                        ? "bg-yellow-400"
                        : item.keyword_count > 10
                          ? "bg-yellow-300"
                          : "bg-yellow-200"
                  }`}
                ></span>
                <span className="font-mono text-yellow-600 text-xs">
                  {item.keyword_count}
                </span>
              </div>
            </td>
            <td className="px-4 py-1.5 min-w-[250px]">
              <KeywordTags keywords={item.keywords.slice(0, 15)} />
            </td>
          </tr>
        )}
      />

      <div className="h-4"></div>

      <div className="my-8 flex flex-col items-center justify-center border-t border-b border-gray-200 py-6">
        <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">
          $ VIEW_RAW_DATA
        </h3>
        <p className="mb-3 text-sm text-gray-500 font-mono">
          下方顯示未經處理的原始資料，包含完整的排名與流量信息
        </p>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-bounce text-gray-500"
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="raw-data">
          <AccordionTrigger className="text-sm font-mono text-gray-600 hover:no-underline justify-center">
            展開/摺疊 原始資料表
          </AccordionTrigger>
          <AccordionContent>
            <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
              <Suspense fallback={<div>Loading raw data...</div>}>
                <RawTable
                  theme={theme}
                  queries={
                    presetQueries[theme as keyof typeof presetQueries].queries
                  }
                />
              </Suspense>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default async function DevPage({ params }: Props) {
  const { theme } = await params;
  const presetQueries = await getPresetQueries();

  return (
    <div className="container mx-auto p-4 space-y-4 mb-16 relative">
      <h1 className="text-xl font-medium mb-4">
        GSC Data Analysis for:{" "}
        <span className="font-mono text-gray-700">
          {presetQueries[theme as keyof typeof presetQueries].queries.join(
            ", ",
          )}
        </span>
      </h1>

      <Suspense
        fallback={
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        }
      >
        <ThemeDataContent theme={theme} />
      </Suspense>

      {/* 固定在底部的預設查詢 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-gray-500 mr-4">
              PRESET_QUERIES
            </span>
            <div className="flex gap-2">
              {Object.entries(presetQueries).map(
                ([key, { label, queries }]) => (
                  <a
                    key={key}
                    href={`/dev/${key}`}
                    className={cn(
                      "px-3 py-1.5 text-xs font-mono rounded-md transition-colors",
                      "border border-gray-300",
                      "hover:bg-gray-200",
                      theme === key
                        ? "bg-gray-700 text-white border-gray-700"
                        : "bg-white text-gray-700",
                    )}
                  >
                    <span className="opacity-50">$</span> {label}
                    <span className="ml-2 text-xs opacity-50">
                      [{queries.length}]
                    </span>
                  </a>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
