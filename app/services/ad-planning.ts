import { AdPlanningData } from "../actions/keyword-research.actions";

interface GetAdPlanningDataParams {
  keyword: string;
  region: string;
  language: string;
}

// 模擬 API 調用
export async function getAdPlanningData({
  keyword,
  region,
  language,
}: GetAdPlanningDataParams): Promise<AdPlanningData> {
  // 模擬 API 延遲
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 模擬廣告規劃數據
  return {
    keyword,
    searchVolume: Math.floor(Math.random() * 10000),
    competition: Math.random(),
    cpc: Math.random() * 5,
  };
} 