/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use server';

import { REGIONS } from '@/app/config/constants';
import { safeParse } from '@/app/lib/ZodUtils';
import {
  apifyOrganicResultSchema,
  apifyResultItemSchema,
  enhancedOrganicResultSchema,
  firebaseSerpResultsMapSchema,
  htmlAnalysisResultSchema,
  processedSerpResultSchema,
  serpAnalysisSchema,
  SerpSchema,
  type HtmlAnalysisResult,
  type Serp
} from '@/lib/schemas/serp.schema';
import * as cheerio from 'cheerio';
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from 'zod';
import { COLLECTIONS, db } from './firebase/config';
import { savePageContent } from './firebase/content_storage';

// Infer types locally
type FirebaseSerpResultsMap = z.infer<typeof firebaseSerpResultsMapSchema>;
type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>;
type ApifyResultItem = z.infer<typeof apifyResultItemSchema>;

// 從網址中提取基本域名
const extractBaseDomain = (url: string): string => {
    if (!url) return ''; // Handle empty/null/undefined input
    // 移除協議
    let domain = url;
    if (domain.includes('://')) {
        domain = domain.split('://')[1];
    }
    
    // 移除路徑和查詢參數
    if (domain.includes('/')) {
        domain = domain.split('/')[0];
    }
    
    // 移除'www.'前綴
    if (domain.startsWith('www.')) {
        domain = domain.substring(4);
    }
    
    return domain;
};

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

// Modify checkH1Consistency to use the new headings structure
function checkH1Consistency($: ReturnType<typeof cheerio.load>, headings: { level: string; text: string }[]): boolean {
  const h1s = headings.filter(h => h.level === 'h1').map(h => h.text);
  if (h1s.length === 0) return true; 
  const title = $('title').text().toLowerCase().trim();
  return h1s.some(h1 => title.includes(h1.toLowerCase().trim()) || h1.toLowerCase().trim().includes(title));
}

// Helper function to generate Firestore document ID
const generateSerpDocId = (keyword: string, region: string, language: string, device: string = 'desktop'): string => {
  // Normalize and combine inputs for a consistent ID
  const normalizedKeyword = keyword.toLowerCase().replace(/\s+/g, '_');
  const normalizedRegion = region.toLowerCase();
  const normalizedLanguage = language.toLowerCase();
  const normalizedDevice = device.toLowerCase();
  // Simple example: combine elements. Consider hashing for very long keywords.
  return `${normalizedKeyword}_${normalizedRegion}_${normalizedLanguage}_${normalizedDevice}`;
};

// Define freshness threshold in days
const STALE_THRESHOLD_DAYS = 7; 

/**
 * Fetches and analyzes SERP data for given keywords, using Firestore cache first.
 * 
 * Logic Flow:
 * 1. Generate a unique document ID based on the primary keyword, region, language, and device.
 * 2. Attempt to fetch an existing analysis document from the Firestore 'serp' collection using the generated ID.
 * 3. Check Firestore Document:
 *    - If the document exists:
 *      a. Validate the data against the SerpSchema.
 *      b. Check the 'updatedAt' timestamp against a freshness threshold (STALE_THRESHOLD_DAYS).
 *      c. If the data is valid and fresh:
 *         i. Reconstruct the result format expected by the calling functions (FirebaseSerpResultsMap).
 *         ii. Return the cached data from Firestore, indicating the source.
 *      d. If the data is invalid or stale, proceed to fetch fresh data from the API.
 *    - If the document does not exist, proceed to fetch fresh data from the API.
 * 4. Fetch from Apify API:
 *    - If Firestore cache check fails, call the Apify API to get fresh SERP data.
 *    - Process the results returned by Apify.
 * 5. Save/Update Firestore:
 *    - After successfully fetching and processing data from Apify, save the new/updated data back to the Firestore document using the generated ID.
 *    - Use { merge: true } for upsert.
 * 6. Return Data:
 *    - Return the processed data (either fresh from Apify or valid cache from Firestore).
 */
