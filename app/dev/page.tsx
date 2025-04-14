/* eslint-disable react/no-unescaped-entities */
import { z } from 'zod'
import { redirect } from 'next/navigation'
import Image from 'next/image'

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

  uniqueDataItems.forEach(uniqueItem => {
    const normalizedSiteId = uniqueItem.site_id;
    if (!Array.isArray(uniqueItem.associated_pages) || uniqueItem.associated_pages.length === 0) return;
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
      const [url, stats] = pageEntries.sort((a, b) => b[1].impressions - a[1].impressions)[0];
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
      const displayText = pagePath.split('/').pop() || pagePath
      return {
        site_id: normalizedSiteId,
        url,
        total_impressions: stats.impressions,
        total_clicks: stats.clicks,
        ctr,
        avg_position: avgPosition,
        keyword_count: stats.keywords.size,
        keywords: sortedKeywords,
        top_keyword: sortedKeywords[0] || '',
        displayText: displayText,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (b.total_impressions ?? 0) - (a.total_impressions ?? 0));
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

    result.push({
      siteId: siteId,
      siteUrl: siteData.representativeUrl || '', 
      totalSiteImpressions: siteData.totalImpressions,
      totalSiteClicks: siteData.totalClicks,
      keywords: sortedKeywords
    });
  });

  result.sort((a, b) => b.totalSiteImpressions - a.totalSiteImpressions);
  return result;
}

function PageLink({ url, displayText }: { url: string; displayText: string }) {
  const faviconUrl = getFaviconUrl(url)
  return (
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
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[300px]"
      >
        {displayText}
      </a>
    </div>
  )
}

