'use server';

// import { COLLECTIONS } from '@/app/services/config'; // REMOVE - Incorrect path
import { db, COLLECTIONS } from '@/app/services/firebase/config'; // CORRECT - Keep this one, remove alias
import { Timestamp } from 'firebase-admin/firestore';
// Import Zod Schemas (Keep if used for validation, even if commented out)
import {
    CreateKeywordResearchSchema,
    UpdateClustersSchema,
    UpdateKeywordResearchSchema,
    UpdatePersonasSchema,
} from '@/lib/schemas';
// Import Types
import {
    type CreateKeywordResearchInput,
    type Keyword, // Keep this one
    type KeywordResearchItem,
    type KeywordResearchListItem,
    type UpdateClustersInput,
    type UpdateKeywordResearchInput,
    type UpdatePersonasInput,
    type KeywordResearchFilter, // Ensure this is exported from @/app/types
} from '@/app/types';
import { revalidatePath, revalidateTag } from 'next/cache';
// import { KeywordResearchItemSchema, KeywordResearchListItemSchema } from '@/app/types/keyword-research.types'; // REMOVE - Incorrect import
// import { Keyword } from '@/lib/schemas'; // REMOVE - Duplicate import

const KEYWORD_RESEARCH_TAG = 'KeywordResearch';
const TOOLS_PATH = '/tools';

// --- Firestore Helper Functions (Internal) ---

/**
 * Converts Firestore Timestamps to Dates.
 * Adjusted generic constraint to allow other properties like id.
 */
function convertTimestamps<T extends { id?: string; createdAt?: Timestamp | unknown; updatedAt?: Timestamp | unknown } & Record<string, unknown>>(
  data: T
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date } {
  const result = { ...data };
  if (data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt && typeof data.createdAt.toDate === 'function') {
    result.createdAt = data.createdAt.toDate();
  }
  if (data.updatedAt && typeof data.updatedAt === 'object' && 'toDate' in data.updatedAt && typeof data.updatedAt.toDate === 'function') {
    result.updatedAt = data.updatedAt.toDate();
  }
  return result as Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date };
}

// --- Server Actions ---

// 获取 Keyword Research 列表 (返回 ListItem)
export async function fetchKeywordResearchList(
    userId?: string, // Optional: filter by user ID if needed
    filters?: KeywordResearchFilter, // Optional: add filters
    limit = 50, // Default limit
    forceRefresh = false // Option to bypass cache
): Promise<{ data: KeywordResearchListItem[]; error: string | null }> {
  if (!db) {
    console.error('數據庫未初始化');
    return { data: [], error: 'Database not initialized' };
  }
  try {
      if (forceRefresh) {
        revalidateTag(KEYWORD_RESEARCH_TAG);
        console.log(`[Server Action] Revalidated ${KEYWORD_RESEARCH_TAG} tag due to forceRefresh.`);
      }
      // Use COLLECTIONS directly
      const snapshot = await db.collection(COLLECTIONS.KEYWORD_RESEARCH)
                               .orderBy('createdAt', 'desc')
                               .limit(limit)
                               // Add .where clauses here based on userId and filters if provided
                               .get();

      const researches = snapshot.docs.map(doc => convertTimestamps({ ...doc.data(), id: doc.id })) as KeywordResearchListItem[];
      console.log(`[Server Action] Fetched ${researches.length} keyword research items.`);
      return { data: researches, error: null };

  } catch (error) {
      console.error('獲取 Keyword Research 列表失敗:', error);
      return { data: [], error: error instanceof Error ? error.message : 'Failed to fetch keyword research list' };
  }
}

// 获取特定 Keyword Research 详情 (返回 Item)
export async function fetchKeywordResearchDetail(researchId: string): Promise<KeywordResearchItem | null> {
  if (!db) {
    console.error('數據庫未初始化');
    return null;
  }
  try {
    // Use COLLECTIONS directly
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`找不到指定的 Keyword Research 記錄: ${researchId}`);
      return null;
    }
    const data = docSnap.data();
    if (!data) return null;

    return convertTimestamps({ ...data, id: docSnap.id }) as KeywordResearchItem;
  } catch (error) {
    console.error(`獲取 Keyword Research 詳情 (${researchId}) 失敗:`, error);
    return null;
  }
}

