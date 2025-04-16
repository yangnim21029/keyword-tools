'use server'

import { z } from 'zod';
import { fetchKeywordData } from '../services/serp.service';

// Define input schema
const inputSchema = z.object({
  keyword: z.string().min(1, '請輸入關鍵字'),
  region: z.string().default('TW').optional(),
  language: z.string().default('zh-TW').optional(),
});

// Define output schema
const serpResultSchema = z.object({
  results: z.array(
    z.object({
      position: z.number(),
      title: z.string(),
      url: z.string(),
      description: z.string().optional(),
    })
  ),
  sourceInfo: z.string(),
  timestamp: z.string()
});

/**
 * Google SERP 分析 - 獲取搜尋引擎結果頁數據
 * 
 * 此函數通過Apify的Google Search Scraper API獲取指定關鍵字的搜索結果頁(SERP)數據。
 * 返回包括標題、URL和描述的搜索結果列表，可用於SEO分析和競爭研究。
 * 
 * 功能特點:
 * - 獲取完整SERP數據
 * - 支持不同地區和語言設置
 * - 包含排名、標題、網址和描述
 * - 最多返回100個搜索結果
 * 
 * 使用場景:
 * - SEO競爭分析
 * - 內容差距研究
 * - 排名監控
 * - 標題和描述優化研究
 * - 反向鏈接機會發現
 * 
 * 注意事項:
 * - API有調用限制，請合理使用
 * - 結果可能因地區、設備和個人化因素而異
 * - 部分結果可能缺少描述信息
 * 
 * @param input 包含keyword、region和language的輸入對象
 * @returns SERP結果對象，包含搜索結果列表和元數據
 */
export async function getGoogleSerpData(input: { 
  keyword: string, 
  region?: string,
  language?: string
}) {
  try {
    // Validate input
    const validatedInput = inputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error('[Server Action] SERP 數據獲取輸入驗證失敗:', validatedInput.error.flatten());
      throw new Error(validatedInput.error.errors[0]?.message || '輸入參數無效');
    }
    
    const { keyword, region = 'TW', language = 'zh-TW' } = validatedInput.data;
    
    console.log(`[Server Action] 收到 Google SERP 數據請求: 關鍵字=${keyword}, 區域=${region}, 語言=${language}`);
    
    // Fetch SERP data using the service
    console.log(`[Server Action] 正在獲取 SERP 數據...`);
    const serpRawData = await fetchKeywordData(keyword);
    
    if (!serpRawData || serpRawData.includes('獲取關鍵字數據時發生錯誤')) {
      throw new Error(`無法獲取 SERP 數據: ${serpRawData}`);
    }
    
    // Parse the formatted results back into structured data
    const results: Array<{
      position: number;
      title: string;
      url: string;
      description?: string;
    }> = [];
    
    const entries = serpRawData.split('\n\n');
    
    for (const entry of entries) {
      const lines = entry.split('\n');
      if (lines.length >= 2) {
        const positionMatch = lines[0].match(/(\d+)\./);
        if (positionMatch) {
          const position = parseInt(positionMatch[1], 10);
          const title = lines[0].substring(positionMatch[0].length).trim();
          const url = lines[1].trim();
          
          results.push({
            position,
            title,
            url,
            description: '' // Descriptions are not included in the current service implementation
          });
        }
      }
    }
    
    const response = {
      results,
      sourceInfo: 'Google搜索結果由Apify API提供',
      timestamp: new Date().toISOString()
    };
    
    // Validate response
    try {
      const validatedResponse = serpResultSchema.parse(response);
      console.log(`[Server Action] SERP 數據獲取成功，共 ${validatedResponse.results.length} 條結果`);
      return validatedResponse;
    } catch (validationError) {
      console.error('[Server Action] SERP 結果驗證失敗:', validationError);
      throw new Error('SERP 數據結構驗證失敗');
    }
    
  } catch (error) {
    console.error('[Server Action] Google SERP 分析錯誤:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('執行 Google SERP 分析時發生未知錯誤');
    }
  }
} 