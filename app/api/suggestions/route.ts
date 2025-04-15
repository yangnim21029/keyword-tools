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

export async function GET(request: NextRequest) {
  try {
    // 獲取URL的搜索參數，在Next.js 15中是異步的
    const searchParams = request.nextUrl.searchParams;

    // 解析並驗證查詢參數
    const result = suggestionsQuerySchema.safeParse({
      query: searchParams.get('query') || '',
      region: searchParams.get('region') || 'TW',
      language: searchParams.get('language') || 'zh-TW',
      useAlphabet: searchParams.get('useAlphabet'),
      useSymbols: searchParams.get('useSymbols')
    });

    if (!result.success) {
      // 返回驗證錯誤
      return NextResponse.json(
        { error: '參數驗證失敗', details: result.error.format() },
        { status: 400 }
      );
    }

    // 解構驗證後的參數
    const { query, region, language, useAlphabet, useSymbols } = result.data;

    // 調用server action獲取關鍵字建議
    const suggestions = await getKeywordSuggestions(
      query,
      region,
      language,
      useAlphabet ?? false, // 預設為true
      useSymbols ?? false // 預設為false
    );

    // 返回結果
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('API路由錯誤:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知錯誤',
        suggestions: [],
        estimatedProcessingTime: 0,
        sourceInfo: '獲取建議失敗'
      },
      { status: 500 }
    );
  }
}