function DataTable<T extends Record<string, any>>({
  title,
  columns,
  data,
  renderRow
}: {
  title: string;
  columns: { key: string; label: string }[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-100">
              {columns.map(column => (
                <th key={column.key} className="px-4 py-2 text-left">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => renderRow(item, index))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KeywordTags({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keywords.map((keyword, i) => (
        <span key={i} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
          {keyword}
        </span>
      ))}
    </div>
  )
}

export default async function DevPage({ searchParams }: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  async function submitQueries(formData: FormData) {
    'use server'
    
    const queriesInput = formData.get('queries') as string || ''
    const queries = queriesInput.split(/[,\n]+/).map(q => q.trim()).filter(q => q !== '')

    const newSearchParams = new URLSearchParams()
    queries.forEach(q => newSearchParams.append('q', q))

    redirect(`/dev?${newSearchParams.toString()}`)
  }

  const currentSearchParams = await searchParams;

  let currentQueries: string[] = [];
  const qParam = currentSearchParams?.q;
  if (typeof qParam === 'string') {
    currentQueries = [qParam];
  } else if (Array.isArray(qParam)) {
    currentQueries = qParam;
  }

  if (currentQueries.length === 0) {
    currentQueries = ['面膜', '保養', '精華'];
  }

  const data = await fetchGscData(currentQueries)
  const uniqueDataItems = deduplicateData(data)
  const topPagesBySite = processPageData(uniqueDataItems)
  const siteKeywordData = processSiteKeywordData(uniqueDataItems)

  const topPagesColumns = [
    { key: 'rank', label: '排名' },
    { key: 'site', label: '網站' },
    { key: 'page', label: '頁面' },
    { key: 'impressions', label: '展示' },
    { key: 'clicks', label: '點擊' },
    { key: 'ctr', label: 'CTR' },
    { key: 'position', label: '排名' },
    { key: 'keywordCount', label: '詞數' },
    { key: 'topKeyword', label: '最高流量詞' }
  ]

  const mostKeywordsColumns = [
      { key: 'rank', label: '排名' },
      { key: 'page', label: '頁面' },
      { key: 'keywordCount', label: '關鍵字數' },
      { key: 'keywords', label: '關鍵字 (依展示排序)' }
  ]

  const rawDataColumns = [
      { key: 'site_id', label: '網站' },
      { key: 'keyword', label: '關鍵字' },
      { key: 'mean_position', label: '平均排名' },
      { key: 'min_position', label: '最低排名' },
      { key: 'max_position', label: '最高排名' },
      { key: 'total_clicks', label: '點擊' },
      { key: 'total_impressions', label: '展示' },
      { key: 'overall_ctr', label: 'CTR (%)' },
      { key: 'associated_pages', label: '關聯頁面' },
  ]

  // Create a new array sorted by keyword count for the "Most Keywords" table
  const pagesSortedByKeywordCount = [...topPagesBySite]
    .sort((a, b) => b.keyword_count - a.keyword_count)
    .slice(0, 10);

  // Get top N sites for keyword breakdown
  const topSitesData = siteKeywordData.slice(0, 10); // Show top 10 sites

  // NEW: Define columns for the Site Keyword Table
  const siteKeywordTableColumns = [
      { key: 'rank', label: '排名' }, 
      { key: 'siteId', label: '網站' }, 
      { key: 'totalImpressions', label: '總展示' }, 
      { key: 'impressionShare', label: '總展示佔比 (%)' },
      { key: 'totalClicks', label: '總點擊' }, 
      { key: 'topKeywords', label: '主要關鍵字 (依展示排序)' }
  ];

  // Calculate total impressions *only for the sites displayed in this table*
  const totalImpressionsInTable = topSitesData.reduce((sum, site) => sum + site.totalSiteImpressions, 0);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <form action={submitQueries} className="mb-6 space-y-2">
         <label htmlFor="queriesInput" className="block text-sm font-medium text-gray-700">
           輸入查詢關鍵字 (以逗號或換行分隔)
         </label>
         <input
           type="text"
           id="queriesInput"
           name="queries"
           defaultValue={currentQueries.join(', ')}
           className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
           placeholder="例如：面膜, 保養, 精華"
         />
         <button
           type="submit"
           className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
         >
          查詢
        </button>
      </form>

      <h1 className="text-xl font-bold">GSC Data Analysis for: {currentQueries.join(', ')}</h1>

      <DataTable
        title="各站最高流量頁面 (依頁面展示排序)"
        columns={topPagesColumns}
        data={topPagesBySite}
        renderRow={(item, index) => (
          <tr key={index} className="hover:bg-gray-50 text-sm">
            <td className="px-4 py-1.5">{index + 1}</td>
            <td className="px-4 py-1.5">{item.site_id}</td>
            <td className="px-4 py-1.5">
              <PageLink url={item.url} displayText={item.displayText} />
            </td>
            <td className="px-4 py-1.5 text-right">{item.total_impressions.toLocaleString()}</td>
            <td className="px-4 py-1.5 text-right">{item.total_clicks.toLocaleString()}</td>
            <td className="px-4 py-1.5 text-right">{item.ctr.toFixed(2)}%</td>
            <td className="px-4 py-1.5 text-right">{item.avg_position.toFixed(1)}</td>
            <td className="px-4 py-1.5 text-right">{item.keyword_count}</td>
            <td className="px-4 py-1.5">{item.top_keyword}</td>
          </tr>
        )}
      />

      <DataTable
        title="主要流量網站與關鍵字 (依網站總展示排序)"
        columns={siteKeywordTableColumns}
        data={topSitesData}
        renderRow={(siteInfo, index) => {
          const faviconUrl = getFaviconUrl(siteInfo.siteUrl);
          // Calculate percentage share
          const percentage = totalImpressionsInTable > 0
            ? (siteInfo.totalSiteImpressions / totalImpressionsInTable) * 100
            : 0;
          return (
            <tr key={index} className="hover:bg-gray-50 text-sm">
              <td className="px-4 py-1.5">{index + 1}</td>
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
                  <span>{siteInfo.siteId}</span>
                </div>
              </td>
              <td className="px-4 py-1.5 text-right">{siteInfo.totalSiteImpressions.toLocaleString()}</td>
              <td className="px-4 py-1.5 text-right">{percentage.toFixed(1)}%</td>
              <td className="px-4 py-1.5 text-right">{siteInfo.totalSiteClicks.toLocaleString()}</td>
              <td className="px-4 py-1.5">
                <KeywordTags keywords={siteInfo.keywords.slice(0, 15).map(kw => kw.keyword)} />
              </td>
            </tr>
          );
        }}
      />

      <DataTable
        title="包含最多關鍵字的頁面 (取前10頁，依關鍵字數量排序)"
        columns={mostKeywordsColumns}
        data={pagesSortedByKeywordCount}
        renderRow={(item, index) => (
          <tr key={index} className="hover:bg-gray-50 text-sm">
            <td className="px-4 py-1.5">{index + 1}</td>
            <td className="px-4 py-1.5">
              <PageLink url={item.url} displayText={item.displayText} />
            </td>
            <td className="px-4 py-1.5 text-right">{item.keyword_count}</td>
            <td className="px-4 py-1.5">
              <KeywordTags keywords={item.keywords} />
            </td>
          </tr>
        )}
      />

      <DataTable
        title="原始 GSC 數據 (依預設排序)"
        columns={rawDataColumns}
        data={data}
        renderRow={(item, index) => (
          <tr key={index} className="hover:bg-gray-50 text-sm">
            <td className="px-4 py-1.5">{item.site_id}</td>
            <td className="px-4 py-1.5">{item.keyword}</td>
            <td className="px-4 py-1.5 text-right">{item.mean_position.toFixed(1)}</td>
            <td className="px-4 py-1.5 text-right">{item.min_position}</td>
            <td className="px-4 py-1.5 text-right">{item.max_position}</td>
            <td className="px-4 py-1.5 text-right">{item.total_clicks.toLocaleString()}</td>
            <td className="px-4 py-1.5 text-right">{item.total_impressions.toLocaleString()}</td>
            <td className="px-4 py-1.5 text-right">{(item.overall_ctr * 100).toFixed(2)}%</td>
            <td className="px-4 py-1.5 text-xs max-w-[250px] truncate">
              {Array.isArray(item.associated_pages) ? item.associated_pages.join(', ') : ''}
            </td>
          </tr>
        )}
      />
    </div>
  )
}
