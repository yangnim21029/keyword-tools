'use server';

import { ALPHABET, SYMBOLS } from '@/app/config/constants';
import {
  estimateProcessingTime,
  filterSimplifiedChinese
} from '@/app/services/keyword-idea-api.service';
import { fetchAutocomplete } from '@/app/services/suggestion.service';
import type { KeywordSuggestionResult } from '@/app/services/firebase/types';

/**
 * 獲取關鍵字建議 - 根據輸入的查詢詞生成相關關鍵字建議
 *
 * 此函數使用Google Autocomplete API獲取與輸入查詢相關的關鍵字建議。
 * 可以選擇性地擴展搜索範圍，包括添加字母(A-Z)和符號變體，以獲取更廣泛的建議。
 *
 * 功能特點:
 * - 基本關鍵字查詢
 * - 字母擴展(A-Z)
 * - 符號擴展(問號、驚嘆號等)
 * - 中文關鍵字空格變體
 * - 簡體中文過濾
 * - 重複項去除
 *
 * 使用場景:
 * - SEO關鍵字研究
 * - 內容創作主題發掘
 * - 市場調研
 * - 廣告活動關鍵字規劃
 *
 * @param query 要查詢的關鍵字或詞組
 * @param region 目標地區代碼 (例如: 'TW' 台灣, 'HK' 香港)
 * @param language 目標語言代碼 (例如: 'zh-TW' 繁體中文, 'en' 英文)
 * @param useAlphabet 是否使用字母(A-Z)擴展搜索
 * @param useSymbols 是否使用符號擴展搜索
 * @returns 包含關鍵字建議的結果對象
 */
export async function getKeywordSuggestions(
  {
    query,
    region,
    language,
    useAlphabet,
    useSymbols
  }: {
    query: string;
    region: string;
    language: string;
    useAlphabet: boolean;
    useSymbols: boolean;
  }
): Promise<KeywordSuggestionResult> {
  console.log(`[Action: getKeywordSuggestions] Received useSymbols: ${useSymbols}`);

  const searchPrefix = query.trim();

  try {
    console.log(
      `從API獲取關鍵字建議: ${searchPrefix}, 區域: ${region}, 語言: ${language}, A:${useAlphabet}, S:${useSymbols}`
    );

    let allSuggestions: string[] = [];

    // Base search
    const baseResults = await fetchAutocomplete(searchPrefix, region, language);
    allSuggestions = [...baseResults];

    // Alphabet expansion
    if (useAlphabet) {
      console.log(`[Action: getKeywordSuggestions] Starting alphabet expansion for: ${searchPrefix}`);
      const alphabetPromisesPrefix = ALPHABET.map(letter =>
        fetchAutocomplete(`${letter} ${searchPrefix}`, region, language)
      );
      const alphabetPromisesSuffix = ALPHABET.map(letter =>
        fetchAutocomplete(`${searchPrefix} ${letter}`, region, language)
      );

      const alphabetResultsPrefix = await Promise.all(alphabetPromisesPrefix  );
      const alphabetResultsSuffix = await Promise.all(alphabetPromisesSuffix);
      console.log(alphabetResultsPrefix);
      console.log(alphabetResultsSuffix);
      allSuggestions = [...allSuggestions, ...alphabetResultsPrefix.flat(), ...alphabetResultsSuffix.flat()];
    }

    // Symbol expansion
    if (useSymbols) {
      console.log(`[Action: getKeywordSuggestions] Starting symbol expansion for: ${searchPrefix}`);
      const symbolPromisesPrefix = SYMBOLS.map(symbol =>
        fetchAutocomplete(`${symbol} ${searchPrefix}`, region, language)
      );
      const symbolPromisesSuffix = SYMBOLS.map(symbol =>
        fetchAutocomplete(`${searchPrefix} ${symbol}`, region, language)
      );
      const symbolResultsPrefix = await Promise.all(symbolPromisesPrefix);
      const symbolResultsSuffix = await Promise.all(symbolPromisesSuffix);
      console.log(symbolResultsPrefix);
      console.log(symbolResultsSuffix);
      allSuggestions = [...allSuggestions, ...symbolResultsPrefix.flat(), ...symbolResultsSuffix.flat()];
    }

    // Filter and deduplicate
    const filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    const uniqueSuggestions = [...new Set(filteredSuggestions)];

    console.log(`[Action: getKeywordSuggestions] Unique suggestions: ${uniqueSuggestions.length}`);
    console.log(uniqueSuggestions);

    // Calculate estimated time
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);

    console.log(`從API獲取到 ${uniqueSuggestions.length} 個建議`);
    console.log(uniqueSuggestions);

    return {
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedVolumeTime,
      sourceInfo: '數據來源: Google Autocomplete API'
    };
  } catch (error) {
    console.error('獲取關鍵字建議時出錯:', error);
    return {
      suggestions: [],
      estimatedProcessingTime: 0,
      sourceInfo: '數據來源: 獲取失敗',
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error fetching keyword suggestions'
    };
  }
}

