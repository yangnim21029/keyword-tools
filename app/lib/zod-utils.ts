import { z } from 'zod';

/**
 * 處理 Zod 驗證錯誤並返回標準化的錯誤對象
 */
export function formatZodError(error: z.ZodError) {
  return {
    status: 'error',
    code: 'VALIDATION_ERROR',
    errors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }))
  };
}

/**
 * 創建標準格式的 API 响應
 */
export function createApiResponse<T>(success: boolean, data?: T, error?: unknown) {
  return {
    success,
    data: data || null,
    error: error || null,
    timestamp: new Date().toISOString()
  };
}

/**
 * 安全解析 Zod schema，出錯時返回 null 並記錄警告
 * @param schema Zod schema
 * @param data 要驗證的數據
 * @param label 用於日誌的標籤名稱
 * @param throwOnError 是否在錯誤時拋出異常，默認為 false
 * @returns 驗證成功返回解析後的數據，失敗返回 null
 */
export function safeParse<T extends z.ZodType>(
  schema: T, 
  data: unknown, 
  label: string = '數據', 
  throwOnError: boolean = false
): z.infer<T> | null {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.warn(`${label}驗證失敗:`, result.error.format());
    
    if (throwOnError) {
      throw new Error(`${label}驗證失敗: ${result.error.message}`);
    }
    
    return null;
  }
  
  return result.data;
}

/**
 * 將 schema.parse 包裝在 try/catch 中，並返回結果或 null
 * 類似於 safeParse，但不返回結果對象，而是直接返回數據或 null
 */
export function validateOrNull<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> | null {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('數據驗證失敗:', error.format());
    }
    return null;
  }
}

/**
 * 用於 API 路由的 Zod 驗證中間件
 * @param schema 用於驗證請求體的 Zod schema
 * @param handler 處理驗證通過的數據的函數
 * @returns 返回一個處理 Request 的函數
 */
export function validateRequest<T extends z.ZodType, R = Response>(
  schema: T,
  handler: (data: z.infer<T>) => Promise<R>
) {
  return async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        return Response.json(
          createApiResponse(false, null, formatZodError(result.error)),
          { status: 400 }
        );
      }
      
      return handler(result.data) as unknown as Response;
    } catch (error) {
      console.error('請求處理錯誤:', error);
      return Response.json(
        createApiResponse(false, null, { message: '處理請求時發生錯誤' }),
        { status: 500 }
      );
    }
  };
}

/**
 * 驗證 FormData 數據
 * 處理表單數據的特殊情況，包括布爾值和數字的轉換
 * @param schema 用於驗證的 Zod schema
 * @param formData FormData 對象
 */
export function validateFormData<T extends z.ZodType>(
  schema: T, 
  formData: FormData
): z.infer<T> | null {
  // 將 FormData 轉換為普通對象
  const data = Object.fromEntries(formData.entries());
  
  // FormData 的值都是字符串，使用 safeParse
  return safeParse(schema, data, 'FormData');
}

/**
 * 驗證 URLSearchParams 數據
 * 處理 URL 查詢參數，包括數組參數的特殊處理
 * @param schema 用於驗證的 Zod schema
 * @param searchParams URLSearchParams 對象
 */
export function validateSearchParams<T extends z.ZodType>(
  schema: T, 
  searchParams: URLSearchParams
): z.infer<T> | null {
  // 將 URLSearchParams 轉換為普通對象，處理數組參數
  const data: Record<string, string | string[]> = {};
  
  for (const [key, value] of searchParams.entries()) {
    if (key.endsWith('[]')) {
      // 處理數組參數，例如 items[]
      const arrayKey = key.slice(0, -2);
      if (!data[arrayKey]) {
        data[arrayKey] = [];
      }
      (data[arrayKey] as string[]).push(value);
    } else {
      data[key] = value;
    }
  }
  
  return safeParse(schema, data, 'URL 查詢參數');
} 