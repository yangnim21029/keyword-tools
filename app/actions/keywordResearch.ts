'use server';

import {
    COLLECTIONS
} from '@/app/services/config'; // Import COLLECTIONS
import { db } from '@/app/services/firebase'; // Import db
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp and FieldValue
// Import Schemas from lib/schemas
import {
    CreateKeywordResearchSchema,
    UpdateClustersSchema,
    UpdateKeywordResearchSchema,
    UpdatePersonasSchema,
} from '@/lib/schemas'; // Assuming index exports these
// Import Types from app/types
import {
    type CreateKeywordResearchInput,
    type Keyword,
    type KeywordResearchItem,
    type KeywordResearchListItem,
    type UpdateClustersInput,
    type UpdateKeywordResearchInput,
    type UpdatePersonasInput
} from '@/app/types'; // Assuming index exports all needed types
import { revalidatePath, revalidateTag } from 'next/cache';
import { ZodIssue } from 'zod'; // Import ZodIssue

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

/**
 * Formats Zod errors into a readable string.
 */
function formatZodErrors(errors: ZodIssue[]): string {
  return errors.map((e: ZodIssue) => `${e.path.join('.')} - ${e.message}`).join('; ');
}

// --- Server Actions ---

// 获取 Keyword Research 列表 (返回 ListItem)
export async function fetchKeywordResearchList(limit: number = 50, forceRefresh: boolean = false): Promise<{ data: KeywordResearchListItem[]; sourceInfo: string; error?: string }> {
  const sourceInfo = '數據來源: Firebase Firestore';
  if (!db) return { data: [], sourceInfo, error: '數據庫未初始化' };

  try {
    if (forceRefresh) {
      revalidateTag(KEYWORD_RESEARCH_TAG);
      console.log(`[Server Action] Revalidated ${KEYWORD_RESEARCH_TAG} tag due to forceRefresh.`);
    }
    const snapshot = await db.collection(COLLECTIONS.KEYWORD_RESEARCH)
                             .orderBy('createdAt', 'desc')
                             .limit(limit)
                             .get();

    const researchList = snapshot.docs.map(doc => {
      const data = doc.data();
      // Manually construct the ListItem to ensure correct fields
      return convertTimestamps({
        id: doc.id,
        query: data.query,
        userId: data.userId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        location: data.location,
        language: data.language,
        searchEngine: data.searchEngine,
        device: data.device,
        isFavorite: data.isFavorite,
        tags: data.tags,
      }) as KeywordResearchListItem;
    });
    return { data: researchList, sourceInfo };
  } catch (error) {
    console.error('獲取 Keyword Research 列表失敗:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { data: [], sourceInfo, error: `獲取列表失敗: ${errorMessage}` };
  }
}

// 获取特定 Keyword Research 详情 (返回 Item)
export async function fetchKeywordResearchDetail(researchId: string): Promise<KeywordResearchItem | null> {
  if (!db) {
    console.error('數據庫未初始化');
    return null;
  }
  try {
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

// 删除特定 Keyword Research
export async function deleteKeywordResearch(researchId: string): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: '數據庫未初始化' };

  try {
    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();

    revalidateTag(KEYWORD_RESEARCH_TAG);
    console.log(`[Server Action] Revalidated ${KEYWORD_RESEARCH_TAG} tag after deleting ${researchId}.`);
    revalidatePath(TOOLS_PATH);
    console.log(`[Server Action] Revalidated path ${TOOLS_PATH} after deleting ${researchId}.`);
    return { success: true };
  } catch (error) {
    console.error(`刪除 Keyword Research 記錄 (${researchId}) 失敗:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `刪除記錄失敗: ${errorMessage}` };
  }
}

// 保存新的 Keyword Research 记录
export async function createKeywordResearch(
  input: CreateKeywordResearchInput
): Promise<{ researchItem: KeywordResearchItem | null; error?: string }> {
  if (!db) return { researchItem: null, error: '數據庫未初始化' };

  try {
    const validationResult = CreateKeywordResearchSchema.safeParse(input);
    if (!validationResult.success) {
      console.error('創建 Keyword Research 輸入驗證失敗:', validationResult.error.errors);
      const errorMessages = formatZodErrors(validationResult.error.errors); // Use helper
      return { researchItem: null, error: `輸入驗證失敗: ${errorMessages}` };
    }

    const validatedData = validationResult.data;
    const now = Timestamp.now();
    const dataToSave = {
      ...validatedData,
      createdAt: now,
      updatedAt: now,
      keywords: [],
      clusters: {},
      personas: {},
      userPersona: '',
      isFavorite: validatedData.isFavorite ?? false,
      tags: validatedData.tags ?? [],
    };

    const docRef = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).add(dataToSave);
    const newResearchId = docRef.id;

    revalidateTag(KEYWORD_RESEARCH_TAG);
    console.log(`[Server Action] Revalidated ${KEYWORD_RESEARCH_TAG} tag after creating entry ${newResearchId}.`);
    revalidatePath(TOOLS_PATH);
    console.log(`[Server Action] Revalidated path ${TOOLS_PATH} after creating ${newResearchId}.`);

    const savedResearchDetail = await fetchKeywordResearchDetail(newResearchId);
    if (!savedResearchDetail) {
      throw new Error('創建後無法立即獲取保存的研究詳情');
    }

    return { researchItem: savedResearchDetail };

  } catch (error) {
    console.error('創建 Keyword Research 失敗:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { researchItem: null, error: `創建失敗: ${errorMessage}` };
  }
}

// 通用更新 Keyword Research (Accepts partial data conforming to UpdateKeywordResearchInput)
export async function updateKeywordResearch(
  researchId: string,
  input: Partial<UpdateKeywordResearchInput> // Accept partial input for flexibility
): Promise<{ success: boolean; error?: string }> {
   if (!db) return { success: false, error: '數據庫未初始化' };

  try {
    // Validate only the provided fields against the update schema
    const validationResult = UpdateKeywordResearchSchema.partial().safeParse(input);
    if (!validationResult.success) {
      console.error('更新 Keyword Research 輸入驗證失敗:', validationResult.error.errors);
      const errorMessages = formatZodErrors(validationResult.error.errors); // Use helper
      return { success: false, error: `輸入驗證失敗: ${errorMessages}` };
    }
    
    const validatedData = validationResult.data;

    // Ensure updatedAt is always updated
    const dataToUpdate = {
      ...validatedData,
      updatedAt: Timestamp.now(),
    };

    // Prevent overwriting required fields if not included in partial update
    // Firestore `update` only modifies specified fields, so this is generally safe.

    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

    revalidateTag(KEYWORD_RESEARCH_TAG);
    revalidatePath(`${TOOLS_PATH}/${researchId}`); 
    revalidatePath(TOOLS_PATH);
    console.log(`[Server Action] Revalidated paths/tags after updating ${researchId}.`);
    return { success: true };

  } catch (error) {
    console.error(`更新 Keyword Research (${researchId}) 失敗:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `更新失敗: ${errorMessage}` };
  }
}

// 更新 Keyword Research - Keywords
export async function updateKeywordResearchKeywords(
    researchId: string,
    keywords: Keyword[]
): Promise<{ success: boolean; error?: string }> {
    // Directly call updateKeywordResearch with the partial data
    return updateKeywordResearch(researchId, { keywords });
}

// 更新 Keyword Research - Clusters
export async function updateKeywordResearchClusters(
    researchId: string,
    input: UpdateClustersInput
): Promise<{ success: boolean; error?: string }> {
   // Validate the specific input first (optional, as general update validates)
    const validationResult = UpdateClustersSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessages = formatZodErrors(validationResult.error.errors); // Use helper
      return { success: false, error: `聚類輸入驗證失敗: ${errorMessages}` };
    }
    // Call general update function
    return updateKeywordResearch(researchId, { clusters: validationResult.data.clusters });
}

// 更新 Keyword Research - Personas
export async function updateKeywordResearchPersonas(
    researchId: string,
    input: UpdatePersonasInput
): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: "數據庫未初始化" };
    // Validate the specific input first (optional)
    const validationResult = UpdatePersonasSchema.safeParse(input);
    if (!validationResult.success) {
      const errorMessages = formatZodErrors(validationResult.error.errors);
      return { success: false, error: `畫像輸入驗證失敗: ${errorMessages}` };
    }
    // Directly update the specific field
    try {
      const dataToUpdate = {
        personas: validationResult.data.personas,
        updatedAt: Timestamp.now(),
      };
      await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);

      revalidateTag(KEYWORD_RESEARCH_TAG);
      revalidatePath(`${TOOLS_PATH}/${researchId}`);
      revalidatePath(TOOLS_PATH);
      console.log(`[Server Action] Revalidated paths/tags after updating personas for ${researchId}.`);
      return { success: true };

    } catch (error) {
      console.error(`更新 Keyword Research Personas (${researchId}) 失敗:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: `更新畫像失敗: ${errorMessage}` };
    }
}