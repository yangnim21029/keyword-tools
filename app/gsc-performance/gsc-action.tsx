"use server"

import { z } from "zod";
import { unstable_cache } from "next/cache";
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { SERP_ANALYSIS_MODELS } from "../global-config";

export async function fetchGscData(queries: string[], minImpressions: number = 1): Promise<GscData[]> {
    if (queries.length === 0) return [];
    
    // Create a cache key based on the queries
    const cacheKey = queries.sort().join(',') + minImpressions;
    
    const response = await fetch('https://gsc-weekly-analyzer-241331030537.asia-east2.run.app/analyze/all', {
      next: {
        revalidate: 3600, // Revalidate every hour
        tags: ['gsc-data', `queries-${cacheKey}`]
      },
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

// 在構建時預先獲取所有數據
export const getThemeData = unstable_cache(
    async (theme: string) => {
      // Ensure theme is a valid key in PRESET_QUERIES
      const presetQueries = await getPresetQueries();
      const validTheme = theme as keyof typeof presetQueries;
      const { queries } = presetQueries[validTheme];
      const data = await fetchGscData(queries);
      const uniqueDataItems = await deduplicateData(data);
      const sortedRawData = [...data].sort((a, b) => a.max_position - b.max_position);
      const topPagesBySite = await processPageData(uniqueDataItems);
      const siteKeywordData = await processSiteKeywordData(uniqueDataItems);
  
      return {
        data,
        uniqueDataItems,
        sortedRawData,
        topPagesBySite,
        siteKeywordData
      };
    },
    ['theme-data'],
    { tags: ['gsc-data'] }
  );

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

  
export type GscData = z.infer<typeof GscDataSchema>
  
export async function getFaviconUrl(url: string): Promise<string> {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    } catch {
      return ''
    }
  }
  
  export async function getCleanUrl(url: string): Promise<string> {
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
  
  export async function normalizeSiteId(rawSiteId: string): Promise<string> {
    if (rawSiteId === 'girlstyle_com') {
      return 'girlstyle_com_tw';
    }
    if (rawSiteId === 'holidaysmart_io') {
        return 'holidaysmart_io_hk';
    }
    return rawSiteId;
  }
  
  export async function deduplicateData(data: GscData[]): Promise<GscData[]> {
    const uniqueKeys = new Set<string>();
    const uniqueDataItems: GscData[] = [];
    
    for (const item of data) {
      const normalizedSiteId = await normalizeSiteId(item.site_id);
      const cleanUrls = new Set<string>();
      
      for (const page of item.associated_pages) {
        cleanUrls.add(await getCleanUrl(page));
      }
      
      for (const url of cleanUrls) {
        const key = `${normalizedSiteId}::${url}::${item.keyword}`;
        if (!uniqueKeys.has(key)) {
          uniqueKeys.add(key);
          uniqueDataItems.push({ ...item, site_id: normalizedSiteId });
        }
      }
    }
    
    return uniqueDataItems;
  }
  
  export async function processPageData(uniqueDataItems: GscData[]) {
    const aggregatedStatsMap = new Map<string, Map<string, {
      impressions: number;
      clicks: number;
      keywords: Set<string>;
      positions: number[];
      uniqueKeywordData: Map<string, GscData>;
    }>>();
  
    // 先計算每個站點的總展示次數
    const siteTotalImpressions = new Map<string, number>();
    for (const item of uniqueDataItems) {
      const normalizedSiteId = item.site_id;
      const currentTotal = siteTotalImpressions.get(normalizedSiteId) || 0;
      siteTotalImpressions.set(normalizedSiteId, currentTotal + item.total_impressions);
    }
  
    for (const uniqueItem of uniqueDataItems) {
      const normalizedSiteId = uniqueItem.site_id;
      if (!Array.isArray(uniqueItem.associated_pages) || uniqueItem.associated_pages.length === 0) continue;
      
      // 只處理展示次數 >= 10 的數據
      if (uniqueItem.total_impressions < 10) continue;
      
      const representativeCleanUrl = await getCleanUrl(uniqueItem.associated_pages[0]);
  
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
    }
  
    const result = [];
    
    for (const [normalizedSiteId, pages] of aggregatedStatsMap.entries()) {
      if (pages.size === 0) continue;
      const pageEntries = [...pages.entries()];
      if (pageEntries.length === 0) continue;
  
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
  
      result.push({
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
        total_pages: pages.size
      });
    }
  
    return result
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
  
  export async function processSiteKeywordData(uniqueDataItems: GscData[]): Promise<SiteKeywordData[]> {
    const siteKeywordMap = new Map<string, {
      representativeUrl: string | null;
      totalImpressions: number;
      totalClicks: number;
      keywordStats: Map<string, { impressions: number; clicks: number }>;
    }>();
  
    for (const item of uniqueDataItems) {
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
    }
  
    const result: SiteKeywordData[] = [];
    
    for (const [siteId, siteData] of siteKeywordMap.entries()) {
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
    }
  
    result.sort((a, b) => b.totalSiteImpressions - a.totalSiteImpressions);
    return result;
  }
  
  
export async function getPresetQueries() {
  return {
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
}

export async function getMockData() {
  return {
    gscData: [
      {
        site_id: 'girlstyle_com',
        keyword: '面膜推荐',
        mean_position: 1.0,
        min_position: 1.0,
        max_position: 1.0,
        total_clicks: 1,
        total_impressions: 1,
        overall_ctr: 100.00,
        associated_pages: ['https://girlstyle.com/tw/article/watsons-oliveyoung年度最好用面膜top-10-第4款赵露思推荐-养成婴儿肌必备']
      },
      {
        site_id: 'girlstyle_com',
        keyword: '保養常識9成都是騙人的',
        mean_position: 1.0,
        min_position: 1.0,
        max_position: 1.0,
        total_clicks: 1,
        total_impressions: 1,
        overall_ctr: 100.00,
        associated_pages: ['https://girlstyle.com/tw/article/防曬spf-化妝水-保養常識9成都是騙人的-落合博子']
      },
      {
        site_id: 'girlstyle_com_my',
        keyword: 'vt微針面膜使用方法',
        mean_position: 1.0,
        min_position: 1.0,
        max_position: 1.0,
        total_clicks: 0,
        total_impressions: 1,
        overall_ctr: 0.00,
        associated_pages: ['https://girlstyle.com/my/article/微针精华-最全攻略-功效-使用方法-产品推荐']
      },
      {
        site_id: 'topbeautyhk_com',
        keyword: '精華液推薦',
        mean_position: 1.5,
        min_position: 1,
        max_position: 2,
        total_clicks: 10,
        total_impressions: 2628,
        overall_ctr: 0.38,
        associated_pages: ['https://topbeautyhk.com/article/精華液-美白-保濕-抗衰老-推介']
      },
      {
        site_id: 'poplady-mag_com',
        keyword: '好用精華',
        mean_position: 2.0,
        min_position: 1,
        max_position: 3,
        total_clicks: 25,
        total_impressions: 746,
        overall_ctr: 3.35,
        associated_pages: ['https://poplady-mag.com/article/去黑頭粉刺推薦']
      },
      {
        site_id: 'pretty_presslogic_com',
        keyword: '去 斑 精華',
        mean_position: 2.3,
        min_position: 2,
        max_position: 3,
        total_clicks: 7,
        total_impressions: 537,
        overall_ctr: 1.30,
        associated_pages: ['https://pretty.presslogic.com/article/色斑-淡斑精華']
      }
    ],
    pageData: [
      {
        site_id: 'topbeautyhk_com',
        url: 'https://topbeautyhk.com/article/精華液-美白-保濕-抗衰老-推介',
        impressionShare: 53.3,
        total_clicks: 10,
        total_impressions: 2628,
        ctr: 0.38,
        avg_position: 1.5,
        keyword_count: 12,
        keywords: ['精華液推薦', '保濕精華液推薦', '精華 推薦', '精華 推介', '精華 液 推薦', '保濕精華推薦', '好用精華', '保濕精華推介', '好用保濕精華', '保濕精華好用', '精華液推薦2024', '精華推介'],
        top_keyword: '精華液推薦',
        displayText: '精華液-美白-保濕-抗衰老-推介',
        total_pages: 25
      },
      {
        site_id: 'poplady-mag_com',
        url: 'https://poplady-mag.com/article/去黑頭粉刺推薦',
        impressionShare: 15.1,
        total_clicks: 25,
        total_impressions: 746,
        ctr: 3.35,
        avg_position: 2.0,
        keyword_count: 3,
        keywords: ['好用精華', 'biore 防曬', 'kiehl\'s 淡 斑 精華'],
        top_keyword: '好用精華',
        displayText: '去黑頭粉刺推薦',
        total_pages: 18
      },
      {
        site_id: 'pretty_presslogic_com',
        url: 'https://pretty.presslogic.com/article/色斑-淡斑精華',
        impressionShare: 10.9,
        total_clicks: 7,
        total_impressions: 537,
        ctr: 1.30,
        avg_position: 2.3,
        keyword_count: 2,
        keywords: ['去 斑 精華', '去斑精華'],
        top_keyword: '去 斑 精華',
        displayText: '色斑-淡斑精華',
        total_pages: 12
      }
    ],
    siteData: [
      {
        siteId: 'topbeautyhk_com',
        siteUrl: 'https://topbeautyhk.com',
        totalSiteImpressions: 2628,
        totalSiteClicks: 10,
        avgCtr: 0.38,
        keywords: [
          { keyword: '精華液推薦', impressions: 500, clicks: 2 },
          { keyword: '保濕精華液推薦', impressions: 450, clicks: 1 },
          { keyword: '精華 推薦', impressions: 400, clicks: 1 },
          { keyword: '精華 推介', impressions: 350, clicks: 1 },
          { keyword: '精華 液 推薦', impressions: 300, clicks: 1 },
          { keyword: '保濕精華推薦', impressions: 250, clicks: 1 },
          { keyword: '保濕精華推介', impressions: 150, clicks: 1 },
          { keyword: '好用精華', impressions: 120, clicks: 1 },
          { keyword: '好用保濕精華', impressions: 80, clicks: 0 },
          { keyword: '保濕精華好用', impressions: 28, clicks: 1 },
          { keyword: '淡斑精華推薦', impressions: 0, clicks: 0 },
          { keyword: '補濕精華推介', impressions: 0, clicks: 0 },
          { keyword: '美白淡斑精華推薦', impressions: 0, clicks: 0 },
          { keyword: '收毛孔精華', impressions: 0, clicks: 0 },
          { keyword: '淡 斑 精華', impressions: 0, clicks: 0 }
        ]
      },
      {
        siteId: 'poplady-mag_com',
        siteUrl: 'https://poplady-mag.com',
        totalSiteImpressions: 746,
        totalSiteClicks: 25,
        avgCtr: 3.35,
        keywords: [
          { keyword: '好用精華', impressions: 300, clicks: 10 },
          { keyword: 'biore 防曬', impressions: 246, clicks: 8 },
          { keyword: '懷孕保養品要換嗎', impressions: 100, clicks: 4 },
          { keyword: '快速保養', impressions: 50, clicks: 1 },
          { keyword: 'cancer council防曬評價', impressions: 25, clicks: 1 },
          { keyword: '化妝水推薦', impressions: 25, clicks: 1 },
          { keyword: '小羊皮 保養', impressions: 0, clicks: 0 },
          { keyword: '名牌手袋保養', impressions: 0, clicks: 0 },
          { keyword: '保濕精華好用', impressions: 0, clicks: 0 },
          { keyword: '收毛孔精華', impressions: 0, clicks: 0 },
          { keyword: '保濕精華推薦', impressions: 0, clicks: 0 },
          { keyword: '妝前保養', impressions: 0, clicks: 0 },
          { keyword: 'kiehl\'s 防曬', impressions: 0, clicks: 0 },
          { keyword: '敏感肌化妝水', impressions: 0, clicks: 0 },
          { keyword: 'kiehl\'s 淡 斑 精華', impressions: 0, clicks: 0 }
        ]
      },
      {
        siteId: 'pretty_presslogic_com',
        siteUrl: 'https://pretty.presslogic.com',
        totalSiteImpressions: 537,
        totalSiteClicks: 7,
        avgCtr: 1.30,
        keywords: [
          { keyword: '去 斑 精華', impressions: 300, clicks: 4 },
          { keyword: '去斑精華', impressions: 237, clicks: 3 },
          { keyword: 'clarins賦活雙精華好用嗎', impressions: 0, clicks: 0 },
          { keyword: 'olay 抗 糖 精華', impressions: 0, clicks: 0 },
          { keyword: '名牌手袋保養', impressions: 0, clicks: 0 },
          { keyword: 'lv售後保養', impressions: 0, clicks: 0 },
          { keyword: 'ahc b5 精華 好 用', impressions: 0, clicks: 0 },
          { keyword: '低敏感 面膜', impressions: 0, clicks: 0 },
          { keyword: 'olay 抗糖精華', impressions: 0, clicks: 0 },
          { keyword: '低敏 面膜', impressions: 0, clicks: 0 },
          { keyword: 'ahc t3膠原緊緻回彈精華', impressions: 0, clicks: 0 },
          { keyword: '化妝水精華液順序', impressions: 0, clicks: 0 },
          { keyword: 'menokin 30秒免洗泡泡面膜評價', impressions: 0, clicks: 0 },
          { keyword: '化妝水與收臉水', impressions: 0, clicks: 0 },
          { keyword: 'cl', impressions: 0, clicks: 0 }
        ]
      }
    ]
  };
}

export type PresetQueryType = Awaited<ReturnType<typeof getPresetQueries>>;
export type PresetQueryKey = keyof PresetQueryType;

// Define Zod Schema for the AI TEXT output
const GscAnalysisTextSchema = z.object({
  analysisText: z.string().describe("包含 GSC 分析的原始文本/Markdown")
});
export type GscAnalysisText = z.infer<typeof GscAnalysisTextSchema>;

// Refined AI Analysis Function - NOW USES generateText with raw data subset
export async function generateAiAnalysis(
  uniqueDataItems: GscData[],
  model: string = 'gpt-4.1-mini'
): Promise<GscAnalysisText> {
  "use server";

  // --- 1. Prepare RAW Data Subset for Prompt --- 
  // Sort by impressions and take top 60 items
  const sortedData = [...uniqueDataItems]
    .sort((a, b) => b.total_impressions - a.total_impressions)
    .slice(0, 60);

  // Format the subset for the prompt
  const keywordDataValue = sortedData.map(item => {
    // Try to get a cleaner page representation
    let pageDisplay = item.associated_pages[0] || 'N/A';
    try {
      const urlObj = new URL(pageDisplay);
      pageDisplay = urlObj.pathname + urlObj.search + urlObj.hash;
      if (pageDisplay.length > 80) { // Truncate long paths
        pageDisplay = pageDisplay.substring(0, 77) + '...';
      }
    } catch { 
      // Keep original if not a valid URL or if error
      if (pageDisplay.length > 80) { 
        pageDisplay = pageDisplay.substring(0, 77) + '...';
      }
    }
    
    return `- Keyword: "${item.keyword}", Page: "${pageDisplay}", Impressions: ${item.total_impressions}, Clicks: ${item.total_clicks}, Position: ${item.mean_position.toFixed(1)} (Site: ${item.site_id})`;
  }).join('\n');

  const itemCount = sortedData.length;

  // --- 2. Construct the AI Prompt (Further Refined for Consolidated View) --- 
  const prompt = `
**重要前提：** 提供的 Google Search Console (GSC) 數據列表僅代表我們所管理的網站（即「佔有市場」）的表現，並非整個網路市場（「總體市場」）的數據。請基於此**內部視角**進行分析。

**任務：** 分析我們網站的流量來源，如麥肯錫顧問般重新驗證關於使用者動機的假設，並根據下方提供的 GSC 關鍵字-頁面數據列表（按展示次數排序，最多 ${itemCount} 條）提出優化建議。

**分析重點：**
1. 從提供的數據列表中，識別主要的**最佳曝光頁面**（列表靠前、高展示量的頁面）及其帶來流量的主要關鍵字。
2. 分析這些**最佳曝光頁面**的**關鍵字覆蓋廣度**（即，一個頁面在列表中與多少不同的關鍵字相關聯？這代表其主題涵蓋能力）。
3. 驗證目前吸引的用戶 Persona 是否符合預期（關鍵字意圖：資訊型 vs. 商業/交易型）。
4. 找出「流量來源優化」的機會（例如，高展示低點擊的關鍵字/頁面）與挑戰（例如，關鍵字與登陸頁面主題不匹配）。
5. 提出「流量來源佈局優化」、「網站整體架構配置」與「第一印象洗腦」相關的建議，以鞏固及拓展我們的「佔有市場」。

**回應要求：**
*   描述方式融入日常對話。
*   **每一句**都需要包含關鍵字：「流量來源優化」。
*   優化建議需提及如何從我們的「佔有市場」（列表數據）出發，觀察「潛在市場」特徵，並與「總體市場」對比，尋找「流量來源優化」的機會。
*   **嚴禁** 提及網站速度、社群媒體、頁面內容反應、頁面具體 UI 配置。
*   數字 0 是最小的。
*   採用 Ahrefs PSA 框架（作為純文本輸出，使用 Markdown 標題）：
    *   \`### [問題與動機]\` - 包含關鍵字「流量來源優化」。
    *   \`### [數據列表分析]\` - **取代 [表格支持]**。引用下方數據列表中的具體例子（關鍵字、頁面、展示、點擊、排名）來支持論點，**特別關注高展示頁面及其關聯的關鍵字數量/多樣性**。強調排名數字小、展示大的重要性。每句包含「流量來源優化」。
    *   \`### [建立回答論述]\` - 詳細闡述分析和建議（包含頁面關鍵字覆蓋廣度的意義），多次換行，每句包含「流量來源優化」。聚焦於我們網站的表現。
*   回應結尾需包含關鍵字「流量來源優化」。
*   最後增加一段 \`### [下一步建議]\`，提供兩個「要不要試試...」方向的具體建議，每句包含「流量來源優化」。

---
**GSC 關鍵字-頁面數據列表 (我們網站表現，按展示排序，最多 ${itemCount} 條):**
${keywordDataValue}
---
`;

  // --- 3. Perform Real AI Call using generateText --- 
  console.log(`[Action] Calling AI for GSC Analysis TEXT using ${model} with ${itemCount} raw items...`);
  try {
    const { text: analysisResultText } = await generateText({
      model: SERP_ANALYSIS_MODELS.BASE,
      prompt: prompt
    });
    
    console.log(`[Action] AI GSC Analysis TEXT generation successful.`);
    // Validate the text output
    const validatedResult = GscAnalysisTextSchema.parse({ analysisText: analysisResultText });
    return validatedResult; 

  } catch (error) {
    console.error(`[Action] AI GSC Analysis TEXT generation failed:`, error);
    throw new Error(
      `AI 分析生成失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// NEW Server Action to trigger analysis on demand
export async function triggerAiAnalysisForTheme(theme: string): Promise<GscAnalysisText> {
  "use server";
  console.log(`[Action] Triggering AI Analysis for theme: ${theme}`);
  try {
    // 1. Fetch data required for the theme
    const { uniqueDataItems } = await getThemeData(theme); 
    console.log(`[Action] Data fetched for theme: ${theme}`);

    // 2. Call the existing analysis generation function with the correct data
    const analysisResult = await generateAiAnalysis(uniqueDataItems); 
    console.log(`[Action] AI Analysis generated successfully for theme: ${theme}`);
    return analysisResult;

  } catch (error) {
    console.error(`[Action] Failed to trigger AI analysis for theme ${theme}:`, error);
    // Rethrow or return a specific error structure if needed
    throw new Error(
      `為主題 \'${theme}\' 觸發 AI 分析失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

