'use server';

import { z } from "zod";
import { getKeywordSuggestionsWithDelay } from "../actions";
import { LANGUAGE_CODES, LOCATION_CODES } from "../config/constants";
import { saveKeywordResearch } from "../services/firebase/keyword-research";
import { fetchKeywordIdeas } from "../services/googleAds";

const keywordResearchSchema = z.object({
  keyword: z.string().min(1, "關鍵詞不能為空"),
  region: z.string(),
  language: z.string(),
});

export type KeywordSuggestion = {
  keyword: string;
  searchVolume: number;
  relevance: number;
};

export type AdPlanningData = {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
};

interface KeywordIdeaMetrics {
  avgMonthlySearches?: number;
  competition?: number;
  lowTopOfPageBidMicros?: number;
}

interface KeywordIdea {
  text?: string;
  keywordIdeaMetrics?: KeywordIdeaMetrics;
}

interface KeywordIdeaResponse {
  results?: KeywordIdea[];
}

export async function createKeywordResearch(formData: FormData) {
  const validatedFields = keywordResearchSchema.safeParse({
    keyword: formData.get("keyword"),
    region: formData.get("region"),
    language: formData.get("language"),
  });

  if (!validatedFields.success) {
    throw new Error("表單驗證失敗");
  }

  try {
    const { keyword, region, language } = validatedFields.data;
    
    // 檢查必要的參數
    if (!LOCATION_CODES[region]) {
      throw new Error(`不支持的地區: ${region}`);
    }

    // 轉換語言代碼格式
    const apiLanguage = language.replace('-', '_');
    if (!LANGUAGE_CODES[apiLanguage]) {
      throw new Error(`不支持的語言: ${language}`);
    }
    
    // 1. 獲取關鍵詞建議
    const suggestionsResult = await getKeywordSuggestionsWithDelay(keyword, region, language);
    console.log('關鍵詞建議:', suggestionsResult);

    if (!suggestionsResult.suggestions.length) {
      throw new Error("未找到相關關鍵詞建議");
    }

    // 2. 批次處理關鍵詞
    const batchSize = 20;
    const allKeywordIdeas: AdPlanningData[] = [];
    
    for (let i = 0; i < suggestionsResult.suggestions.length; i += batchSize) {
      const batch = suggestionsResult.suggestions.slice(i, i + batchSize);
      console.log(`處理第 ${i/batchSize + 1} 批關鍵詞:`, batch);
      
      try {
        const keywordIdeas = await fetchKeywordIdeas(
          batch,
          LOCATION_CODES[region],
          LANGUAGE_CODES[apiLanguage]
        ) as KeywordIdeaResponse;
        
        // 確保 keywordIdeas.results 存在並且是數組
        const results = keywordIdeas.results || [];
        allKeywordIdeas.push(...results.map((idea: KeywordIdea) => ({
          keyword: idea.text || '',
          searchVolume: idea.keywordIdeaMetrics?.avgMonthlySearches || 0,
          competition: idea.keywordIdeaMetrics?.competition || 0,
          cpc: idea.keywordIdeaMetrics?.lowTopOfPageBidMicros 
            ? Number((idea.keywordIdeaMetrics.lowTopOfPageBidMicros / 1000000).toFixed(2))
            : 0
        })));
        console.log(`第 ${i/batchSize + 1} 批結果:`, results.length);
      } catch (error) {
        console.error(`處理第 ${i/batchSize + 1} 批關鍵詞時發生錯誤:`, error);
        // 繼續處理下一批，而不是完全中止
        continue;
      }
      
      // 避免 API 限制，每批之間暫停 1 秒
      if (i + batchSize < suggestionsResult.suggestions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (!allKeywordIdeas.length) {
      throw new Error("無法獲取關鍵詞規劃數據");
    }
    
    // 3. 保存到 Firebase
    const researchId = await saveKeywordResearch(
      keyword,
      region,
      language,
      suggestionsResult.suggestions,
      allKeywordIdeas
    );

    if (!researchId) {
      throw new Error("保存關鍵詞研究失敗");
    }

    return researchId;
  } catch (error) {
    console.error('關鍵詞研究失敗:', error);
    // 返回更具體的錯誤信息
    throw new Error(error instanceof Error ? error.message : "關鍵詞研究失敗");
  } 
} 