// Refactored getUrlSuggestions
interface UrlFormData {
  url: string;
  region: string;
  language: string;
}

/**
 * 從URL獲取關鍵字建議 - 分析網址並生成相關關鍵字建議
 *
 * 此函數通過分析URL的域名和路徑部分，提取潛在的關鍵字，
 * 然後使用Google Autocomplete API獲取相關關鍵字建議。
 *
 * 功能特點:
 * - 自動從URL提取域名和路徑關鍵詞
 * - 過濾常見頂級域名(.com, .org等)
 * - 將連字符和下劃線轉換為空格
 * - 簡體中文過濾
 * - 重複項去除
 *
 * 處理流程:
 * 1. 從URL提取域名和路徑部分
 * 2. 移除常見TLD和www前綴
 * 3. 分割並清理路徑部分
 * 4. 使用提取的關鍵字獲取相關建議
 * 5. 合併、過濾並去重結果
 *
 * 使用場景:
 * - 競爭對手網站分析
 * - 內容差距分析
 * - 快速獲取特定網站相關的關鍵字
 *
 * @param formData 包含url、region和language的對象
 * @returns 包含關鍵字建議的結果對象
 */
export async function getUrlSuggestions(
  formData: UrlFormData
): Promise<KeywordSuggestionResult> {
  const { url, region, language } = formData;

  if (!url) {
    return {
      suggestions: [],
      estimatedProcessingTime: 0,
      error: 'URL 不能為空',
      sourceInfo: '數據來源: 輸入驗證失敗'
    };
  }

  try {
    console.log(`從API分析URL: ${url}, 區域: ${region}, 語言: ${language}`);

    // Extract potential keywords from URL
    const { hostname, pathname } = new URL(url);
    const domain = hostname.replace(/^www\./, '');
    const domainParts = domain
      .split('.')
      .filter(
        part => !['com', 'org', 'net', 'edu', 'gov', 'io', 'co'].includes(part)
      );
    const pathParts = pathname
      .split('/')
      .filter(part => part && part.length > 2)
      .map(part => part.replace(/-|_/g, ' '));
    const potentialKeywords = [...domainParts, ...pathParts];

    if (potentialKeywords.length === 0) {
      return {
        suggestions: [],
        estimatedProcessingTime: 0,
        error: '無法從 URL 提取關鍵字',
        sourceInfo: '數據來源: URL 解析失敗'
      };
    }

    let allSuggestions: string[] = [];
    // Limit keywords used for fetching
    for (const keyword of potentialKeywords.slice(0, 5)) {
      const suggestions = await fetchAutocomplete(keyword, region, language);
      allSuggestions = [...allSuggestions, ...suggestions];
    }

    // Filter and deduplicate
    const filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    const uniqueSuggestions = [...new Set(filteredSuggestions)];

    console.log(`從 URL 獲取到 ${uniqueSuggestions.length} 個建議`);

    // Calculate estimated time
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);

    return {
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedVolumeTime,
      sourceInfo: '數據來源: URL 分析 + Google Autocomplete API'
    };
  } catch (error) {
    console.error('獲取 URL 建議時出錯:', error);
    return {
      suggestions: [],
      estimatedProcessingTime: 0,
      error: error instanceof Error ? error.message : '獲取 URL 建議失敗',
      sourceInfo: '數據來源: 獲取失敗'
    };
  }
}
