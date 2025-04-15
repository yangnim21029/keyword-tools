import Image from 'next/image'
import React from 'react'
import { cn } from '@/lib/utils'
import { z } from 'zod'
import {
  GscDataSchema,
  type GscData,
  getFaviconUrl,
  deduplicateData,
  processPageData,
  processSiteKeywordData
} from '../utils'
import { DataTable } from '../components/data-table'
import { KeywordTags } from '../components/keyword-tags'

const PRESET_QUERIES = {
  beauty: {
    label: '4月 Skincare',
    queries: ['面膜', '保養', '精華', '化妝水', '防曬'] as string[]
  },
  travel: {
    label: '4月 櫻花',
    queries: ['櫻花'] as string[]
  },
  lifestyle: {
    label: '4月 食譜',
    queries: ['食譜'] as string[]
  }
} as const;

async function fetchGscData(queries: string[], minImpressions: number = 1): Promise<GscData[]> {
  if (queries.length === 0) return [];
  const response = await fetch('https://gsc-weekly-analyzer-241331030537.asia-east2.run.app/analyze/all', {
    cache: 'force-cache',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      queries,
      min_impressions: minImpressions
    })
  })
  if (!response.ok) {
    console.error('Failed to fetch GSC data:', await response.text());
    throw new Error('Failed to fetch GSC data')
  }
  const data = await response.json()
  return z.array(GscDataSchema).parse(data)
}

export async function generateStaticParams() {
  return Object.keys(PRESET_QUERIES).map((theme) => ({
    theme
  }));
}

type Props = {
  params: Promise<{ theme: keyof typeof PRESET_QUERIES }>
}

export default async function DevPage({ params }: Props) {
  const { theme } = await params;
  const { queries } = PRESET_QUERIES[theme];
  
  // 獲取當前主題的數據
  const data = await fetchGscData(queries);
  const uniqueDataItems = deduplicateData(data);
  const sortedRawData = [...data].sort((a, b) => a.max_position - b.max_position);
  const topPagesBySite = processPageData(uniqueDataItems);
  const siteKeywordData = processSiteKeywordData(uniqueDataItems);

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
  const totalImpressionsInTable = topSitesData.reduce((sum, site) => sum + site.totalSiteImpressions, 0);

  return (
    <>
      <div className="container mx-auto p-4 space-y-4 mb-16">
        <h1 className="text-xl font-medium mb-4">GSC Data Analysis for: <span className="font-mono text-gray-700">{queries.join(', ')}</span></h1>

        <div className="">
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
                    {getFaviconUrl(item.url) && (
                      <Image
                        src={getFaviconUrl(item.url)}
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
          
          <div className="h-4"></div>

          <DataTable
            title="主要流量網站與關鍵字"
            columns={siteKeywordTableColumns}
            data={topSitesData}
            headerClassName="bg-gray-100"
            renderRow={(siteInfo, index) => {
              const faviconUrl = getFaviconUrl(siteInfo.siteUrl);
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
                    <KeywordTags keywords={siteInfo.keywords.slice(0, 15).map(kw => kw.keyword)} />
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
                    {getFaviconUrl(item.url) && (
                      <Image
                        src={getFaviconUrl(item.url)}
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

          <div className="my-8 flex flex-col items-center justify-center border-t border-b border-gray-200 py-6">
            <h3 className="mb-2 text-base font-medium text-gray-700 font-mono">$ VIEW_RAW_DATA</h3>
            <p className="mb-3 text-sm text-gray-500 font-mono">下方顯示未經處理的原始資料，包含完整的排名與流量信息</p>
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
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
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
              {Object.entries(PRESET_QUERIES).map(([key, { label, queries }]) => (
                <a
                  key={key}
                  href={`/dev/${key}`}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono rounded-md transition-colors",
                    "border border-gray-300",
                    "hover:bg-gray-200",
                    theme === key
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-white text-gray-700"
                  )}
                >
                  <span className="opacity-50">$</span> {label}
                  <span className="ml-2 text-xs opacity-50">[{queries.length}]</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 