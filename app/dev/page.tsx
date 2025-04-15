/* eslint-disable react/no-unescaped-entities */
import { z } from 'zod'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import React from 'react'
import { cn } from '@/lib/utils'
import SearchButton from './search-button'

const GscDataSchema = z.object({
  site_id: z.string(),
  keyword: z.string(),
  mean_position: z.number(),
  min_position: z.number(),
  max_position: z.number(),
  total_clicks: z.number(),
  total_impressions: z.number(),
  associated_pages: z.array(z.string()),
  overall_ctr: z.number()
})

type GscData = z.infer<typeof GscDataSchema>

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

function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

function getCleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return urlObj.origin + pathname;
  } catch {
    const queryIndex = url.indexOf('?');
    const hashIndex = url.indexOf('#');
    let endIndex = url.length;
    if (queryIndex !== -1) {
      endIndex = queryIndex;
    }
    if (hashIndex !== -1 && hashIndex < endIndex) {
      endIndex = hashIndex;
    }
    let cleanedFallback = url.slice(0, endIndex);
    if (cleanedFallback.length > 1 && cleanedFallback.endsWith('/')) {
      cleanedFallback = cleanedFallback.slice(0, -1);
    }
    return cleanedFallback;
  }
}

function normalizeSiteId(rawSiteId: string): string {
  if (rawSiteId === 'girlstyle_com') {
    return 'girlstyle_com_tw';
  }
  if (rawSiteId === 'holidaysmart_io') {
      return 'holidaysmart_io_hk';
  }
  return rawSiteId;
}

