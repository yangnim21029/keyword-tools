import { z } from 'zod';

/**
 * 通用的 ID Schema
 */
export const idSchema = z.object({
  id: z.string().uuid({
    message: "無效的 UUID 格式"
  })
});

/**
 * Firestore Timestamp Schema
 * 處理 Firebase Timestamp 轉換為 Date 對象
 */
export const firestoreTimestampSchema = z.preprocess((arg) => {
  // 如果已經是 Date 對象，直接返回
  if (arg instanceof Date) return arg;
  // 如果是 Firebase Timestamp 對象 (包含 toDate 方法)
  if (typeof arg === 'object' && arg !== null && typeof (arg as any).toDate === 'function') {
    return (arg as any).toDate();
  }
  // 嘗試其他方式轉換
  try {
    return new Date(arg as any);
  } catch (e) {
    return arg; // 無法轉換時原樣返回，讓 Zod 處理錯誤
  }
}, z.date());

/**
 * 通用分頁參數 Schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/**
 * API 響應基礎 Schema
 */
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().nullable(),
  error: z.any().nullable(),
  timestamp: z.string().datetime(),
});

/**
 * 通用的 JSON 序列化 & 反序列化處理器
 * 可用於處理 localStorage 和 sessionStorage 中的值
 */
export const jsonSchema = <T extends z.ZodType>(schema: T) => 
  z.preprocess((json) => {
    if (typeof json === 'string') {
      try {
        return JSON.parse(json);
      } catch (e) {
        return json; // 解析失敗時原樣返回
      }
    }
    return json;
  }, schema);

// 從 Schema 推導出 TypeScript 類型
export type Id = z.infer<typeof idSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type ApiResponse<T = any> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & { data: T | null }; 