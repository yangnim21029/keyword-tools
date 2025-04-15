import { z } from 'zod'

export const GscDataSchema = z.object({
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

export type GscData = z.infer<typeof GscDataSchema>

export function getFaviconUrl(url: string) {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

export function getCleanUrl(url: string): string {
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

export function normalizeSiteId(rawSiteId: string): string {
  if (rawSiteId === 'girlstyle_com') {
    return 'girlstyle_com_tw';
  }
  if (rawSiteId === 'holidaysmart_io') {
      return 'holidaysmart_io_hk';
  }
  return rawSiteId;
}

export function deduplicateData(data: GscData[]): GscData[] {
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

export function processPageData(uniqueDataItems: GscData[]) {
  const aggregatedStatsMap = new Map<string, Map<string, {
    impressions: number;
    clicks: number;
    keywords: Set<string>;
    positions: number[];
    uniqueKeywordData: Map<string, GscData>;
  }>>();

  // 先計算每個站點的總展示次數
  const siteTotalImpressions = new Map<string, number>();
  uniqueDataItems.forEach(item => {
    const normalizedSiteId = item.site_id;
    const currentTotal = siteTotalImpressions.get(normalizedSiteId) || 0;
    siteTotalImpressions.set(normalizedSiteId, currentTotal + item.total_impressions);
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
        ctr,
        avg_position: avgPosition,
        keyword_count: stats.keywords.size,
        keywords: sortedKeywords,
        top_keyword: sortedKeywords[0] || '',
        displayText,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => (b.impressionShare ?? 0) - (a.impressionShare ?? 0));
}

export type KeywordPerformance = {
  keyword: string;
  impressions: number;
  clicks: number;
};

export type SiteKeywordData = {
  siteId: string;
  siteUrl: string;
  totalSiteImpressions: number;
  totalSiteClicks: number;
  avgCtr: number;
  keywords: KeywordPerformance[];
};

export function processSiteKeywordData(uniqueDataItems: GscData[]): SiteKeywordData[] {
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