function deduplicateData(data: GscData[]): GscData[] {
  const uniqueKeys = new Set<string>();
  const uniqueDataItems: GscData[] = [];
  data.forEach(item => {
    const normalizedSiteId = normalizeSiteId(item.site_id);
    const cleanUrls = [...new Set(item.associated_pages.map(getCleanUrl))];
    cleanUrls.forEach(url => {
      const key = `${normalizedSiteId}::${url}::${item.keyword}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.add(key);
        uniqueDataItems.push({ ...item, site_id: normalizedSiteId });
      }
    });
  });
  return uniqueDataItems;
}

function processPageData(uniqueDataItems: GscData[]) {
  const aggregatedStatsMap = new Map<string, Map<string, {
    impressions: number;
    clicks: number;
    keywords: Set<string>;
    positions: number[];
    uniqueKeywordData: Map<string, GscData>;
  }>>();

  // 先計算每個站點的總展示次數和頁面數
  const siteTotalImpressions = new Map<string, number>();
  const sitePageCount = new Map<string, Set<string>>();
  uniqueDataItems.forEach(item => {
    const normalizedSiteId = item.site_id;
    const currentTotal = siteTotalImpressions.get(normalizedSiteId) || 0;
    siteTotalImpressions.set(normalizedSiteId, currentTotal + item.total_impressions);
    
    // 計算頁面數
    if (!sitePageCount.has(normalizedSiteId)) {
      sitePageCount.set(normalizedSiteId, new Set());
    }
    const pageSet = sitePageCount.get(normalizedSiteId)!;
    item.associated_pages.forEach(url => {
      pageSet.add(getCleanUrl(url));
    });
  });

  uniqueDataItems.forEach(uniqueItem => {
    const normalizedSiteId = uniqueItem.site_id;
    if (!Array.isArray(uniqueItem.associated_pages) || uniqueItem.associated_pages.length === 0) return;
    
    // 只處理展示次數 >= 10 的數據
    if (uniqueItem.total_impressions < 10) return;
    
    const representativeCleanUrl = getCleanUrl(uniqueItem.associated_pages[0]);

    if (!aggregatedStatsMap.has(normalizedSiteId)) {
      aggregatedStatsMap.set(normalizedSiteId, new Map());
    }
    const aggSiteMap = aggregatedStatsMap.get(normalizedSiteId)!;

    if (!aggSiteMap.has(representativeCleanUrl)) {
      aggSiteMap.set(representativeCleanUrl, {
        impressions: 0,
        clicks: 0,
        keywords: new Set(),
        positions: [],
        uniqueKeywordData: new Map()
      });
    }
    const stats = aggSiteMap.get(representativeCleanUrl)!;

    stats.impressions += uniqueItem.total_impressions;
    stats.clicks += uniqueItem.total_clicks;
    stats.keywords.add(uniqueItem.keyword);
    stats.positions.push(uniqueItem.mean_position);
    stats.uniqueKeywordData.set(uniqueItem.keyword, uniqueItem);
  });

  return Array.from(aggregatedStatsMap.entries())
    .map(([normalizedSiteId, pages]) => {
      if (pages.size === 0) return null;
      const pageEntries = [...pages.entries()];
      if (pageEntries.length === 0) return null;

      pageEntries.sort((a, b) => b[1].impressions - a[1].impressions);
      const [url, stats] = pageEntries[0];

      const siteTotalImpression = siteTotalImpressions.get(normalizedSiteId) || 0;
      const impressionShare = siteTotalImpression > 0 
        ? (stats.impressions / siteTotalImpression) * 100 
        : 0;

      const avgPosition = stats.positions.length > 0 ? stats.positions.reduce((a, b) => a + b, 0) / stats.positions.length : 0;
      const ctr = stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0;
      const sortedKeywords = Array.from(stats.keywords).sort((a, b) => {
        const aData = stats.uniqueKeywordData.get(a);
        const bData = stats.uniqueKeywordData.get(b);
        const impDiff = (bData?.total_impressions ?? 0) - (aData?.total_impressions ?? 0);
        if (impDiff !== 0) return impDiff;
        return (bData?.total_clicks ?? 0) - (aData?.total_clicks ?? 0);
      });
      let pagePath = url;
      try {
         pagePath = decodeURIComponent(new URL(url).pathname);
      } catch {}
      const displayText = pagePath.split('/').pop() || pagePath;

      return {
        site_id: normalizedSiteId,
        url,
        impressionShare,
        total_clicks: stats.clicks,
        total_impressions: stats.impressions,
        ctr,
        avg_position: avgPosition,
        keyword_count: stats.keywords.size,
        keywords: sortedKeywords,
        top_keyword: sortedKeywords[0] || '',
        displayText,
        total_pages: sitePageCount.get(normalizedSiteId)?.size || 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      // 主要按展示量排序
      const impressionsDiff = b.total_impressions - a.total_impressions;
      if (impressionsDiff !== 0) return impressionsDiff;
      // 如果展示量相同，再按展示佔比排序
      return (b.impressionShare ?? 0) - (a.impressionShare ?? 0);
    });
}

type KeywordPerformance = {
  keyword: string;
  impressions: number;
  clicks: number;
};

type SiteKeywordData = {
  siteId: string;
  siteUrl: string;
  totalSiteImpressions: number;
  totalSiteClicks: number;
  avgCtr: number;
  keywords: KeywordPerformance[];
};

function processSiteKeywordData(uniqueDataItems: GscData[]): SiteKeywordData[] {
  const siteKeywordMap = new Map<string, {
    representativeUrl: string | null;
    totalImpressions: number;
    totalClicks: number;
    keywordStats: Map<string, { impressions: number; clicks: number }>;
  }>();

  uniqueDataItems.forEach(item => {
    const siteId = item.site_id;
    if (!siteKeywordMap.has(siteId)) {
      const firstValidUrl = Array.isArray(item.associated_pages) 
          ? item.associated_pages.find(p => p && p.startsWith('http')) || null 
          : null;
          
      siteKeywordMap.set(siteId, {
        representativeUrl: firstValidUrl,
        totalImpressions: 0, 
        totalClicks: 0, 
        keywordStats: new Map()
      });
    }
    const siteData = siteKeywordMap.get(siteId)!;
    if (!siteData.representativeUrl && Array.isArray(item.associated_pages)) {
        siteData.representativeUrl = item.associated_pages.find(p => p && p.startsWith('http')) || null;
    }
    
    siteData.totalImpressions += item.total_impressions;
    siteData.totalClicks += item.total_clicks;

    const keywordData = siteData.keywordStats.get(item.keyword) || { impressions: 0, clicks: 0 };
    keywordData.impressions += item.total_impressions;
    keywordData.clicks += item.total_clicks;
    siteData.keywordStats.set(item.keyword, keywordData);
  });

  const result: SiteKeywordData[] = [];
  siteKeywordMap.forEach((siteData, siteId) => {
    const sortedKeywords: KeywordPerformance[] = Array.from(siteData.keywordStats.entries())
      .map(([keyword, stats]) => ({ keyword, impressions: stats.impressions, clicks: stats.clicks }))
      .sort((a, b) => b.impressions - a.impressions);

    const avgCtr = siteData.totalImpressions > 0
      ? (siteData.totalClicks / siteData.totalImpressions) * 100
      : 0;

    result.push({
      siteId: siteId,
      siteUrl: siteData.representativeUrl || '', 
      totalSiteImpressions: siteData.totalImpressions,
      totalSiteClicks: siteData.totalClicks,
      avgCtr: avgCtr,
      keywords: sortedKeywords
    });
  });

  result.sort((a, b) => b.totalSiteImpressions - a.totalSiteImpressions);
  return result;
}

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

// 預先獲取所有主題的數據
async function fetchAllThemesData() {
  const themesData = await Promise.all(
    Object.entries(PRESET_QUERIES).map(async ([theme, { queries }]) => {
      const data = await fetchGscData(queries);
      return {
        theme,
        data,
      };
    })
  );

  return Object.fromEntries(
    themesData.map(({ theme, data }) => [theme, data])
  );
}

  async function submitQueries(formData: FormData) {
    'use server'
  const queriesStr = formData.get('queries')?.toString() || '';
  const queries = queriesStr.split(/[,\n]/).map(q => q.trim()).filter(Boolean);
  if (queries.length === 0) return;
  redirect(`/dev?queries=${encodeURIComponent(queries.join(','))}`);
}

// 移除靜態頁面設定，改為動態頁面
export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  gscData: [
    {
      site_id: 'holidaysmart_io_hk',
      keyword: '上野公園櫻花現況',
      mean_position: 1.2,
      min_position: 1,
      max_position: 2,
      total_clicks: 420,
      total_impressions: 5482,
      overall_ctr: 7.3,
      associated_pages: ['https://holidaysmart.io/japan/tokyo/ueno-park-sakura']
    },
    {
      site_id: 'holidaysmart_io_hk',
      keyword: '新宿御苑櫻花現況',
      mean_position: 1.8,
      min_position: 1,
      max_position: 3,
      total_clicks: 380,
      total_impressions: 4200,
      overall_ctr: 9.0,
      associated_pages: ['https://holidaysmart.io/japan/tokyo/shinjuku-gyoen-sakura']
    },
    {
      site_id: 'pretty_presslogic_com',
      keyword: '勝尾寺櫻花',
      mean_position: 2.5,
      min_position: 2,
      max_position: 4,
      total_clicks: 180,
      total_impressions: 2620,
      overall_ctr: 6.49,
      associated_pages: ['https://pretty.presslogic.com/japan/osaka/katsuo-ji-temple']
    },
    {
      site_id: 'girlstyle_com_tw',
      keyword: '2025大阪櫻花預測',
      mean_position: 1.0,
      min_position: 1,
      max_position: 1,
      total_clicks: 0,
      total_impressions: 3,
      overall_ctr: 0,
      associated_pages: ['https://girlstyle.com/tw/japan/osaka/sakura-forecast-2025']
    }
  ],
  pageData: [
    {
      site_id: 'holidaysmart_io_hk',
      url: 'https://holidaysmart.io/japan/tokyo/ueno-park-sakura',
      impressionShare: 63.6,
      total_clicks: 420,
      total_impressions: 5482,
      ctr: 7.3,
      avg_position: 1.2,
      keyword_count: 14,
      keywords: ['上野公園櫻花現況', '上野公園櫻花', '上野恩賜公園櫻花', '上野公園櫻花祭', '新宿御苑櫻花現況', '新宿御苑櫻花', '新宿御苑櫻花預約', '六本木櫻花', '六本木 櫻花', '八重洲櫻花通', '飛鳥山公園 櫻花', '大川櫻花遊覽船', '昭和紀念公園櫻花', '吉野山櫻花'],
      top_keyword: '上野公園櫻花現況',
      displayText: 'ueno-park-sakura',
      total_pages: 25
    },
    {
      site_id: 'pretty_presslogic_com',
      url: 'https://pretty.presslogic.com/japan/osaka/katsuo-ji-temple',
      impressionShare: 30.4,
      total_clicks: 180,
      total_impressions: 2620,
      ctr: 6.49,
      avg_position: 2.5,
      keyword_count: 7,
      keywords: ['勝尾寺 櫻花', '勝尾寺櫻花', '八重洲櫻花通', '六本木櫻花', '新宿御苑櫻花現況', '六義園櫻花', '六本木 櫻花'],
      top_keyword: '勝尾寺櫻花',
      displayText: 'katsuo-ji-temple',
      total_pages: 18
    }
  ],
  siteData: [
    {
      siteId: 'holidaysmart_io_hk',
      siteUrl: 'https://holidaysmart.io',
      totalSiteImpressions: 5482,
      totalSiteClicks: 420,
      avgCtr: 7.3,
      keywords: [
        { keyword: '上野公園櫻花現況', impressions: 1200, clicks: 95 },
        { keyword: '新宿御苑櫻花現況', impressions: 980, clicks: 82 },
        { keyword: '八重洲櫻花通', impressions: 850, clicks: 65 },
        { keyword: '六本木櫻花', impressions: 720, clicks: 48 }
      ]
    },
    {
      siteId: 'pretty_presslogic_com',
      siteUrl: 'https://pretty.presslogic.com',
      totalSiteImpressions: 2620,
      totalSiteClicks: 180,
      avgCtr: 6.49,
      keywords: [
        { keyword: '勝尾寺櫻花', impressions: 980, clicks: 75 },
        { keyword: '八重洲櫻花通', impressions: 620, clicks: 42 },
        { keyword: '六本木櫻花', impressions: 580, clicks: 35 }
      ]
    }
  ]
};

export default async function DevPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  // 預先獲取所有主題的數據
  const allThemesData = await fetchAllThemesData();
  
  // 獲取當前選中的主題和查詢
  const resolvedParams = await searchParams;
  const currentTheme = (resolvedParams?.theme as keyof typeof PRESET_QUERIES) || 'beauty';
  const customQueries = resolvedParams?.queries?.toString()?.split(',').filter(Boolean);
  
  // 使用當前主題的數據、自定義查詢的數據，或 mock 資料
  let data;
  let isMockData = false;
  if (customQueries && customQueries.length > 0) {
    data = await fetchGscData(customQueries);
  } else if (resolvedParams?.theme) {
    data = allThemesData[currentTheme];
  } else {
    data = MOCK_DATA.gscData as GscData[];
    isMockData = true;
  }

  const uniqueDataItems = deduplicateData(data);
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
    MOCK_DATA.pageData as ProcessedPageData[] : 
    processPageData(uniqueDataItems);
  const siteKeywordData = isMockData ? 
    MOCK_DATA.siteData as SiteKeywordData[] : 
    processSiteKeywordData(uniqueDataItems);

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
        <h1 className="text-xl font-medium mb-4">
          {isMockData ? (
            <span className="font-mono text-gray-700">範例資料 (輸入關鍵字開始分析)</span>
          ) : (
            <>GSC Data Analysis for: <span className="font-mono text-gray-700">{customQueries?.join(', ') || PRESET_QUERIES[currentTheme].queries.join(', ')}</span></>
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
                  defaultValue={customQueries?.join(', ') || (isMockData ? '' : PRESET_QUERIES[currentTheme].queries.join(', '))}
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
          <div className="mt-2 px-6 flex flex-wrap gap-4 items-center text-xs text-gray-500 font-mono">
            {topPagesBySite.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
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
              {Object.entries(PRESET_QUERIES).map(([key, { label, queries }]) => (
                <a
                  key={key}
                  href={`/dev?theme=${key}`}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono rounded-md transition-colors",
                    "border border-gray-300",
                    "hover:bg-gray-200",
                    currentTheme === key
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
