import { NextRequest, NextResponse } from 'next/server';

/**
 * GET 方法 - 返回 Google SERP API 使用說明文檔
 * 此方法僅返回 API 文檔，不提供實際數據
 * 要獲取 SERP 數據，請使用 Server Actions
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Google SERP API - 獲取搜尋引擎結果頁數據',
    description: '此API提供搜索引擎結果頁(SERP)數據獲取功能，返回指定關鍵字的Google搜索結果，包括標題、URL和描述。適用於SEO分析、競爭研究和內容優化。',
    endpoint: '/api/google-serp',
    status: 'API已更新',
    note: '此API現僅提供文檔。要獲取SERP數據，請使用 Next.js Server Actions。',
    recommendedUsage: '建議直接在前端使用 Server Actions 進行調用，具體方法如下：',
    serverAction: {
      import: "import { getGoogleSerpData } from '@/app/actions/google-serp';",
      usage: `
const serpData = await getGoogleSerpData({
  keyword: 'your-keyword',  // 搜索關鍵字 (必填)
  region: 'TW',             // 區域代碼 (可選，預設: TW)
  language: 'zh-TW'         // 語言代碼 (可選，預設: zh-TW)
});`
    },
    parameters: {
      keyword: '關鍵字 (必填) - 要搜索的查詢詞',
      region: '區域代碼 (可選，預設: TW) - 目標市場區域',
      language: '語言代碼 (可選，預設: zh-TW) - 目標語言'
    },
    response: {
      results: 'Array - 搜索結果列表，每個結果包含position, title, url和description',
      sourceInfo: 'String - 數據來源信息',
      timestamp: 'String - 數據獲取時間戳'
    },
    limitations: {
      maxResults: '最多返回100個搜索結果',
      apiLimits: 'API有調用頻率限制，請合理使用',
      disclaimer: '搜索結果可能因地區、設備和個人化因素而異'
    },
    additionalInfo: '如需更多幫助，請參考開發文檔或聯繫我們的支持團隊。'
  });
} 