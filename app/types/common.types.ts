import {
  firestoreTimestampSchema,
  idSchema, // 注意：這是 z.preprocess 返回的 ZodDate，不是直接推斷的類型
  paginationSchema
} from '@/lib/schemas/common.schema';
import { z } from 'zod';

/**
 * Common ID structure derived from schema.
 */
export type Id = z.infer<typeof idSchema>;

/**
 * Common Pagination parameters derived from schema.
 */
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Common API response structure derived from schema.
 * Use the generic type `ApiResponse<T>` exported from the schema file itself.
 */
export { type ApiResponse } from '@/lib/schemas/common.schema';

/**
 * Type for Firestore Timestamp after preprocessing (should be Date).
 */
export type FirestoreTimestamp = z.infer<typeof firestoreTimestampSchema>; 