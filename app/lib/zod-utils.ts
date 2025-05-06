import { z } from "zod";

/**
 * 處理 Zod 驗證錯誤並返回標準化的錯誤對象
 */
export function formatZodError(error: z.ZodError) {
  return {
    status: "error",
    code: "VALIDATION_ERROR",
    errors: error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    })),
  };
}

/**
 * 創建標準格式的 API 响應
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: unknown,
) {
  return {
    success,
    data: data || null,
    error: error || null,
    timestamp: new Date().toISOString(),
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
  label: string = "數據",
  throwOnError: boolean = false,
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
