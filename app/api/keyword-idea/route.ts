import { processAndSaveKeywordQuery } from '@/app/actions/keyword-research';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// 定義API請求參數的模式
const keywordResearchQuerySchema = z.object({
  query: z.string().min(1, '關鍵字或URL不能為空'),
  region: z.string().default('TW'),
  language: z.string().default('zh-TW'),
  useAlphabet: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  useSymbols: z
    .string()
    .optional()
    .transform(val => val === 'true'),
  minSearchVolume: z
    .string()
    .optional()
    .transform(val => (val ? parseInt(val, 10) : undefined))
});

/**
 * GET 方法 - 返回 API 使用說明文檔
 * 此方法僅返回 API 文檔，不提供實際數據
 * 要獲取數據請使用 POST 方法
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: '關鍵字研究API - 獲取相關關鍵字及搜索量數據',
    description: '此API提供關鍵字研究功能，能夠根據您提供的關鍵字或URL生成相關關鍵字建議，並估算其搜索量。適用於SEO優化、內容規劃和市場分析。',
    endpoint: '/api/keyword-idea',
    methods: ['POST'],
    note: '請注意：此API僅支持通過POST方法獲取數據，GET方法僅提供使用文檔。',
    requestBody: {
      query: '關鍵字或URL (必填) - 您想要研究的關鍵字詞組或網址',
      region: '區域代碼 (預設: TW) - 目標市場區域，例如：TW(台灣)、HK(香港)、US(美國)',
      language: '語言代碼 (預設: zh-TW) - 目標語言，例如：zh-TW(繁體中文)、zh-CN(簡體中文)、en(英文)',
      useAlphabet: '是否包含字母變體 (true/false, 預設: false) - 增加字母(A-Z)關聯詞的擴展搜索',
      useSymbols: '是否包含符號變體 (true/false, 預設: false) - 增加符號(?!等)關聯詞的擴展搜索',
      minSearchVolume: '最小搜索量過濾 (可選) - 僅返回搜索量不低於此值的關鍵字'
    },
    response: {
      success: 'Boolean - 請求是否成功',
      researchId: 'String - 研究結果的唯一識別碼，可用於後續查詢',
      keywords: 'Array - 關鍵字數據列表，包含關鍵字、搜索量、競爭度等信息',
      stats: 'Object - 研究結果的統計信息，如總關鍵字數量、平均搜索量等',
      sourceInfo: 'String - 數據來源信息'
    },
    examples: {
      javascript: `
// 使用 fetch API (POST)
async function postKeywordIdeas() {
  const response = await fetch('/api/keyword-idea', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'seo工具',
      region: 'TW',
      language: 'zh-TW',
      useAlphabet: true,
      useSymbols: false,
      minSearchVolume: 100
    }),
  });
  const data = await response.json();
  console.log(data);
}`,
      python: `
# 使用 requests 庫 (POST)
import requests

def post_keyword_ideas():
    response = requests.post(
        'https://your-domain.com/api/keyword-idea',
        json={
            'query': 'seo工具',
            'region': 'TW',
            'language': 'zh-TW',
            'useAlphabet': True,
            'useSymbols': False,
            'minSearchVolume': 100
        }
    )
    data = response.json()
    print(data)`,
      curl: `
# POST 請求示例
curl -X POST 'https://your-domain.com/api/keyword-idea' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "query": "seo工具",
    "region": "TW",
    "language": "zh-TW",
    "useAlphabet": true,
    "useSymbols": false,
    "minSearchVolume": 100
  }'`
    },
    limitations: {
      rateLimit: '100次請求/小時',
      maxKeywords: '最多返回500個關鍵字',
      dataFreshness: '搜索量數據每月更新'
    },
    additionalInfo: '如需更多幫助或申請API密鑰，請聯絡我們的支持團隊。'
  });
}

// 支持POST請求，用於包含大量數據的請求
export async function POST(request: NextRequest) {
  try {
    // 獲取請求體
    const body = await request.json();

    // 使用相同的schema進行驗證
    const result = keywordResearchQuerySchema.safeParse({
      query: body.query || '',
      region: body.region || 'TW',
      language: body.language || 'zh-TW',
      useAlphabet: body.useAlphabet?.toString(),
      useSymbols: body.useSymbols?.toString(),
      minSearchVolume: body.minSearchVolume?.toString()
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: '參數驗證失敗',
          details: result.error.format()
        },
        { status: 400 }
      );
    }

    // 解構驗證後的參數
    const {
      query,
      region,
      language,
      useAlphabet,
      useSymbols,
      minSearchVolume
    } = result.data;

    // 調用server action處理關鍵字研究
    const researchResult = await processAndSaveKeywordQuery({
      query,
      region,
      language,
      useAlphabet: useAlphabet ?? false, // 預設為false
      useSymbols: useSymbols ?? false, // 預設為false
      minSearchVolume: minSearchVolume
    });

    // 返回結果
    // revalidatePath('/keyword-mapping');
    return NextResponse.json(researchResult);
  } catch (error) {
    console.error('API路由錯誤:', error);
    return NextResponse.json(
      {
        success: false,
        researchId: null,
        error: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}
