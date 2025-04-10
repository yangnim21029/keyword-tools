import { z } from 'zod';
import { firestoreTimestampSchema as TimestampSchema, idSchema as UserIDSchema } from './common.schema';
import { keywordVolumeItemSchema } from './keyword.schema';

export const ClusterSchema = z.record(z.string(), z.array(z.string()))
  .describe('語義分群結果: 主題名稱映射到關鍵詞數組');

export const PersonaSchema = z.record(z.string(), z.string())
  .describe('用戶畫像映射: 畫像名稱映射到描述');

// Base schema for keyword research data
export const KeywordResearchBaseSchema = z.object({
  query: z.string().min(1, '主關鍵詞不能為空').describe('主關鍵詞'),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  keywords: z.array(keywordVolumeItemSchema).optional().describe('關鍵詞列表及其搜索量數據'),
  clusters: ClusterSchema.optional().describe('語義分群結果'),
  personas: PersonaSchema.optional().describe('用戶畫像映射'),
  userPersona: z.string().optional().describe('基於分群生成的單一用戶畫像總結 (可選, 可能與 personas 重疊)'),
  searchEngine: z.string().optional().describe('使用的搜尋引擎 (例如 google)'),
  location: z.string().optional().describe('地區代碼 (例如 TW)'),
  language: z.string().optional().describe('語言代碼 (例如 zh-TW)'),
  device: z.enum(['desktop', 'mobile']).optional().describe('設備類型'),
  isFavorite: z.boolean().default(false).describe('是否收藏'),
  tags: z.array(z.string()).optional().describe('用戶自定義標籤'),
});

// Schema including the ID
export const KeywordResearchSchema = KeywordResearchBaseSchema.extend({
  id: z.string().describe('記錄的唯一標識符'),
});

// Schema for creating new research entries
export const CreateKeywordResearchSchema = KeywordResearchBaseSchema.pick({
    // Pick required fields for creation
    query: true,
    // userId: true, // Removed - Handled by Firebase Admin
    // Pick optional fields that can be provided at creation
    searchEngine: true,
    location: true,
    language: true,
    device: true,
    isFavorite: true,
    tags: true,
}).partial({
    // Make the optional fields truly optional
    searchEngine: true,
    location: true,
    language: true,
    device: true,
    isFavorite: true,
    tags: true,
}); // Note: id, createdAt, updatedAt, keywords, clusters, personas, userPersona are excluded

// Schema for updating existing research entries (general update)
export const UpdateKeywordResearchSchema = KeywordResearchBaseSchema.pick({
  query: true,
  keywords: true,
  clusters: true,
  personas: true,
  userPersona: true,
  searchEngine: true,
  location: true,
  language: true,
  device: true,
  isFavorite: true,
  tags: true,
})
  .partial()
  .extend({
    updatedAt: TimestampSchema.default(() => new Date()),
  });

// Specific update schemas remain the same but might need adjustment
// if userPersona is removed or personas logic changes.
export const UpdateClustersSchema = z.object({
  clusters: ClusterSchema,
  updatedAt: TimestampSchema.default(() => new Date()),
});

// Consider if UpdateUserPersonaSchema is still needed or should be UpdatePersonasSchema
export const UpdateUserPersonaSchema = z.object({
  userPersona: z.string(),
  updatedAt: TimestampSchema.default(() => new Date()),
});

export const UpdatePersonasSchema = z.object({
  personas: PersonaSchema,
  updatedAt: TimestampSchema.default(() => new Date()),
});

// Schema for a keyword research item (full data)
export const keywordResearchItemSchema = KeywordResearchSchema;

/**
 * Schema for a list item (potentially omitting large fields)
 */
export const keywordResearchListItemSchema = keywordResearchItemSchema.omit({
  keywords: true,
  clusters: true,
  personas: true,
  userPersona: true,
});

/**
 * Schema for filtering keyword research queries
 */
export const keywordResearchFilterSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  language: z.string().optional(),
  isFavorite: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  createdAtFrom: TimestampSchema.optional(),
  createdAtTo: TimestampSchema.optional(),
}).partial();

/**
 * Schema for keyword research statistics
 */
export const keywordResearchStatsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  favoriteCount: z.number().int().nonnegative(),
});

// Exported types inferred from schemas
export type KeywordResearchBase = z.infer<typeof KeywordResearchBaseSchema>;
export type KeywordResearchItem = z.infer<typeof keywordResearchItemSchema>;
export type KeywordResearchListItem = z.infer<typeof keywordResearchListItemSchema>;
export type KeywordResearchFilter = z.infer<typeof keywordResearchFilterSchema>;
export type KeywordResearchStats = z.infer<typeof keywordResearchStatsSchema>;
export type CreateKeywordResearchInput = z.infer<typeof CreateKeywordResearchSchema>;
export type UpdateKeywordResearchInput = z.infer<typeof UpdateKeywordResearchSchema>;
export type UpdateClustersInput = z.infer<typeof UpdateClustersSchema>;
export type UpdateUserPersonaInput = z.infer<typeof UpdateUserPersonaSchema>;
export type UpdatePersonasInput = z.infer<typeof UpdatePersonasSchema>;
export type Cluster = z.infer<typeof ClusterSchema>;
export type Persona = z.infer<typeof PersonaSchema>; 