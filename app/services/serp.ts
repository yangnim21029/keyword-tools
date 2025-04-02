'use server';

import { REGIONS } from '@/app/config/constants';
import { safeParse } from '@/app/lib/ZodUtils';
import type { SerpAnalysisResult } from '@/app/types';
import {
  ApifyOrganicResult,
  apifyOrganicResultSchema,
  apifyResultItemSchema,
  htmlAnalysisResultSchema,
  processedSerpResultSchema,
  serpApiInputSchema
} from '@/lib/schemas';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { savePageContent } from './firebase/content_storage';

// 將區域名稱轉換為 Apify 接受的 ISO 國家代碼
function getCountryCodeFromRegion(region: string): string {
  console.log(`嘗試將區域 "${region}" 轉換為國家代碼`);
  
  // 檢查直接匹配 (例如 "HK"、"TW" 等)
  if (Object.values(REGIONS).includes(region)) {
    console.log(`地區代碼 "${region}" 已是有效的國家代碼，將轉換為小寫`);
    return region.toLowerCase();
  }
  
  // 直接使用 constants.ts 中的 REGIONS 映射進行查詢
  const code = REGIONS[region];
  
  if (code) {
    console.log(`成功將區域 "${region}" 轉換為國家代碼 "${code}"，將轉換為小寫`);
    return code.toLowerCase();
  }
  
  // 嘗試轉換為大寫進行查詢
  const upperCaseRegion = region.toUpperCase();
  if (Object.values(REGIONS).includes(upperCaseRegion)) {
    console.log(`將區域 "${region}" 轉換為大寫後匹配到國家代碼 "${upperCaseRegion}"，將轉換為小寫`);
    return upperCaseRegion.toLowerCase();
  }
  
  // 嘗試直接轉換為小寫
  const lowerCaseRegion = region.toLowerCase();
  console.log(`嘗試直接使用小寫區域代碼: "${lowerCaseRegion}"`);
  
  // 如果 region 已經是一個兩個字母的國家代碼，直接返回其小寫形式
  if (/^[a-zA-Z]{2}$/.test(region)) {
    console.log(`輸入似乎就是兩個字母的國家代碼，使用其小寫形式: "${lowerCaseRegion}"`);
    return lowerCaseRegion;
  }
  
  // 如果無法匹配，返回默認值並記錄警告
  console.warn(`⚠️ 無法將區域 "${region}" 轉換為有效的國家代碼，將使用空字串`);
  return ""; // 如果找不到映射，返回空字符串
}

// 將語言代碼轉換為 Apify 接受的格式
function formatLanguageCode(language: string): string {
  // 檢查是否為 zh-tw 或 zh-cn 格式
  if (/^zh-tw$/i.test(language)) {
    console.log(`將語言代碼 "${language}" 標準化為 "zh-TW"`);
    return "zh-TW"; // 保持大寫 TW
  } else if (/^zh-cn$/i.test(language)) {
    console.log(`將語言代碼 "${language}" 標準化為 "zh-CN"`);
    return "zh-CN"; // 保持大寫 CN
  } else if (/^pt-br$/i.test(language)) {
    return "pt-BR"; // 葡萄牙語（巴西）
  } else if (/^pt-pt$/i.test(language)) {
    return "pt-PT"; // 葡萄牙語（葡萄牙）
  }
  
  // 其他語言如 en, fr 等保持原樣
  return language;
}

// --- 定義 HtmlAnalysisResult 類型 ---
type HtmlAnalysisResult = z.infer<typeof htmlAnalysisResultSchema>;

// --- Cheerio 輔助函數 (修改 checkH1Consistency) ---
// Remove extractTags function as it's no longer needed
/*
function extractTags($: ReturnType<typeof cheerio.load>, tagName: string): string[] {
  // ... (old implementation)
}
*/

