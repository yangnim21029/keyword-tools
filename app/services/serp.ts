'use server';

import { REGIONS } from '@/app/config/constants';
import { safeParse } from '@/app/lib/zod-utils';
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
import {
  generateSerpDocumentId,
  getSerpResults,
  saveSerpResults,
  updateSerpResultWithHtmlAnalysis
} from './firebase/serp_storage';

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
  let isFromCache = false;

  const inputValidation = serpApiInputSchema.safeParse({ keywords, region, language, maxResults });
  if (!inputValidation.success) {
    return {
      results: {},
      fromCache: false,
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
    
    try {
      const storedResults = await getSerpResults(limitedKeywords, validInput.region, validInput.language);
      if (storedResults) {
        console.log('使用已存儲的 SERP 分析結果');
        isFromCache = true;
        return {
          results: ensureOriginalQuery(storedResults),
          fromCache: true, 
          sourceInfo: '數據來源: Firebase Firestore (緩存)'
        };
      }
    } catch (storageError) {
      if (storageError instanceof Error && 
          (storageError.message.includes('RESOURCE_EXHAUSTED') || storageError.message.includes('Quota exceeded'))) {
        console.warn("Firebase 配額已用盡，無法檢查 SERP 存儲。繼續從 API 獲取數據。");
      } else {
        console.error("存儲檢查失敗，但將繼續從 API 獲取：", storageError);
      }
    }
    
    console.log('未找到有效緩存或檢查失敗，從 Apify API 獲取數據...');
    
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
    
    try {
      await saveSerpResults(limitedKeywords, validInput.region, validInput.language, processedResults);
    } catch (saveError) {
      if (saveError instanceof Error && (saveError.message.includes('RESOURCE_EXHAUSTED') || saveError.message.includes('Quota exceeded'))) {
        console.warn("Firebase 配額已用盡，無法保存 SERP 結果。");
      } else {
        console.error("保存 SERP 結果失敗:", saveError);
      }
    }
    
    return {
      results: ensureOriginalQuery(processedResults),
      fromCache: false,
      sourceInfo: sourceInfo
    };
  } catch (error) {
    console.error('獲取 SERP 分析失敗:', error);
    return {
      results: {},
      fromCache: isFromCache,
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
 * 批量分析 SERP 結果中的 HTML 內容並更新 Firestore
 */
export async function analyzeSerpResultsHtml(
  keywords: string[],
  region: string,
  language: string
): Promise<{ success: boolean; message: string; documentsProcessed: number; errors?: number }> {
  console.log(`[analyzeSerpResultsHtml] 開始批量分析 HTML: ${keywords.join(', ')}`);
  const documentId = generateSerpDocumentId(keywords, region, language);
  let processedCount = 0;
  let errorCount = 0;

  try {
    // 先獲取一次完整的 SERP 結果 (從緩存或 API)
    // 這裡不需要 ensureOriginalQuery，因為我們只關心 results 列表
    const serpData = await getSerpResults(keywords, region, language);

    if (!serpData) {
      console.log(`[analyzeSerpResultsHtml] 未找到 ID ${documentId} 的 SERP 數據`);
      return { success: false, message: '未找到 SERP 數據', documentsProcessed: 0 };
    }

    // 收集所有需要處理的 URL 任務
    const tasks: { url: string; keyword: string }[] = [];

    // 遍歷每個關鍵詞的結果，收集任務而不是立即執行
    for (const keyword in serpData) {
      const keywordResults = serpData[keyword]?.results;
      if (keywordResults && Array.isArray(keywordResults)) {
        // 遍歷該關鍵詞下的每個 URL 結果
        for (const result of keywordResults) {
          const url = result?.url;
          // 檢查 URL 是否有效且尚未分析過 HTML
          if (url && typeof url === 'string' && z.string().url().safeParse(url).success && !result.htmlAnalysis) {
            tasks.push({ url, keyword });
          }
        }
      }
    }

    // 設置並發限制
    const CONCURRENT_LIMIT = 3; // 一次最多處理3個 URL
    const DELAY_BETWEEN_BATCHES = 1000; // 每批次之間暫停1秒
    
    console.log(`[analyzeSerpResultsHtml] 收集到 ${tasks.length} 個 URL 任務，將以 ${CONCURRENT_LIMIT} 個的批次進行處理`);
    
    // 分批處理任務
    for (let i = 0; i < tasks.length; i += CONCURRENT_LIMIT) {
      const batchTasks = tasks.slice(i, i + CONCURRENT_LIMIT);
      console.log(`[analyzeSerpResultsHtml] 開始處理第 ${Math.floor(i/CONCURRENT_LIMIT) + 1} 批（${batchTasks.length} 個 URL）`);
      
      // 使用 Promise.all 處理當前批次
      const batchPromises = batchTasks.map(async ({ url, keyword }) => {
        processedCount++;
        try {
          console.log(`[analyzeSerpResultsHtml] 分析 URL: ${url}`);
          const analysisResult = await analyzeHtmlContent(url);
          if (analysisResult) {
            // 如果分析成功，則更新 Firestore
            await updateSerpResultWithHtmlAnalysis(documentId, keyword, url, analysisResult);
            console.log(`[analyzeSerpResultsHtml] 已更新 ${keyword} - ${url}`);
          } else {
            console.warn(`[analyzeSerpResultsHtml] 分析失敗或無結果: ${url}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`[analyzeSerpResultsHtml] 處理 ${url} 時發生嚴重錯誤:`, error);
          errorCount++;
        }
      });
      
      // 等待當前批次完成
      await Promise.all(batchPromises);
      
      // 在處理下一批前等待一段時間，減輕API負擔
      if (i + CONCURRENT_LIMIT < tasks.length) {
        console.log(`[analyzeSerpResultsHtml] 暫停 ${DELAY_BETWEEN_BATCHES}ms 後處理下一批`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log(`[analyzeSerpResultsHtml] 完成批量分析: ${processedCount} 個 URL 已處理, ${errorCount} 個錯誤`);
    return {
      success: true,
      message: `HTML 分析完成，處理了 ${processedCount} 個 URL。${errorCount > 0 ? `遇到 ${errorCount} 個錯誤。` : ''}`.trim(),
      documentsProcessed: processedCount,
      errors: errorCount
    };

  } catch (error) {
    console.error('[analyzeSerpResultsHtml] 批量分析時發生頂層錯誤:', error);
    // 如果是配額錯誤，返回特定消息
    if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Quota exceeded'))) {
      return { success: false, message: 'Firebase 配額超出，無法完成 HTML 分析。', documentsProcessed: processedCount, errors: errorCount };
    }
    return { success: false, message: '批量分析 HTML 內容時發生錯誤', documentsProcessed: processedCount, errors: errorCount };
  }
}