/* eslint-disable react/no-unescaped-entities */
import { z } from "zod";
import { redirect } from "next/navigation";
import Image from "next/image";
import React from "react";
import { cn } from "@/lib/utils";
import SearchButton from "./search-button";
import Link from "next/link";
import { TopPagesTable } from "./components/TopPagesTable";
import { SiteKeywordTable } from "./components/SiteKeywordTable";
import { RawGscDataTable } from "./components/RawGscDataTable";
import {
  deduplicateData,
  processPageData,
  getFaviconUrl,
  processSiteKeywordData,
  getMockData,
} from "./gsc-action";
import { fetchGscData } from "./gsc-action";
import { getPresetQueries } from "./gsc-action";
import type {
  GscData,
  KeywordPerformance,
  SiteKeywordData,
  PresetQueryType,
  PresetQueryKey,
} from "./gsc-action";

export default async function DevPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 獲取當前選中的查詢
  const resolvedParams = await searchParams;
  const presetQueries = await getPresetQueries();
  const customQueries = resolvedParams?.queries
    ?.toString()
    ?.split(",")
    .filter(Boolean);

  // 使用自定義查詢的數據，或 mock 資料
  let data;
  let isMockData = false;
  const mockData = await getMockData(); // Initialize with default mock data

  if (customQueries && customQueries.length > 0) {
    data = await fetchGscData(customQueries);
  } else {
    data = mockData.gscData as GscData[];
    isMockData = true;
  }

  const uniqueDataItems = await deduplicateData(data);
  const sortedRawData = [...data].sort(
    (a, b) => a.max_position - b.max_position,
  );

  type ProcessedPageData = {
    site_id: string;
    url: string;
    impressionShare: number;
    total_clicks: number;
    total_impressions: number;
    ctr: number;
    avg_position: number;
    keyword_count: number;
    keywords: string[];
    top_keyword: string;
    displayText: string;
    total_pages: number;
  };

  const topPagesBySite: ProcessedPageData[] = isMockData
    ? (mockData.pageData as ProcessedPageData[])
    : await processPageData(uniqueDataItems);
  const siteKeywordData: SiteKeywordData[] = isMockData
    ? (mockData.siteData as SiteKeywordData[])
    : await processSiteKeywordData(uniqueDataItems);

  const topSitesData = siteKeywordData.slice(0, 10);
  const totalImpressionsInTable = topSitesData.reduce(
    (sum: number, site: SiteKeywordData) => sum + site.totalSiteImpressions,
    0,
  );

  // Pre-fetch favicon URLs
  const faviconUrlCache: Map<string, string> = new Map();

  if (!isMockData) {
    for (const item of topPagesBySite) {
      faviconUrlCache.set(item.url, await getFaviconUrl(item.url));
    }

    for (const site of siteKeywordData) {
      if (site.siteUrl) {
        faviconUrlCache.set(site.siteUrl, await getFaviconUrl(site.siteUrl));
      }
    }
  }

  return (
    <>
      <div className="container mx-auto p-4 space-y-4 mb-16">
        <h1 className="text-xl font-medium mb-4">
          {isMockData ? (
            <span className="font-mono text-gray-700">
              範例資料 (輸入關鍵字開始分析)
            </span>
          ) : (
            <>
              GSC Data Analysis for:{" "}
              <span className="font-mono text-gray-700">
                {customQueries?.join(", ")}
              </span>
            </>
          )}
        </h1>

        <div className="border border-gray-300 bg-white rounded-md shadow-md overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-gray-700 text-xs font-mono tracking-wider uppercase">
                查詢終端
              </span>
            </div>
            <span className="text-gray-600 text-xs font-mono">
              GSC_QUERY.v1.0
            </span>
          </div>
          <div className="p-4">
            <form action={submitQueries} className="space-y-3">
              <div>
                <label
                  htmlFor="queriesInput"
                  className="block text-xs font-mono text-gray-700 uppercase tracking-wider mb-2"
                >
                  $ INPUT_SEARCH_TERMS (以逗號或換行分隔)
                </label>
                <input
                  type="text"
                  id="queriesInput"
                  name="queries"
                  defaultValue={customQueries?.join(", ") || ""}
                  className="block w-full px-4 py-2 border border-gray-300 rounded-md font-mono text-gray-700 bg-gray-50 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="例如：護手霜, 保養品"
                />
              </div>
              <div className="flex justify-end">
                <SearchButton />
              </div>
            </form>
          </div>
        </div>

        <p className="my-2 px-6 text-xs text-gray-500 font-mono">
          <span className="text-gray-700">*</span> '使用上週數據'
        </p>

        {isMockData && (
          <div className="my-2 px-6 text-xs text-gray-500 font-mono">
            <span className="text-gray-700">$</span>{" "}
            <span className="font-bold">VIEW_DEMO_DATA</span> -
            以下為示範資料，輸入關鍵字後可查看實際分析結果
          </div>
        )}

        <div className="h-2"></div>

        <div className="">
          {isMockData && (
            <>
              <div className="fixed inset-0 pointer-events-none z-10 flex items-center justify-center">
                <div className="transform -rotate-12 text-gray-200 text-[160px] font-bold opacity-20 select-none tracking-wider">
                  示範資料
                </div>
              </div>
              <div className="my-8 flex flex-col items-center justify-center border-t border-b border-gray-200 py-6 relative">
                <div className="absolute inset-0 bg-gray-50/50"></div>
                <div className="relative z-20">
                  <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">
                    $ VIEW_SAMPLE_DATA
                  </h3>
                  <p className="mb-3 text-sm text-gray-500 font-mono">
                    以下為示範資料，輸入關鍵字後可查看實際分析結果
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
                    className="animate-bounce text-gray-500 mx-auto"
                  >
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </div>
              </div>
            </>
          )}

          <TopPagesTable
            data={topPagesBySite}
            faviconUrlCache={faviconUrlCache}
          />

          <div className="h-4"></div>

          <SiteKeywordTable
            data={topSitesData}
            faviconUrlCache={faviconUrlCache}
            totalImpressionsInTable={totalImpressionsInTable}
          />

          <div className="mt-2 px-1 flex flex-wrap gap-4 items-center text-xs text-gray-500 font-mono">
            {topPagesBySite.map((item, index) => (
              <div key={index} className="flex items-center gap-1">
                {faviconUrlCache.get(item.url) && (
                  <Image
                    src={faviconUrlCache.get(item.url) || ""}
                    alt=""
                    width={12}
                    height={12}
                    className="w-3 h-3 flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <span className="text-gray-700">{item.site_id}:</span>
                <span className="text-gray-500">{item.total_pages} 頁</span>
              </div>
            ))}
          </div>

          <div className="h-4"></div>

          <div
            className={cn(
              "my-8 flex flex-col items-center justify-center border-t border-b border-gray-200 py-6",
              isMockData && "relative",
            )}
          >
            {isMockData && (
              <div className="absolute inset-0 bg-gray-50/30 pointer-events-none"></div>
            )}
            <div className="relative z-20">
              <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">
                $ VIEW_RAW_DATA
              </h3>
              <p className="mb-3 text-sm text-gray-500 font-mono">
                {isMockData
                  ? "以下為示範的原始資料格式"
                  : "下方顯示未經處理的原始資料，包含完整的排名與流量信息"}
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
                className="animate-bounce text-gray-500 mx-auto"
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
          </div>

          <RawGscDataTable data={sortedRawData} />
        </div>
      </div>

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
                  <Link
                    key={key}
                    href={`/dev/${key}`}
                    className={cn(
                      "px-3 py-1.5 text-xs font-mono rounded-md transition-colors",
                      "border border-gray-300",
                      "hover:bg-gray-200",
                      customQueries?.join(",") === queries.join(",")
                        ? "bg-gray-700 text-white border-gray-700"
                        : "bg-white text-gray-700",
                    )}
                  >
                    <span className="opacity-50">$</span> {label}
                    <span className="ml-2 text-xs opacity-50">
                      [{queries.length}]
                    </span>
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

async function submitQueries(formData: FormData) {
  "use server";
  const queriesStr = formData.get("queries")?.toString() || "";
  const queries = queriesStr
    .split(/[\n,]/)
    .map((q) => q.trim())
    .filter(Boolean);
  if (queries.length === 0) return;
  redirect(`/dev?queries=${encodeURIComponent(queries.join(","))}`);
}