// Modify checkH1Consistency to use the new headings structure
function checkH1Consistency($: ReturnType<typeof cheerio.load>, headings: { level: string; text: string }[]): boolean {
  const h1s = headings.filter(h => h.level === 'h1').map(h => h.text);
  if (h1s.length === 0) return true; 
  const title = $('title').text().toLowerCase().trim();
  return h1s.some(h1 => title.includes(h1.toLowerCase().trim()) || h1.toLowerCase().trim().includes(title));
}

// --- 重新添加 ensureOriginalQuery 輔助函數 ---
const ensureOriginalQuery = (resultsMap: Record<string, any>): Record<string, any> => {
  const newResultsMap = { ...resultsMap };
  Object.keys(newResultsMap).forEach(key => {
    if (newResultsMap[key] && typeof newResultsMap[key] === 'object' && !newResultsMap[key].originalQuery) {
      newResultsMap[key] = {
        ...newResultsMap[key],
        originalQuery: key
      };
    }
  });
  return newResultsMap;
};
// --- 結束 ensureOriginalQuery ---

/**
 * 分析 SERP (搜索引擎結果頁面)
 */
export async function getSerpAnalysis(
  keywords: string[],
  region: string,
  language: string,
  maxResults: number = 100
): Promise<SerpAnalysisResult> {
  const sourceInfo = '數據來源: Apify API';

  const inputValidation = serpApiInputSchema.safeParse({ keywords, region, language, maxResults });
  if (!inputValidation.success) {
    return {
      results: {},
      sourceInfo: '數據來源: 輸入驗證失敗',
      error: '無效的輸入參數: ' + inputValidation.error.message
    };
  }

  const validInput = inputValidation.data;
  validInput.maxResults = 100;

  try {
    const MAX_KEYWORDS = 100;
    const limitedKeywords = validInput.keywords.slice(0, MAX_KEYWORDS);
    
    console.log(`開始分析關鍵詞 SERP 數據: ${limitedKeywords.join(', ')} (共 ${limitedKeywords.length} 個關鍵詞)`);
    
    console.log('直接從 Apify API 獲取數據...');
    
    const apiToken = process.env.APIFY_API_TOKEN || '';
    const actorId = process.env.APIFY_ACTOR_ID || '';
    
    if (!apiToken || !actorId) {
      throw new Error('未設置 APIFY_API_TOKEN 或 APIFY_ACTOR_ID 環境變量');
    }
    
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiToken}`;
    const countryCode = getCountryCodeFromRegion(validInput.region);
    const languageCode = formatLanguageCode(validInput.language);
    
    const requestBody = {
      queries: limitedKeywords.join('\n'),
      resultsPerPage: validInput.maxResults,
      maxPagesPerQuery: 1,
      languageCode: languageCode,
      countryCode: countryCode,
      forceExactMatch: false,
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false,
      includeIcons: false
    };
    
    console.log(`調用 Apify API...(國家: ${countryCode}, 語言: ${languageCode})`);
    console.log('Apify API 請求內容:', JSON.stringify(requestBody));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(requestBody),
      cache: 'no-store'
    });
    
    if (!response.ok) {
      let errorDetails = '';
      try { errorDetails = `: ${await response.text()}`; } catch {} 
      throw new Error(`Apify API 請求失敗: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    const items = await response.json();
    console.log(`API 返回 ${Array.isArray(items) ? items.length : 0} 項`);
    
    const apiResponseValidation = Array.isArray(items) 
      ? z.array(apifyResultItemSchema).safeParse(items)
      : { success: false, error: new Error('API 返回非數組') };
      
    if (!apiResponseValidation.success) {
      console.warn('Apify API 回應驗證警告:', apiResponseValidation.error instanceof Error ? apiResponseValidation.error.message : JSON.stringify(apiResponseValidation.error));
    }
    
    const processedResults = await processApifyResults(items);
    console.log(`處理了 ${Object.keys(processedResults).length} 個關鍵詞結果`);
    
    return {
      results: ensureOriginalQuery(processedResults),
      sourceInfo: sourceInfo
    };
  } catch (error) {
    console.error('獲取 SERP 分析失敗:', error);
    return {
      results: {},
      sourceInfo: sourceInfo,
      error: error instanceof Error ? error.message : '獲取 SERP 分析失敗'
    };
  }
}

