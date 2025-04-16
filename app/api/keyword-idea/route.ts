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

export async function GET(request: NextRequest) {
  try {
    // 獲取URL的搜索參數，在Next.js 15中是異步的
    const searchParams = request.nextUrl.searchParams;

    // 解析並驗證查詢參數
    const result = keywordResearchQuerySchema.safeParse({
      query: searchParams.get('query') || '',
      region: searchParams.get('region') || 'TW',
      language: searchParams.get('language') || 'zh-TW',
      useAlphabet: searchParams.get('useAlphabet') ?? 'false',
      useSymbols: searchParams.get('useSymbols') ?? 'false',
      minSearchVolume: searchParams.get('minSearchVolume')
    });

    if (!result.success) {
      // 返回驗證錯誤
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

// 也支持POST請求，適用於包含大量數據的請求
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
