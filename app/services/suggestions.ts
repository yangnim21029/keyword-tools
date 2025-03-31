import { KeywordSuggestion } from "../actions/keyword-research.actions";

interface GetSuggestionsParams {
  keyword: string;
  region: string;
  language: string;
}

// 模擬 API 調用
export async function getSuggestions({
  keyword,
  region,
  language,
}: GetSuggestionsParams): Promise<KeywordSuggestion[]> {
  // 模擬 API 延遲
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 模擬建議詞數據
  return [
    {
      keyword: `${keyword} 教學`,
      searchVolume: Math.floor(Math.random() * 10000),
      relevance: 95,
    },
    {
      keyword: `${keyword} 推薦`,
      searchVolume: Math.floor(Math.random() * 8000),
      relevance: 90,
    },
    {
      keyword: `${keyword} 評價`,
      searchVolume: Math.floor(Math.random() * 6000),
      relevance: 85,
    },
    {
      keyword: `${keyword} 比較`,
      searchVolume: Math.floor(Math.random() * 4000),
      relevance: 80,
    },
    {
      keyword: `${keyword} 價格`,
      searchVolume: Math.floor(Math.random() * 3000),
      relevance: 75,
    },
  ];
} 