/**
 * 處理 Apify 結果數據
 */
async function processApifyResults(items: any[]) {
  const results: Record<string, any> = {};
  
  console.log('Apify API 回傳的原始資料:', JSON.stringify(items).substring(0, 200) + '...');
  
  if (!Array.isArray(items) || items.length === 0) {
    console.log('API 未返回有效資料，返回空結果');
    return {};
  }
  
  for (const item of items) {
    try {
      // 使用 Zod 驗證 item
      const validItem = safeParse(
        apifyResultItemSchema, 
        item, 
        'Apify 結果項目'
      );
      
      if (!validItem) {
        console.log('跳過無效的 Apify 項目');
        continue;
      }
      
      // 找到這個項目對應的關鍵詞
      let keyword = '';
      
      // 處理新API格式 - 從 searchQuery.term 中獲取關鍵詞
      if (typeof validItem.searchQuery === 'object' && validItem.searchQuery?.term) {
        keyword = validItem.searchQuery.term;
      } else if (typeof validItem.searchQuery === 'string') {
        // 兼容舊格式
        keyword = validItem.searchQuery;
      }
      
      if (!keyword) {
        console.log('跳過沒有關鍵詞的項目');
        continue;
      }
      
      console.log(`處理關鍵詞 "${keyword}" 的結果`);
      
      // 處理搜索結果 - 使用 Zod 驗證和轉換
      const searchResults = validItem.organicResults || [];
      
      if (searchResults.length === 0) {
        console.log(`關鍵詞 "${keyword}" 沒有找到有機搜索結果`);
      }
      
      // 提取重要資訊 - 使用 Zod 進行驗證
      const processedResults = searchResults.map(result => {
        // 擴展結果以包含必要的字段
        const extendedResult = {
          ...result,
          displayUrl: result.displayedUrl || result.url || '',
          htmlAnalysis: null // 初始化 HTML 分析結果為 null
        };
        
        // 使用 Zod 驗證並提供預設值
        return apifyOrganicResultSchema.parse(extendedResult);
      });
      
      // 分析結果數據
      const analysis = analyzeSerpResults(processedResults);
      
      // 保存結果 - 使用 Zod 進行驗證
      results[keyword] = processedSerpResultSchema.parse({
        results: processedResults,
        analysis,
        timestamp: new Date().toISOString(),
        originalQuery: keyword,
        queryDetails: validItem.searchQuery || {}, 
        totalResults: validItem.resultsTotal || 0,
        relatedQueries: validItem.relatedQueries || [],
        peopleAlsoAsk: validItem.peopleAlsoAsk || [],
        rawData: validItem // 保存原始完整資料
      });
      
      console.log(`已處理關鍵詞 "${keyword}" 的搜索結果，找到 ${processedResults.length} 個結果`);
      console.log(`相關查詢數量: ${(validItem.relatedQueries || []).length}`);
    } catch (error) {
      console.error('處理 SERP 結果項目時出錯:', error);
    }
  }
  
  console.log(`成功處理了 ${Object.keys(results).length} 個關鍵詞的 SERP 結果`);
  return results;
}

/**
 * 分析 SERP 結果並提取見解
 */
function analyzeSerpResults(results: ApifyOrganicResult[]) {
  const analysis = {
    totalResults: results.length,
    domains: {} as Record<string, number>,
    topDomains: [] as string[],
    avgTitleLength: 0,
    avgDescriptionLength: 0,
  };
  
  let totalTitleLength = 0;
  let totalDescLength = 0;
  
  // 用於 URL 驗證的 schema
  const urlSchema = z.string().url().transform(urlStr => new URL(urlStr));
  
  // 計算各種指標
  for (const result of results) {
    // 提取域名 - 使用 Zod 驗證 URL
    if (result.url) {
      const urlValidation = urlSchema.safeParse(result.url);
      if (urlValidation.success) {
        const domain = urlValidation.data.hostname;
        analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
      }
    }
    
    // 累計標題和描述長度
    if (result.title) totalTitleLength += result.title.length;
    if (result.description) totalDescLength += result.description.length;
  }
  
  // 計算平均值
  if (results.length > 0) {
    analysis.avgTitleLength = Math.round(totalTitleLength / results.length);
    analysis.avgDescriptionLength = Math.round(totalDescLength / results.length);
  }
  
  // 獲取頂級域名
  analysis.topDomains = Object.entries(analysis.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);
  
  return analysis;
}

