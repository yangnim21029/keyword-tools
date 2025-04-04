/* eslint-disable @typescript-eslint/no-explicit-any */
import type { firestore } from 'firebase-admin'; // Correct import path
import { z } from 'zod';

/**
 * 通用的 ID Schema
 */
export const idSchema = z.string().cuid2({ message: "無效的 Cuid2 ID" });

/**
 * Firestore Timestamp Schema
 * 處理 Firebase Timestamp 轉換為 Date 對象
 */
export const firestoreTimestampSchema = z.preprocess(
  (arg: unknown) => { // Use unknown
    // Check if it's a Firestore Timestamp object (duck typing)
    if (typeof arg === 'object' && arg !== null && typeof (arg as { toDate?: () => Date }).toDate === 'function') {
      return (arg as { toDate: () => Date }).toDate();
    }
    // Check if it's a string representation of a date or timestamp number
    if (typeof arg === 'string' || typeof arg === 'number') {
      try {
        const date = new Date(arg);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {}
    }
    // If it's already a Date object, return it
    if (arg instanceof Date) {
      return arg;
    }
    // Return undefined if it cannot be processed, Zod will handle the error
    return undefined;
  },
  z.date({ required_error: "Timestamp is required", invalid_type_error: "Invalid Timestamp format" })
);

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
      } catch {
        console.error("JSON 解析失敗");
        return json; // 解析失敗時原樣返回
      }
    }
    return json;
  }, schema);

// 從 Schema 推導出 TypeScript 類型
export type Id = z.infer<typeof idSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type ApiResponse<T = unknown> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & { data: T | null };

// Define a schema for an object where keys are strings and values are strings.
export const stringRecordSchema = z.record(z.string());

// Define a schema for Firestore document references if needed (example)
export const documentReferenceSchema = z.custom<
  firestore.DocumentReference
>(
  (val: unknown): val is firestore.DocumentReference => {
    return typeof val === 'object' && val !== null && typeof (val as firestore.DocumentReference).path === 'string';
  },
  { message: "無效的 Firestore DocumentReference" }
);

// Schema for user ID, assuming it's an object with an 'id' property
export const userIdSchema = z.object({
  id: idSchema,
});

// Helper function to transform/validate CUID or NanoID
export const cuidOrNanoidTransform = (
  value: unknown,
  ctx: z.RefinementCtx
): string | undefined => {
  if (!value || typeof value !== 'string') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ID 必須是字符串",
    });
    return undefined; // Return undefined on failure
  }
  // Add validation logic if needed (e.g., regex check for CUID/NanoID format)
  // For now, just return the string value if it's a non-empty string
  if (value.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "ID 不能為空字符串",
    });
    return undefined; // Return undefined on failure
  }
  return value; // <<<< ADDED Missing return for valid string
};

export const safeJsonParse = (data: unknown): unknown => {
  try {
     return typeof data === 'string' ? JSON.parse(data) : data;
  } catch {
    console.error("JSON 解析失敗");
    return data; // 返回原始數據
  }
};
