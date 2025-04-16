import { getKeywordSuggestions } from '@/app/actions/suggestions';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 定義查詢參數的模式
const suggestionsQuerySchema = z.object({
  query: z.string().min(1, '關鍵字不能為空'),
  region: z.string().default('TW'),
  language: z.string().default('zh-TW'),
  useAlphabet: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  useSymbols: z
    .string()
    .optional()
    .transform(val => val === 'true')
});

/**
 * GET 方法 - 返回 API 使用說明文檔
 * 此方法僅返回 API 文檔，不提供實際數據
 * 要獲取關鍵字建議，請使用 Server Actions
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: '關鍵字建議API - 獲取相關搜尋建議',
    description: '此API提供關鍵字建議功能，能夠根據您提供的查詢詞生成相關的搜尋建議。適用於內容創作、SEO優化和市場調研。',
    endpoint: '/api/suggestions',
    status: 'API已更新',
    note: '此API現僅提供文檔。要獲取關鍵字建議功能，請使用 Next.js Server Actions。',
    recommendedUsage: '建議直接在前端使用 Server Actions 進行調用，具體方法如下：',
    serverAction: {
      import: "import { getKeywordSuggestions } from '@/app/actions/suggestions';",
      usage: `
const suggestions = await getKeywordSuggestions(
  query,          // 查詢關鍵字
  region,         // 區域代碼 (預設: TW)
  language,       // 語言代碼 (預設: zh-TW)
  useAlphabet,    // 是否使用字母擴展 (預設: true)
  useSymbols      // 是否使用符號擴展 (預設: false)
);`
    },
    parameters: {
      query: '關鍵字 (必填) - 要獲取建議的查詢詞',
      region: '區域代碼 (預設: TW) - 目標市場區域，例如：TW(台灣)、HK(香港)、US(美國)',
      language: '語言代碼 (預設: zh-TW) - 目標語言，例如：zh-TW(繁體中文)、zh-CN(簡體中文)、en(英文)',
      useAlphabet: '是否包含字母變體 (true/false, 預設: true) - 增加字母(A-Z)關聯詞的擴展搜索',
      useSymbols: '是否包含符號變體 (true/false, 預設: false) - 增加符號(?!等)關聯詞的擴展搜索'
    },
    response: {
      suggestions: 'Array - 關鍵字建議列表',
      estimatedProcessingTime: 'Number - 估計所需處理時間',
      sourceInfo: 'String - 數據來源信息',
      error: 'String - 錯誤信息（如有）'
    },
    additionalInfo: '如需更多幫助，請參考開發文檔或聯繫我們的支持團隊。'
  });
}