/**
 * 分析單個 URL 的 HTML 內容 (使用新 API)
 */
export async function analyzeHtmlContent(url: string): Promise<HtmlAnalysisResult | null> {
  const sourceInfo = '數據來源: 內容抓取 API';

  if (!z.string().url().safeParse(url).success) {
    console.error('[analyzeHtmlContent] 無效的 URL:', url);
    return null;
  }
  console.log(`[analyzeHtmlContent] 開始分析 URL: ${url}`);

  try {
    const apiUrl = 'https://evolving-lively-wasp.ngrok-free.app/api/scrape';
    const requestBody = { url: url };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store'
    });

    if (!response.ok) {
      let errorDetails = '';
      try { errorDetails = await response.text(); } catch {}
      console.error(`[analyzeHtmlContent] API 請求失敗 (${response.status}): ${errorDetails}`);
      return null; 
    }

    const data = await response.json();
    const htmlContent = data?.html;
    const markdownContent = data?.markdown;

    if (!htmlContent) {
      console.warn('[analyzeHtmlContent] API 響應中未找到 HTML 內容 (用於解析)', data);
      return null;
    }
    console.log(`[analyzeHtmlContent] 成功獲取 URL ${url} 的內容`);
    
    const $ = cheerio.load(htmlContent);
    const title = $('title').text().trim();
    
    const headings: { level: 'h1' | 'h2' | 'h3'; text: string }[] = [];
    $('h1, h2, h3').each((index, element) => {
      if (element.type === 'tag') { 
        const level = element.name.toLowerCase() as 'h1' | 'h2' | 'h3';
        if (['h1', 'h2', 'h3'].includes(level)) {
            const text = $(element).text().trim();
            if (text) { headings.push({ level, text }); }
        }
      }
    });
    
    const h1Consistency = checkH1Consistency($, headings);
    
    // Process markdown to remove image links
    let processedMarkdown = '';
    if (typeof markdownContent === 'string') {
        // Regex to remove ![alt text](url) links
        processedMarkdown = markdownContent.replace(/\!\[.*?\]\(.*?\)/g, ''); 
    }

    // 保存 markdown 到單獨的 Collection 並獲取 contentRef
    let contentRef = null;
    if (processedMarkdown && url) {
      // 使用 await 等待 savePageContent 完成
      contentRef = await savePageContent(url, processedMarkdown);
      if (!contentRef) {
        console.warn('[analyzeHtmlContent] 保存頁面內容到單獨存儲失敗');
      } else {
        console.log(`[analyzeHtmlContent] 頁面內容已保存到 ${contentRef}`);
      }
    }

    // Assemble result object WITHOUT markdown (now using contentRef instead)
    const result = {
      title, 
      headings, 
      h1Consistency,
      contentRef, // 使用 contentRef 而不是 markdown
      sourceInfo 
    };

    // Use Zod 驗證最終結果
    const validationResult = htmlAnalysisResultSchema.safeParse(result);
    if (!validationResult.success) {
      console.warn(`[analyzeHtmlContent] Zod 驗證失敗 (${url}), returning null:`, validationResult.error.format());
      return null; 
    }
    return validationResult.data;

  } catch (error) {
    console.error(`[analyzeHtmlContent] 分析 URL ${url} 時出錯:`, error);
    return null;
  }
}

/**
 * 分析 SERP 結果中的 HTML 並更新
 */