// 删除 Keyword Research
export async function deleteKeywordResearch(researchId: string): Promise<{ success: boolean; error?: string }> {
    if (!db) {
      console.error('數據庫未初始化');
      return { success: false, error: 'Database not initialized' };
    }
    if (!researchId) {
      return { success: false, error: 'Research ID is required' };
    }

    try {
      // Use COLLECTIONS directly
      await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();

      revalidateTag(KEYWORD_RESEARCH_TAG);
      console.log(`[Server Action] Deleted keyword research ${researchId} and revalidated tag.`);
      return { success: true };
    } catch (error) {
      console.error(`刪除 Keyword Research (${researchId}) 失敗:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete research' };
    }
}

// 创建 Keyword Research
export async function createKeywordResearch(input: CreateKeywordResearchInput): Promise<{ data: KeywordResearchItem | null; error: string | null }> {
    if (!db) {
        return { data: null, error: 'Database not initialized' };
    }

    // TODO: Add validation using Zod schema if needed
    // const validation = CreateKeywordResearchSchema.safeParse(input);
    // if (!validation.success) {
    //   return { data: null, error: formatZodError(validation.error) };
    // }

    try {
      const now = Timestamp.now();
      const dataToSave = {
        ...input,
        createdAt: now,
        updatedAt: now,
      };

      // Use COLLECTIONS directly
      const docRef = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).add(dataToSave);
      const newResearchId = docRef.id;

      const newResearchData = { ...dataToSave, id: newResearchId };
      revalidateTag(KEYWORD_RESEARCH_TAG);
      console.log(`[Server Action] Created keyword research ${newResearchId} and revalidated tag.`);
      return { data: convertTimestamps(newResearchData) as KeywordResearchItem, error: null };

    } catch (error) {
        console.error('創建 Keyword Research 失敗:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Failed to create research' };
    }
}

// 更新 Keyword Research (通用)
export async function updateKeywordResearch(researchId: string, input: UpdateKeywordResearchInput): Promise<{ success: boolean; error?: string }> {
    if (!db) {
      return { success: false, error: 'Database not initialized' };
    }
    if (!researchId) {
      return { success: false, error: 'Research ID is required' };
    }
    if (Object.keys(input).length === 0) {
       return { success: false, error: 'No update data provided' };
    }

    // TODO: Add validation if needed

    try {
        const dataToUpdate = {
            ...input,
            updatedAt: Timestamp.now(),
        };
        // Firestore `update` only modifies specified fields, so this is generally safe.

        // Use COLLECTIONS directly
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

        revalidateTag(KEYWORD_RESEARCH_TAG);
        console.log(`[Server Action] Updated keyword research ${researchId} and revalidated tag.`);
        return { success: true };

    } catch (error) {
        console.error(`更新 Keyword Research (${researchId}) 失敗:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update research' };
    }
}

// --- Specific Update Actions (Clusters, Personas, Keywords) ---

// 更新 Clusters
export async function updateKeywordResearchClusters(
    researchId: string,
    input: UpdateClustersInput
): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: 'Database not initialized' };
    if (!researchId) return { success: false, error: 'Research ID is required' };

    // TODO: Add validation for input.clusters structure if necessary

    try {
        const dataToUpdate = {
            clusters: input.clusters,
            updatedAt: Timestamp.now(),
        };
        // Use COLLECTIONS directly
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

        revalidateTag(KEYWORD_RESEARCH_TAG);
        console.log(`[Server Action] Updated clusters for research ${researchId} and revalidated tag.`);
        return { success: true };
    } catch (error) {
        console.error(`更新 Clusters (${researchId}) 失敗:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update clusters' };
    }
}

// 更新 Personas
export async function updateKeywordResearchPersonas(
    researchId: string,
    input: UpdatePersonasInput
): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: 'Database not initialized' };
    if (!researchId) return { success: false, error: 'Research ID is required' };

    // TODO: Add validation for input.personas structure if necessary

    try {
        const dataToUpdate = {
            personas: input.personas,
            updatedAt: Timestamp.now(),
        };
        // Use COLLECTIONS directly
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

        revalidateTag(KEYWORD_RESEARCH_TAG);
        console.log(`[Server Action] Updated personas for research ${researchId} and revalidated tag.`);
        return { success: true };
    } catch (error) {
        console.error(`更新 Personas (${researchId}) 失敗:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update personas' };
    }
}

// 更新 Keywords (Overwrites existing keywords)
export async function updateKeywordResearchKeywords(
    researchId: string,
    keywords: Keyword[] // Expects the full Keyword array from @/app/types
): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: 'Database not initialized' };
    if (!researchId) return { success: false, error: 'Research ID is required' };

    // TODO: Validate the structure of each Keyword in the array using a Zod schema if needed

    try {
        const dataToUpdate = {
            keywords: keywords, // Overwrite the entire keywords array
            updatedAt: Timestamp.now(),
        };
        // Use COLLECTIONS directly
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

        revalidateTag(KEYWORD_RESEARCH_TAG);
        console.log(`[Server Action] Updated keywords for research ${researchId} and revalidated tag.`);
        return { success: true };
    } catch (error) {
        console.error(`更新 Keywords (${researchId}) 失敗:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update keywords' };
    }
}