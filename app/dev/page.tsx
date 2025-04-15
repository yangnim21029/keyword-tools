/* eslint-disable react/no-unescaped-entities */
import { z } from 'zod'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import React from 'react'
import { cn } from '@/lib/utils'
import SearchButton from './search-button'
import Link from 'next/link'
import {    
    deduplicateData,
    processPageData,
    getFaviconUrl,
    processSiteKeywordData,
    getMockData
} from './gsc-action'
import { fetchGscData } from './gsc-action'
import { getPresetQueries } from './gsc-action'
import type { GscData, KeywordPerformance, SiteKeywordData, PresetQueryType, PresetQueryKey } from './gsc-action'

function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  renderRow,
  headerClassName
}: {
  title: string;
  columns: { key: string; label: string }[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  headerClassName?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto border border-gray-300 bg-white rounded-md shadow-md">
        <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-gray-700 text-xs font-mono tracking-wider uppercase">{title}</span>
          </div>
          <span className="text-gray-600 text-xs font-mono">GSC_ANALYZER.v1.0</span>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className={cn("bg-gray-100", headerClassName)}>
              {columns.map(column => (
                <th
                  key={column.key}
                  className="px-4 py-2 text-left text-xs font-mono text-gray-700 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>
      {title && (
        <p className="my-2 px-6 text-xs text-gray-500 font-mono">
          <span className="text-gray-700">*</span> {title}
        </p>
      )}
    </>
  )
}

function KeywordTags({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1 overflow-hidden sm:max-h-none sm:overflow-visible">
      {keywords.map((keyword, i) => (
        <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700 font-mono border border-gray-200">
          {keyword}
        </span>
      ))}
    </div>
  )
}

export default async function DevPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  // 獲取當前選中的查詢
  const resolvedParams = await searchParams;
  const presetQueries = await getPresetQueries();
  const customQueries = resolvedParams?.queries?.toString()?.split(',').filter(Boolean);
  
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
  const sortedRawData = [...data].sort((a, b) => a.max_position - b.max_position);
  
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

  const topPagesBySite: ProcessedPageData[] = isMockData ? 
    mockData.pageData as ProcessedPageData[] : 
    await processPageData(uniqueDataItems);
  const siteKeywordData: SiteKeywordData[] = isMockData ? 
    mockData.siteData as SiteKeywordData[] : 
    await processSiteKeywordData(uniqueDataItems);

  const topPagesColumns = [
    { key: 'rank', label: '排名' },
    { key: 'site', label: '網站' },
    { key: 'page', label: '頁面' },
    { key: 'impressionShare', label: '單頁面全站展示佔比 (%)' },
    { key: 'topKeyword', label: '最高流量詞' }
  ];
  const mostKeywordsColumns = [
      { key: 'rank', label: '排名' }, { key: 'page', label: '頁面' },
      { key: 'keywordCount', label: '關鍵字數' }, { key: 'keywords', label: '關鍵字 (依展示排序)' }
  ];
  const rawDataColumns = [
      { key: 'site_id', label: '網站' }, { key: 'keyword', label: '關鍵字' },
      { key: 'mean_position', label: '平均排名' }, { key: 'min_position', label: '最低排名' }, { key: 'max_position', label: '最高排名' },
      { key: 'total_clicks', label: '點擊' }, { key: 'total_impressions', label: '展示' },
      { key: 'overall_ctr', label: 'CTR (%)' }, { key: 'associated_pages', label: '關聯頁面' },
  ];
  const siteKeywordTableColumns = [
      { key: 'rank', label: '排名' }, 
      { key: 'siteId', label: '網站' }, 
      { key: 'totalImpressions', label: '總展示' }, 
      { key: 'impressionShare', label: '展示佔比 (%)' },
      { key: 'avgCtr', label: '平均 CTR (%)'},
      { key: 'topKeywords', label: '主要關鍵字 (依展示排序)' }
  ];

  const pagesSortedByKeywordCount = [...topPagesBySite]
    .sort((a, b) => b.keyword_count - a.keyword_count)
    .slice(0, 10);
  const topSitesData = siteKeywordData.slice(0, 10);
  const totalImpressionsInTable = topSitesData.reduce((sum: number, site: SiteKeywordData) => sum + site.totalSiteImpressions, 0);

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
            <span className="font-mono text-gray-700">範例資料 (輸入關鍵字開始分析)</span>
          ) : (
            <>GSC Data Analysis for: <span className="font-mono text-gray-700">{customQueries?.join(', ')}</span></>
          )}
        </h1>

        <div className="border border-gray-300 bg-white rounded-md shadow-md overflow-hidden">
          <div className="px-4 py-2 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-gray-700 text-xs font-mono tracking-wider uppercase">查詢終端</span>
            </div>
            <span className="text-gray-600 text-xs font-mono">GSC_QUERY.v1.0</span>
          </div>
          <div className="p-4">
            <form action={submitQueries} className="space-y-3">
              <div>
                <label htmlFor="queriesInput" className="block text-xs font-mono text-gray-700 uppercase tracking-wider mb-2">
                  $ INPUT_SEARCH_TERMS (以逗號或換行分隔)
                </label>
                <input
                  type="text"
                  id="queriesInput"
                  name="queries"
                  defaultValue={customQueries?.join(', ') || ''}
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
            <span className="text-gray-700">$</span> <span className="font-bold">VIEW_DEMO_DATA</span> - 以下為示範資料，輸入關鍵字後可查看實際分析結果
          </div>
        )}

        <div className='h-2'></div>
        
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
                  <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">$ VIEW_SAMPLE_DATA</h3>
                  <p className="mb-3 text-sm text-gray-500 font-mono">以下為示範資料，輸入關鍵字後可查看實際分析結果</p>
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
                    <path d="M12 5v14M5 12l7 7 7-7"/>
                  </svg>
                </div>
              </div>
            </>
          )}

          <DataTable
            title="各站最高流量頁面"
            columns={topPagesColumns}
            data={topPagesBySite}
            headerClassName="bg-gray-100"
            renderRow={(item, index) => (
              <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{index + 1}</td>
                <td className="px-4 py-1.5 text-gray-700 font-mono">{item.site_id}</td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {faviconUrlCache.get(item.url) && (
                      <Image
                        src={faviconUrlCache.get(item.url) || ''}
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
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.impressionShare.toFixed(1)}%</td>
                <td className="px-4 py-1.5 text-gray-700 font-mono">{item.top_keyword}</td>
              </tr>
            )}
          />
          <div className="mt-2 px-6 flex flex-wrap gap-4 items-center text-xs text-gray-500 font-mono">
            {topPagesBySite.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                {faviconUrlCache.get(item.url) && (
                  <Image
                    src={faviconUrlCache.get(item.url) || ''}
                    alt=""
                    width={16}
                    height={16}
                    className="w-4 h-4 flex-shrink-0"
                    loading="lazy"
                  />
                )}
                <span className="text-gray-700">{item.site_id}</span>
                <span className="text-gray-500">({item.total_pages} 頁)</span>
              </div>
            ))}
          </div>
          
          <div className="h-4"></div>

        <DataTable
            title="主要流量網站與關鍵字"
          columns={siteKeywordTableColumns}
          data={topSitesData}
            headerClassName="bg-gray-100"
          renderRow={(siteInfo, index) => {
            const faviconUrl = siteInfo.siteUrl ? faviconUrlCache.get(siteInfo.siteUrl) : null;
            const percentage = totalImpressionsInTable > 0
              ? (siteInfo.totalSiteImpressions / totalImpressionsInTable) * 100
              : 0;
            return (
                <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
                  <td className="px-4 py-1.5 text-right font-mono text-gray-700">{index + 1}</td>
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
                      <span className="text-gray-700 font-mono">{siteInfo.siteId}</span>
                  </div>
                </td>
                  <td className="px-4 py-1.5 text-right font-mono text-gray-700">{siteInfo.totalSiteImpressions.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-gray-700">{percentage.toFixed(1)}%</td>
                  <td className="px-4 py-1.5 text-right font-mono text-gray-700">{siteInfo.avgCtr.toFixed(2)}%</td>
                  <td className="px-4 py-1.5 min-w-[250px]">
                  <KeywordTags keywords={siteInfo.keywords.slice(0, 15).map((kw: KeywordPerformance) => kw.keyword)} />
                </td>
              </tr>
            );
          }}
        />
          
        <div className='h-2'></div>

        <DataTable
            title="包含最多關鍵字的頁面"
          columns={mostKeywordsColumns}
          data={pagesSortedByKeywordCount}
            headerClassName="bg-gray-100"
          renderRow={(item, index) => (
              <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{index + 1}</td>
              <td className="px-4 py-1.5">
                  <div className="flex items-center gap-2">
                    {faviconUrlCache.get(item.url) && (
                      <Image
                        src={faviconUrlCache.get(item.url) || ''}
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
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      item.keyword_count > 30 ? "bg-yellow-500" : 
                      item.keyword_count > 20 ? "bg-yellow-400" : 
                      item.keyword_count > 10 ? "bg-yellow-300" : "bg-yellow-200"
                    }`}></span>
                    <span className="font-mono text-yellow-600">{item.keyword_count}</span>
                  </div>
              </td>
                <td className="px-4 py-1.5 min-w-[250px]">
                <KeywordTags keywords={item.keywords} />
              </td>
            </tr>
          )}
        />

          <div className={cn("my-8 flex flex-col items-center justify-center border-t border-b border-gray-200 py-6", isMockData && "relative")}>
            {isMockData && <div className="absolute inset-0 bg-gray-50/30 pointer-events-none"></div>}
            <div className="relative z-20">
              <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">$ VIEW_RAW_DATA</h3>
              <p className="mb-3 text-sm text-gray-500 font-mono">{isMockData ? '以下為示範的原始資料格式' : '下方顯示未經處理的原始資料，包含完整的排名與流量信息'}</p>
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
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
            </div>
          </div>

        <DataTable
            title="原始 GSC 數據 (依最高排名排序)"
          columns={rawDataColumns}
            data={sortedRawData}
            headerClassName="bg-gray-100"
          renderRow={(item, index) => (
              <tr key={index} className="hover:bg-gray-50 text-sm border-b border-gray-200">
                <td className="px-4 py-1.5 font-mono text-gray-700">{item.site_id}</td>
                <td className="px-4 py-1.5 font-mono text-gray-700">{item.keyword}</td>
                <td className="px-4 py-1.5 text-right">
                  <span className={`px-1.5 py-0.5 rounded font-mono ${
                    item.mean_position <= 3 ? "bg-green-100 text-green-800" : 
                    item.mean_position <= 10 ? "bg-blue-100 text-blue-800" : 
                    item.mean_position <= 20 ? "bg-yellow-100 text-yellow-800" : 
                    "bg-red-100 text-red-800"
                  }`}>
                    {item.mean_position.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.min_position.toFixed(1)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.max_position.toFixed(1)}</td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.total_clicks.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{item.total_impressions.toLocaleString()}</td>
                <td className="px-4 py-1.5 text-right font-mono text-gray-700">{(item.overall_ctr).toFixed(2)}%</td>
                <td className="px-4 py-1.5 text-xs max-w-[250px]">
                  {Array.isArray(item.associated_pages) && item.associated_pages.length > 0 ? (
                    <ul className="list-disc pl-4 space-y-0.5 font-mono">
                      {item.associated_pages.slice(0, 3).map((url, i) => {
                        let displayText;
                        try {
                          const pathname = decodeURIComponent(new URL(url).pathname);
                          displayText = pathname.split('/').pop() || pathname;
                        } catch {
                          displayText = url.split('/').pop() || url;
                        }
                        
                        return (
                          <li key={i} className="truncate">
                            <a 
                              href={url} 
                              target="_blank"
                              rel="noopener noreferrer" 
                              className="hover:underline text-blue-600"
                            >
                              {displayText}
                            </a>
                          </li>
                        );
                      })}
                      {item.associated_pages.length > 3 && (
                        <li className="text-gray-500 text-xs">
                          +{item.associated_pages.length - 3} 個更多頁面
                        </li>
                      )}
                    </ul>
                  ) : '無關聯頁面'}
              </td>
            </tr>
          )}
        />
      </div>
    </div>

      {/* 固定在底部的預設查詢 tabs */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 py-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <span className="text-xs font-mono text-gray-500 mr-4">PRESET_QUERIES</span>
            <div className="flex gap-2">
              {Object.entries(presetQueries).map(([key, { label, queries }]) => (
                <Link
                  key={key}
                  href={`/dev/${key}`}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono rounded-md transition-colors",
                    "border border-gray-300",
                    "hover:bg-gray-200",
                    customQueries?.join(',') === queries.join(',')
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-white text-gray-700"
                  )}
                >
                  <span className="opacity-50">$</span> {label}
                  <span className="ml-2 text-xs opacity-50">[{queries.length}]</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

async function submitQueries(formData: FormData) {
  'use server'
  const queriesStr = formData.get('queries')?.toString() || '';
  const queries = queriesStr.split(/[,\n]/).map(q => q.trim()).filter(Boolean);
  if (queries.length === 0) return;
  redirect(`/dev?queries=${encodeURIComponent(queries.join(','))}`);
}