export async function analyzeSerpResultsHtml(
  keywords: string[],
  region: string,
  language: string
): Promise<{ success: boolean; message: string; documentsProcessed: number; errors?: number }> {
  console.log(`[analyzeSerpResultsHtml] 開始分析 SERP HTML for keywords: ${keywords.join(', ')}`);
  let documentsProcessed = 0;
  let errors = 0;

  // Removed dependency on Firestore cache ID generation and retrieval
  // const documentId = generateSerpDocumentId(keywords, region, language);
  const documentId = `serp-${keywords.sort().join('-')}-${region}-${language}`; // Temporary placeholder ID logic if needed

  try {
    // Removed attempt to fetch cached results from Firestore
    // console.log(`[analyzeSerpResultsHtml] 正在獲取文檔 ${documentId} 以處理 HTML`);
    // const serpData = await getSerpResults(keywords, region, language);

    // if (!serpData) {
    //   console.log(`[analyzeSerpResultsHtml] 未找到文檔 ${documentId} 或已過期/無效，跳過處理`);
    //   return { success: false, message: `未找到文檔 ${documentId} 或已過期/無效`, documentsProcessed: 0 };
    // }

    // --- Start Review Block: Logic depends on removed cache --- 
    // The following logic iterates over `serpData` which was fetched from the Firestore cache.
    // Since the cache is removed, this logic needs to be adapted.
    // Option 1: Fetch fresh SERP data here using getSerpAnalysis.
    // Option 2: Pass the necessary SERP data directly into this function.
    // Option 3: Re-evaluate the purpose of this function entirely.
    // For now, commenting out the main processing loop.
    /*
    console.log(`[analyzeSerpResultsHtml] 獲取到數據，包含 ${Object.keys(serpData).length} 個關鍵詞。開始處理每個關鍵詞的結果...`);
    for (const keyword in serpData) {
      const keywordResults = serpData[keyword]?.results;
      if (!Array.isArray(keywordResults) || keywordResults.length === 0) {
        console.log(`[analyzeSerpResultsHtml] 關鍵詞 ${keyword} 沒有結果，跳過`);
        continue;
      }

      console.log(`[analyzeSerpResultsHtml] 處理關鍵詞 ${keyword} (${keywordResults.length} 個結果)`);
      for (const result of keywordResults) {
        if (result && result.url && !result.htmlAnalysis) { // 只處理尚未分析的 URL
          console.log(`[analyzeSerpResultsHtml] 分析 URL: ${result.url} (關鍵詞: ${keyword})`);
          try {
            const analysis = await analyzeHtmlContent(result.url);
            if (analysis) {
              await updateSerpResultWithHtmlAnalysis(documentId, keyword, result.url, analysis);
              documentsProcessed++;
            } else {
              console.log(`[analyzeSerpResultsHtml] URL ${result.url} 的分析返回 null，可能已處理或出錯`);
              // Optionally update with an empty analysis marker if needed
            }
          } catch (error) {
            console.error(`[analyzeSerpResultsHtml] 分析或更新 URL ${result.url} 時出錯:`, error);
            errors++;
          }
        } else if (result && result.url && result.htmlAnalysis) {
          // console.log(`[analyzeSerpResultsHtml] URL ${result.url} 已包含 HTML 分析，跳過`);
        } else {
           console.log(`[analyzeSerpResultsHtml] 跳過無效的結果項:`, result);
        }
      }
    }
    */
    // --- End Review Block ---

    // Placeholder return value since the core logic is commented out
    const message = `分析任務完成 (核心邏輯已註釋)。已處理文檔: ${documentsProcessed}, 錯誤: ${errors}. Document ID placeholder: ${documentId}`;
    console.log(`[analyzeSerpResultsHtml] ${message}`);
    return { success: true, message, documentsProcessed, errors };

  } catch (error) {
    console.error(`[analyzeSerpResultsHtml] 處理文檔 ${documentId} 時發生頂層錯誤:`, error);
    errors++;
    return {
      success: false,
      message: `處理文檔 ${documentId} 時發生頂層錯誤: ${error instanceof Error ? error.message : error}`,
      documentsProcessed,
      errors
    };
  }
}