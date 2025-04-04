'use server';

import { ALPHABET, SYMBOLS } from '@/app/config/constants';
import { estimateProcessingTime, filterSimplifiedChinese, getSearchVolume as getSearchVolumeService } from '@/app/services/KeywordDataService';
import {
  fetchAutocomplete,
  fetchSuggestionWithDelay, // Keep this if getKeywordSuggestionsWithDelay uses it
} from '@/app/services/suggestion.service';
import { KeywordSuggestionResult, KeywordVolumeResult } from '@/app/types/keyword.types';

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
    console.log(`從API獲取關鍵詞建議: ${searchPrefix}, 區域: ${region}, 語言: ${language}, A:${useAlphabet}, S:${useSymbols}`);

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

    // Filter and deduplicate
    const filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    const uniqueSuggestions = [...new Set(filteredSuggestions)];

    // Calculate estimated time
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);

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
      error: error instanceof Error ? error.message : 'Unknown error fetching keyword suggestions'
    };
  }
}

// Refactored getUrlSuggestions
interface UrlFormData {
  url: string;
  region: string;
  language: string;
}
export async function getUrlSuggestions(formData: UrlFormData): Promise<KeywordSuggestionResult> {
  const { url, region, language } = formData;

  if (!url) {
    return { suggestions: [], estimatedProcessingTime: 0, error: 'URL 不能為空', sourceInfo: '數據來源: 輸入驗證失敗' };
  }

  try {
    console.log(`從API分析URL: ${url}, 區域: ${region}, 語言: ${language}`);

    // Extract potential keywords from URL
    const { hostname, pathname } = new URL(url);
    const domain = hostname.replace(/^www\./, '');
    const domainParts = domain.split('.').filter(part => !['com', 'org', 'net', 'edu', 'gov', 'io', 'co'].includes(part));
    const pathParts = pathname.split('/').filter(part => part && part.length > 2).map(part => part.replace(/-|_/g, ' '));
    const potentialKeywords = [...domainParts, ...pathParts];

    if (potentialKeywords.length === 0) {
      return { suggestions: [], estimatedProcessingTime: 0, error: '無法從 URL 提取關鍵詞', sourceInfo: '數據來源: URL 解析失敗' };
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

// getKeywordSuggestionsWithDelay (Moved from original actions.ts)
export async function getKeywordSuggestionsWithDelay(query: string, region: string, language: string): Promise<KeywordSuggestionResult> {
  const searchPrefix = query.trim();
  try {
    console.log(`Fetching suggestions with delay for: ${searchPrefix}`);
    const suggestions = await fetchSuggestionWithDelay(searchPrefix, region, language);
    const uniqueSuggestions = [...new Set(filterSimplifiedChinese(suggestions))];
    const estimatedTime = estimateProcessingTime(uniqueSuggestions, true);

    return {
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedTime,
      sourceInfo: '數據來源: Google Autocomplete API (with delay)'
    };
  } catch (error) {
    console.error('Error fetching suggestions with delay:', error);
    return {
      suggestions: [],
      estimatedProcessingTime: 0,
      sourceInfo: '數據來源: 獲取失敗 (with delay)',
      error: error instanceof Error ? error.message : 'Unknown error fetching delayed suggestions'
    };
  }
}

// Action to fetch search volume
export async function fetchSearchVolume(
  keywords: string[],
  region: string,
  url: string | undefined, // Change null to undefined
  language: string
): Promise<KeywordVolumeResult> {
  console.log(`Fetching search volume for ${keywords.length} keywords. Region: ${region}, Lang: ${language}, URL: ${url}`);
  try {
    // Correct the number of arguments passed to getSearchVolumeService
    // Assuming getSearchVolumeService corresponds to the updated getSearchVolume
    const result = await getSearchVolumeService(keywords, region);
    // Return the result directly (assuming the service function handles errors appropriately or throws)
    // Add basic error handling if service doesn't throw
    if (!result || !result.results) {
        throw new Error('Invalid response from search volume service');
    }
    return result;
  } catch (error) {
    console.error('Error fetching search volume via action:', error);
    // Return an error structure compatible with KeywordVolumeResult
    // Adjust this structure based on the actual definition of KeywordVolumeResult
    return {
      results: [],
      processingTime: { estimated: 0, actual: 0 },
      sourceInfo: '數據來源: 獲取失敗 (Action Error)',
      error: error instanceof Error ? error.message : 'Unknown error fetching search volume'
    } as KeywordVolumeResult; // Type assertion might be needed
  }
} 