'use server';

import { ALPHABET, SYMBOLS } from '@/app/config/constants';
import {
  estimateProcessingTime,
  filterSimplifiedChinese
} from '@/app/services/KeywordDataService';
import { fetchAutocomplete } from '@/app/services/suggestion.service';
import { KeywordSuggestionResult } from '@/lib/schema';

// Note: Caching logic was commented out in the original file and remains so here.
// Implement server-side caching (e.g., using unstable_cache or external store) if needed.

// Refactored getKeywordSuggestions
export async function getKeywordSuggestions(
  query: string,
  region: string,
  language: string,
  useAlphabet: boolean = true,
  useSymbols: boolean = false
): Promise<KeywordSuggestionResult> {
  const searchPrefix = query.trim();

  try {
    console.log(
      `從API獲取關鍵詞建議: ${searchPrefix}, 區域: ${region}, 語言: ${language}, A:${useAlphabet}, S:${useSymbols}`
    );

    let allSuggestions: string[] = [];

    // Base search
    const baseResults = await fetchAutocomplete(searchPrefix, region, language);
    allSuggestions = [...baseResults];

    // Alphabet expansion
    if (useAlphabet) {
      const alphabetPromises = ALPHABET.map(letter =>
        fetchAutocomplete(`${searchPrefix} ${letter}`, region, language)
      );
      const alphabetResults = await Promise.all(alphabetPromises);
      allSuggestions = [...allSuggestions, ...alphabetResults.flat()];
    }

    // Symbol expansion
    if (useSymbols) {
      const symbolPromises = SYMBOLS.map(symbol =>
        fetchAutocomplete(`${searchPrefix} ${symbol}`, region, language)
      );
      const symbolResults = await Promise.all(symbolPromises);
      allSuggestions = [...allSuggestions, ...symbolResults.flat()];
    }

    // Add space variations for chinese keywords, not CJK
    const spaceVariations: string[] = [];
    // use query without english letters and symbols
    const queryWithoutEnglish = query.replace(/[a-zA-Z0-9]/g, '');
    // 在不同的 index 插入空格
    for (let i = 0; i < queryWithoutEnglish.length; i++) {
      const spacedKeyword =
        queryWithoutEnglish.slice(0, i) + ' ' + queryWithoutEnglish.slice(i);
      spaceVariations.push(spacedKeyword);
    }
    console.log(spaceVariations);
    allSuggestions = [...spaceVariations, ...allSuggestions];

    // Filter and deduplicate
    const filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    const uniqueSuggestions = [...new Set(filteredSuggestions)];

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
    console.error('獲取關鍵詞建議時出錯:', error);
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
        error: '無法從 URL 提取關鍵詞',
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