export async function getSerpAnalysis(
  keywords: string[],
  region: string,
  language: string,
  maxResults: number = 100
): Promise<{ results: FirebaseSerpResultsMap; sourceInfo: string; error?: string }> {
  
  // Basic input validation
  if (!Array.isArray(keywords) || keywords.length === 0) {
      return { results: {}, sourceInfo: '輸入錯誤', error: 'Keywords array cannot be empty.' };
  }
  const primaryKeyword = keywords[0];
  if (typeof region !== 'string' || !region) {
      return { results: {}, sourceInfo: '輸入錯誤', error: 'Region cannot be empty.' };
  }
  if (typeof language !== 'string' || !language) {
      return { results: {}, sourceInfo: '輸入錯誤', error: 'Language cannot be empty.' };
  }
  if (typeof maxResults !== 'number' || maxResults <= 0) {
      console.warn(`Invalid maxResults (${maxResults}), defaulting to 100.`);
      maxResults = 100;
  }
  const deviceType = 'desktop';

  // --- Firestore Cache Check --- 
  if (db) {
      const docId = generateSerpDocId(primaryKeyword, region, language, deviceType);
      const docRef = db.collection(COLLECTIONS.SERP).doc(docId);
      console.log(`檢查 Firestore 快取 (ID: ${docId})`);

      try {
          const docSnap = await docRef.get(); 

          // Check the 'exists' property (Admin SDK)
          if (docSnap.exists) { 
              console.log(`Firestore 文件 ${docId} 存在，檢查有效性和新鮮度...`);
              const data = docSnap.data();
              const updatedAt = data?.updatedAt;
              
              // Check if updatedAt exists and looks like a Firestore Timestamp (has toDate method)
              if (data && updatedAt && typeof updatedAt.toDate === 'function') { 
                   // Cast to Timestamp after check for type safety if needed elsewhere
                   const firestoreTimestamp = updatedAt as Timestamp;
                   const validation = SerpSchema.safeParse({ ...data, id: docId }); 

                  if (validation.success) {
                      const parsedData: Serp = validation.data;
                      const now = Timestamp.now(); 
                      // Use the validated firestoreTimestamp here
                      const diffDays = (now.seconds - firestoreTimestamp.seconds) / (60 * 60 * 24); 
                      console.log(`數據新鮮度: ${diffDays.toFixed(1)} 天 (閾值: ${STALE_THRESHOLD_DAYS} 天)`);

                      if (diffDays <= STALE_THRESHOLD_DAYS) {
                          console.log(`從 Firestore 快取返回新鮮數據 (ID: ${docId})`);
                          
                          const reconstructedResult: z.infer<typeof processedSerpResultSchema> = {
                              results: (parsedData.serpResults || [])
                                .map(r => {
                                  // Attempt to parse each item using the schema
                                  const parseResult = enhancedOrganicResultSchema.safeParse(r); 
                                  if (!parseResult.success) {
                                    console.warn(`[Cache Reco] Failed to parse cached result item:`, parseResult.error.flatten());
                                    return null; // Or handle error differently
                                  }
                                  // Ensure position has default applied by Zod
                                  return parseResult.data; 
                                })
                                .filter((item): item is z.infer<typeof enhancedOrganicResultSchema> => item !== null), // Filter out nulls
                              
                              // Validate and assign analysis, providing a conforming default if needed
                              analysis: (() => {
                                const defaultAnalysis = { domains: {}, topDomains: [], totalResults: 0, avgTitleLength: 0, avgDescriptionLength: 0 };
                                if (!parsedData.analysis) return defaultAnalysis;
                                const validation = serpAnalysisSchema.safeParse(parsedData.analysis);
                                return validation.success ? validation.data : defaultAnalysis;
                              })(),
                              
                              timestamp: parsedData.updatedAt?.toISOString() || new Date().toISOString(), 
                              originalQuery: parsedData.query,
                              totalResults: parsedData.analysis?.totalResults,
                              relatedQueries: [], 
                              peopleAlsoAsk: [], 
                          };

                          const reconstructedMap: FirebaseSerpResultsMap = {
                              [primaryKeyword]: reconstructedResult
                          };
                          
                           const mapValidation = firebaseSerpResultsMapSchema.safeParse(reconstructedMap);
                           if (!mapValidation.success) {
                               console.warn(`Failed to reconstruct/validate FirebaseSerpResultsMap from Firestore for ${docId}:`, mapValidation.error.flatten());
                           } else {
                               return {
                                   results: mapValidation.data,
                                   sourceInfo: '數據來源: Firestore 快取',
                               };
                           }
                      } else {
                           console.log(`Firestore 快取數據過期 (ID: ${docId})`);
                      }
                  } else {
                      console.warn(`Firestore 快取數據結構無效 (ID: ${docId}):`, validation.error.flatten());
                  }
              } else {
                   console.warn(`Firestore 快取數據缺少或無效的 updatedAt 時間戳 (ID: ${docId})`);
              }
          } else {
              console.log(`Firestore 快取未命中 (ID: ${docId})`);
          }
      } catch (cacheError) {
          console.error(`檢查 Firestore 快取時出錯 (ID: ${docId}):`, cacheError);
      }
  } else {
        console.error("Firestore DB instance is not available from config.");
  }
  // --- End Firestore Cache Check ---

  // --- Fetch from Apify API (If cache missed or was stale/invalid) ---
  console.log(`從 Apify API 獲取 SERP 數據...`);
  let processedResultsMap: FirebaseSerpResultsMap = {};
  let apifyError: string | undefined = undefined;
  const sourceInfo = '數據來源: Apify API';

  try {
    const MAX_KEYWORDS_API = 10; // Limit API batch size further if needed
    const limitedKeywords = keywords.slice(0, MAX_KEYWORDS_API);

    console.log(`開始分析關鍵詞 SERP 數據: ${limitedKeywords.join(', ')} (共 ${limitedKeywords.length} 個關鍵詞)`);

    const apiToken = process.env.APIFY_API_TOKEN || '';
    const actorId = process.env.APIFY_ACTOR_ID || '';

    if (!apiToken || !actorId) {
      throw new Error('未設置 APIFY_API_TOKEN 或 APIFY_ACTOR_ID 環境變量');
    }

    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiToken}`;
    const countryCode = getCountryCodeFromRegion(region); 
    const languageCode = formatLanguageCode(language); 

    const requestBody = {
      queries: limitedKeywords.join('\n'),
      resultsPerPage: maxResults, 
      maxPagesPerQuery: 1,
      languageCode: languageCode,
      countryCode: countryCode,
      forceExactMatch: false,
      // @ts-expect-error - deviceType is currently hardcoded to 'desktop', but comparison is valid for future extension
      mobileResults: deviceType === 'mobile', 
      includeUnfilteredResults: false,
      saveHtml: false, 
      saveHtmlToKeyValueStore: false, 
      includeIcons: false
    };

    console.log(`調用 Apify API...(國家: ${countryCode}, 語言: ${languageCode}, 設備: ${deviceType})`);
    // console.log('Apify API 請求內容:', JSON.stringify(requestBody)); // Reduce verbosity

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

    if (!Array.isArray(items)) {
        console.error('Apify API did not return an array:', items);
        throw new Error('Apify API did not return an array.');
    }

    // Process Apify results (this function needs to exist)
    processedResultsMap = await processApifyResults(items as ApifyResultItem[]);
    console.log(`處理了 ${Object.keys(processedResultsMap).length} 個關鍵詞結果`);

    // --- Save to Firestore (after successful API fetch & process) --- 
    if (db && Object.keys(processedResultsMap).length > 0) {
        const collectionName = COLLECTIONS.SERP; 
        console.log(`準備將 ${Object.keys(processedResultsMap).length} 個關鍵詞結果保存/更新到 Firestore...`);

        for (const [keyword, processedResult] of Object.entries(processedResultsMap)) {
            const docId = generateSerpDocId(keyword, region, language, deviceType);
            const docRef = db.collection(collectionName).doc(docId);

            try {
                const dataToSave = {
                    type: 'serp' as const,
                    query: keyword,
                    region: region,
                    language: language,
                    device: deviceType,
                    serpResults: processedResult.results || [],
                    analysis: processedResult.analysis || null,
                    searchEngine: 'google',
                    updatedAt: FieldValue.serverTimestamp(),
                };
                
                await docRef.set({ ...dataToSave, createdAt: FieldValue.serverTimestamp() }, { merge: true });
                console.log(`成功將 ${keyword} 的 SERP 結果保存/更新到 Firestore (ID: ${docId})`);

            } catch (saveError) {
                console.error(`保存關鍵詞 "${keyword}" 的 SERP 結果到 Firestore 失敗 (ID: ${docId}):`, saveError);
            }
        }
    } else if (!db) {
         console.warn("Firestore DB 未初始化，跳過保存步驟。");
    }
    // --- End Firestore Save --- 

    return {
      results: processedResultsMap,
      sourceInfo: sourceInfo,
    };

  } catch (error) {
    console.error('獲取或處理 SERP 分析時出錯:', error);
    apifyError = error instanceof Error ? error.message : '獲取或處理 SERP 分析失敗';
    // Return empty results map on error, but include the error message
    return {
      results: {},
      sourceInfo: sourceInfo, // Indicate source was Apify attempt
      error: apifyError
    };
  }
}

/**
 * 處理 Apify 結果數據
 * (Implementation needs to exist and return Promise<FirebaseSerpResultsMap>)
 */
async function processApifyResults(items: ApifyResultItem[]): Promise<FirebaseSerpResultsMap> {
   const processedMap: FirebaseSerpResultsMap = {};

   console.log('Apify API 返回原始數據 (前200字符):', JSON.stringify(items).substring(0, 200) + '...');

   if (!Array.isArray(items) || items.length === 0) {
      console.log('API 未返回有效數據，返回空結果');
      return {};
   }

   for (const item of items) {
     try {
       const validItem = safeParse( apifyResultItemSchema, item, 'Apify 結果項目' );

       if (!validItem) { continue; }
       
       let keyword = '';
       if (typeof validItem.searchQuery === 'object' && validItem.searchQuery !== null && 'term' in validItem.searchQuery) {
         keyword = validItem.searchQuery.term;
       } else if (typeof validItem.searchQuery === 'string') {
         keyword = validItem.searchQuery;
       }
       if (!keyword) { continue; }
             
       // Map and parse results individually
       const searchResults = (validItem.organicResults || [])
         .map((r) => {
            // First, create the object structure expected by the schema
            const itemToParse = {
                title: r.title || '',
                url: r.url || '',
                description: r.description || '',
                position: r.position, // Let Zod handle optional + default
                type: 'organic', 
                device: undefined, 
                displayedUrl: r.displayedUrl || r.url || '',
                // Include other fields from r that enhancedOrganicResultSchema might expect (like htmlAnalysis if applicable later)
                ...(r as Record<string, unknown>), 
            };
            // Attempt to parse each item using the schema
            const parseResult = enhancedOrganicResultSchema.safeParse(itemToParse); 
            if (!parseResult.success) {
                console.warn(`[API Process] Failed to parse result item for ${keyword}:`, parseResult.error.flatten());
                return null; // Or handle error differently
            }
            // Return the Zod-validated data (includes defaults)
            return parseResult.data;
         })
         .filter((item): item is z.infer<typeof enhancedOrganicResultSchema> => item !== null); // Filter out nulls
       
       // Use the parsed and filtered searchResults for analysis
       const analysisResult = analyzeSerpResults(searchResults);

       const processedData: z.infer<typeof processedSerpResultSchema> = {
           results: searchResults, // Use the Zod-parsed results
           analysis: analysisResult,
           timestamp: new Date().toISOString(), 
           originalQuery: keyword,
           totalResults: validItem.resultsTotal ?? undefined,
           relatedQueries: validItem.relatedQueries || [],
           peopleAlsoAsk: validItem.peopleAlsoAsk || [],
       };

       const validation = processedSerpResultSchema.safeParse(processedData);
        if (!validation.success) {
            console.warn(`Processed SERP data validation failed for ${keyword}:`, validation.error.flatten());
            continue; 
        } 

       processedMap[keyword] = validation.data;

     } catch (processingError) {
       const errorKw = typeof item?.searchQuery === 'object' ? item?.searchQuery?.term : item?.searchQuery;
       console.error(`處理關鍵詞 ${errorKw || 'unknown'} 的 SERP 結果時出錯:`, processingError);
     }
   }
   return processedMap;
}

// --- Helper function to analyze results (Update parameter type) ---
function analyzeSerpResults(results: z.infer<typeof enhancedOrganicResultSchema>[]) { 
    const domains: Record<string, number> = {};
    let totalTitleLength = 0;
    let totalDescriptionLength = 0;
    const validResults = results.filter(r => r.url); 

    validResults.forEach(result => {
        const domain = extractBaseDomain(result.url || ''); 
        if (domain) {
            domains[domain] = (domains[domain] || 0) + 1;
        }
        totalTitleLength += result.title?.length || 0;
        totalDescriptionLength += result.description?.length || 0;
    });

    const topDomains = Object.entries(domains)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 10) 
        .map(([domain]) => domain);

    return {
        totalResults: validResults.length,
        domains,
        topDomains,
        avgTitleLength: validResults.length > 0 ? Math.round(totalTitleLength / validResults.length) : 0,
        avgDescriptionLength: validResults.length > 0 ? Math.round(totalDescriptionLength / validResults.length) : 0,
    };
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
): Promise<{ success: boolean, message: string, documentsProcessed: number, errors: number }> {
  console.log(`[analyzeSerpResultsHtml] 開始分析 SERP HTML for keywords: ${keywords.join(', ')}`);
  const documentId = `serp-${keywords.sort().join('-')}-${region}-${language}`; // Temporary placeholder ID logic if needed
  const documentsProcessed = 0;
  let errors = 0;

  try {
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