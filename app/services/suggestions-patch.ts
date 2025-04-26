import type { KeywordSuggestionResult } from '@/app/services/firebase';
import { hasSimplifiedChinese } from '@/lib/utils';
import { ALPHABET, SYMBOLS } from '../global-config';
import { fetchAutocomplete } from './suggestion.service';

// Interface for performFetchKeywordSuggestions parameters
interface performFetchKeywordSuggestionsParams {
  query: string;
  region: string;
  language: string;
  useAlphabet?: boolean;
  useSymbols?: boolean;
}

/**
 * 輔助函式：根據提供的字元集（字母或符號）擴展查詢建議
 * @param baseQuery - 基礎查詢詞
 * @param region - 地區代碼
 * @param language - 語言代碼
 * @param characters - 要用於擴展的字元陣列 (例如 ALPHABET 或 SYMBOLS)
 * @returns - 擴展後的建議關鍵字列表 (已攤平)
 */
async function fetchExpandedSuggestions(
  baseQuery: string,
  region: string,
  language: string,
  characters: string[]
): Promise<string[]> {
  // 建立在查詢詞「前面」加上字元的 API 請求 Promises
  const prefixPromises = characters.map(char =>
    fetchAutocomplete(`${char} ${baseQuery}`, region, language)
  );
  // 建立在查詢詞「後面」加上字元的 API 請求 Promises
  const suffixPromises = characters.map(char =>
    fetchAutocomplete(`${baseQuery} ${char}`, region, language)
  );

  // 同時執行所有前綴和後綴的 API 請求
  const [prefixResults, suffixResults] = await Promise.all([
    Promise.all(prefixPromises), // 等待所有前綴請求完成
    Promise.all(suffixPromises) // 等待所有後綴請求完成
  ]);

  // 將兩組結果（都是二維陣列）攤平成一維陣列並合併
  return prefixResults.flat().concat(suffixResults.flat());
}

/**
 * 主要函式：執行關鍵字建議的抓取與處理
 * @param params - 包含查詢詞、地區、語言及擴展選項的參數物件
 * @returns - 包含建議列表、預估處理時間、來源資訊及潛在錯誤的結果物件
 */
export async function performFetchKeywordSuggestions({
  query,
  region,
  language,
  useAlphabet = false,
  useSymbols = false
}: performFetchKeywordSuggestionsParams): Promise<KeywordSuggestionResult> {
  console.log(
    '[performFetchKeywordSuggestions] Starting suggestion fetch for:',
    query
  );

  const trimQuery = query.trim();

  if (!trimQuery) {
    // 如果查詢詞為空，直接回傳空結果
    return {
      suggestions: [],
      sourceInfo: '數據來源: 無有效查詢詞'
    };
  }

  try {
    // 1. 執行基礎查詢 (不加任何字母或符號)
    const baseResults = await fetchAutocomplete(trimQuery, region, language);
    let allSuggestions: string[] = [...baseResults]; // 初始化建議列表

    // 2. 如果啟用字母擴展，呼叫輔助函式取得字母擴展建議
    if (useAlphabet) {
      console.log(
        '[performFetchKeywordSuggestions] Fetching alphabet suggestions...'
      );
      const alphabetSuggestions = await fetchExpandedSuggestions(
        trimQuery,
        region,
        language,
        ALPHABET
      );
      allSuggestions = allSuggestions.concat(alphabetSuggestions); // 合併結果
      console.log(
        '[performFetchKeywordSuggestions] Alphabet suggestions fetched.'
      );
    }

    // 3. 如果啟用符號擴展，呼叫輔助函式取得符號擴展建議
    if (useSymbols) {
      console.log(
        '[performFetchKeywordSuggestions] Fetching symbol suggestions...'
      );
      const symbolSuggestions = await fetchExpandedSuggestions(
        trimQuery,
        region,
        language,
        SYMBOLS
      );
      allSuggestions = allSuggestions.concat(symbolSuggestions); // 合併結果
      console.log(
        '[performFetchKeywordSuggestions] Symbol suggestions fetched.'
      );
    }

    // 4. 過濾與去重
    console.log(
      `[performFetchKeywordSuggestions] Total suggestions before filtering: ${allSuggestions.length}`
    );
    // Filter suggestions that do *not* have simplified Chinese
    const filteredSuggestions = allSuggestions.filter(
      suggestion => !hasSimplifiedChinese(suggestion)
    );
    const uniqueSuggestions: string[] = [...new Set(filteredSuggestions)]; // No need for type assertion if input is already string[]
    console.log(
      `[performFetchKeywordSuggestions] Unique suggestions after filtering: ${uniqueSuggestions.length}`
    );

    // 6. 回傳成功結果
    return {
      suggestions: uniqueSuggestions,
      sourceInfo: '數據來源: Google Autocomplete API'
    };
  } catch (error) {
    // 7. 處理錯誤情況
    console.error(
      '[performFetchKeywordSuggestions] Error fetching suggestions:',
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error fetching keyword suggestions';
    return {
      suggestions: [],
      sourceInfo: '數據來源: 獲取失敗',
      error: errorMessage
    };
  }
}

// Interface for getUrlSuggestions parameters (renamed from UrlFormData)
interface GetUrlSuggestionsParams {
  url: string;
  region: string;
  language: string;
}

export async function getUrlSuggestions(
  formData: GetUrlSuggestionsParams
): Promise<KeywordSuggestionResult> {
  const { url, region, language } = formData;

  if (!url) {
    return {
      suggestions: [],
      sourceInfo: '數據來源: 輸入驗證失敗'
    };
  }

  try {
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
    // Filter suggestions that do *not* have simplified Chinese
    const filteredSuggestions = allSuggestions.filter(
      suggestion => !hasSimplifiedChinese(suggestion)
    );
    const uniqueSuggestions: string[] = [...new Set(filteredSuggestions)]; // No need for type assertion

    return {
      suggestions: uniqueSuggestions,
      sourceInfo: '數據來源: URL 分析 + Google Autocomplete API'
    };
  } catch (error) {
    return {
      suggestions: [],
      error: error instanceof Error ? error.message : '獲取 URL 建議失敗',
      sourceInfo: '數據來源: 獲取失敗'
    };
  }
}
