import {
  type CreateKeywordResearchInput,
  type KeywordResearchItem,
  type KeywordVolumeItem,
  type UpdateKeywordResearchInput,
  type UserPersona,
  type ClusterItem
} from './types'; // <-- CORRECT PATH: Import types from types.ts
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './db-config';

// --- NEW: Define the type for the summary list item ---
export type KeywordResearchSummaryItem = {
  id: string;
  query: string;
  totalVolume: number; // Calculated total search volume
  createdAt: Date; // Use Date object
  region: string | undefined;
  language: string | undefined;
};
// --- End NEW Type ---

// --- Helper to convert Timestamps (moved here for DB layer use) ---
/**
 * Converts Firestore Timestamps to Dates within a DB object.
 * Returns the object with Date types for createdAt/updatedAt.
 */
function convertDbTimestamps<
  T extends {
    id?: string;
    createdAt?: Timestamp | Date | string | number | unknown;
    updatedAt?: Timestamp | Date | string | number | unknown;
  } & Record<string, unknown>
>(
  data: T
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date } {
  const result = { ...data } as any;

  if (data.createdAt instanceof Timestamp) {
    result.createdAt = data.createdAt.toDate();
  } else if (data.createdAt && !(data.createdAt instanceof Date)) {
    try {
      result.createdAt = new Date(data.createdAt as any);
      if (isNaN(result.createdAt.getTime())) delete result.createdAt;
    } catch { delete result.createdAt; }
  } else if (!(data.createdAt instanceof Date)) {
     delete result.createdAt;
  }


  if (data.updatedAt instanceof Timestamp) {
    result.updatedAt = data.updatedAt.toDate();
  } else if (data.updatedAt && !(data.updatedAt instanceof Date)) {
     try {
      result.updatedAt = new Date(data.updatedAt as any);
      if (isNaN(result.updatedAt.getTime())) delete result.updatedAt;
    } catch { delete result.updatedAt; }
  } else if (!(data.updatedAt instanceof Date)) {
     delete result.updatedAt;
  }

  return result;
}

/**
 * 保存 Keyword Research 到 Firebase
 * Assumes userId is passed from the calling context (e.g., server action)
 */
export async function saveKeywordResearch(
  userId: string, // Added userId parameter
  query: string, // Renamed mainKeyword to query
  region: string | undefined, // Renamed from location, made optional
  language: string | undefined, // Made optional
  // suggestions: string[], // Suggestions might be part of keywords now or not saved directly
  keywords: KeywordVolumeItem[] = [], // Renamed searchResults to keywords, use Keyword type
  clusters?: Record<string, string[]> | null,
  searchEngine?: string, // Added missing schema fields
  device?: 'desktop' | 'mobile',
  isFavorite: boolean = false,
  tags?: string[]
): Promise<string | null> {
  if (!db) return null;

  try {
    const researchData = {
      query,
      userId,
      region: region || null,
      language: language || null,
      searchEngine: searchEngine || null,
      device: device || null,
      // suggestionCount: suggestions.length, // Remove if not in schema
      keywords: keywords || [],
      // resultsCount: keywords.length, // Use keywords.length if needed, or remove if not in schema
      clusters: clusters || null,
      // clustersCount: clusters ? Object.keys(clusters).length : 0, // Remove if not in schema
      isFavorite: isFavorite || false,
      tags: tags || [],
      createdAt: Timestamp.now(), // Use createdAt
      updatedAt: Timestamp.now() // Use updatedAt
    };

    // Use the correct collection
    const docRef = await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .add(researchData);
    console.log(`已保存 Keyword Research: ${docRef.id}`);

    return docRef.id;
  } catch (error) {
    console.error('保存 Keyword Research 失敗:', error);
    // Consider throwing a more specific error
    return null;
  }
}

/**
 * 獲取包含總搜尋量的 Keyword Research 摘要列表，按創建時間倒序排列
 * @param limit 最大返回數量
 * @param userId 可選的用戶 ID 過濾
 * @returns 返回包含 id, query, totalVolume, createdAt, region, language 的列表
 */
export async function getKeywordResearchSummaryList(
  limit: number = 50,
  userId?: string,
  language?: string,
  region?: string
): Promise<KeywordResearchSummaryItem[]> {
  if (!db) return [];

  console.log(
    `[DB] Fetching keyword research summary list (limit: ${limit}, userId: ${
      userId || 'N/A'
    }, lang: ${language || 'N/A'}, region: ${region || 'N/A'})`
  );

  try {
    let queryBuilder = db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .orderBy('createdAt', 'desc') // Order by creation date
      .limit(limit);

    // Optional: Filter by userId if provided
    if (userId) {
      queryBuilder = queryBuilder.where('userId', '==', userId);
    }

    // Optional: Filter by language if provided
    if (language) {
      queryBuilder = queryBuilder.where('language', '==', language);
    }

    // Optional: Filter by region if provided
    if (region) {
      queryBuilder = queryBuilder.where('region', '==', region);
    }

    // Fetch the full documents including the 'keywords' field
    const querySnapshot = await queryBuilder.get();

    if (querySnapshot.empty) {
      console.log(`[DB] No keyword research found matching criteria.`);
      return [];
    }

    // Map Firestore docs to KeywordResearchSummaryItem structure
    const summaryList: KeywordResearchSummaryItem[] = querySnapshot.docs.map(
      doc => {
        const data = doc.data();

        // Calculate totalVolume
        let totalVolume = 0;
        // Ensure keywords is an array before reducing
        if (data.keywords && Array.isArray(data.keywords)) {
          totalVolume = (data.keywords as KeywordVolumeItem[]).reduce(
            (sum: number, kw) => sum + (kw.searchVolume ?? 0), // Safely add volume
            0
          );
        }

        // Map fields
        return {
          id: doc.id,
          query: data.query || '',
          totalVolume: totalVolume,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(), // Convert Timestamp to Date
          region: data.region,
          language: data.language
        };
      }
    );

    console.log(
      `[DB] Successfully fetched ${summaryList.length} summary items.`
    );
    return summaryList;
  } catch (error) {
    console.error('[DB] Error fetching keyword research summary list:', error);
    throw error; // Re-throw the error for the caller to handle
  }
}

/**
 * 獲取特定 Keyword Research 詳情
 */
export async function getKeywordResearchDetail(
  researchId: string
): Promise<KeywordResearchItem | null> {
  if (!db) return null;

  try {
    const docSnap = await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .get();

    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的 Keyword Research: ${researchId}`);
      return null;
    }

    const data = docSnap.data();
    if (!data) return null;

    // Map Firestore doc to KeywordResearchItem structure
    const researchDetail: KeywordResearchItem = {
      id: researchId,
      query: data.query || '',
      createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
      keywords: data.keywords || [],
      clusters: data.clusters || null, // <-- Keep legacy field for now
      clustersWithVolume: data.clustersWithVolume || null, // <-- ADD THIS LINE
      personas: data.personas || null, 
      searchEngine: data.searchEngine,
      region: data.region,
      language: data.language,
      device: data.device,
      isFavorite: data.isFavorite || false,
      tags: data.tags || []
    };

    console.log(`Keyword Research 詳情 ${researchId} 載入完成 (Including clustersWithVolume)`); // Add log marker
    return researchDetail;
  } catch (error) {
    console.error(`獲取 Keyword Research 詳情失敗: ${researchId}`, error);
    throw error;
  }
}

/**
 * 刪除特定 Keyword Research 記錄
 */
export async function deleteKeywordResearch(
  researchId: string
): Promise<boolean> {
  if (!db) return false;

  try {
    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();
    console.log(`已刪除 Keyword Research: ${researchId}`);
    return true;
  } catch (error) {
    console.error('刪除 Keyword Research 失敗:', error);
    return false;
  }
}

/**
 * 更新特定 Keyword Research 的 clusters（原始 AI 輸出格式）
 * @param researchId
 * @param clusters 格式為 { [主題名稱]: 關鍵字列表 }
 * @returns 更新是否成功
 */
export async function updateKeywordResearchClusters(
  researchId: string,
  clusters: Record<string, string[]>
): Promise<boolean> {
  if (!db) return false;

  console.log(
    `[DB] Updating LEGACY clusters for research: ${researchId}`
  );
  try {
    const updateData = {
      clusters: clusters,
      updatedAt: Timestamp.now()
    };
    await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .update(updateData);
    console.log(`[DB] Updated LEGACY clusters for: ${researchId}`);
    return true;
  } catch (error) {
    console.error(`[DB] 更新 LEGACY Clusters 失敗 (${researchId}):`, error);
    throw error; // Re-throw error for the action to handle
  }
}

// --- NEW FUNCTION --- 
/**
 * Updates the clustersWithVolume field for a specific Keyword Research item.
 * @param researchId 
 * @param clustersWithVolume 
 * @returns boolean indicating success or failure.
 */
export async function updateKeywordResearchClustersWithVolume(
  researchId: string,
  clustersWithVolume: ClusterItem[] 
): Promise<boolean> {
  if (!db) return false;

  console.log(
    `[DB] Updating clustersWithVolume for research: ${researchId} using set/merge` 
  );
  try {
    const cleanedClustersWithVolume = clustersWithVolume.map(cluster => ({
        ...cluster,
        totalVolume: typeof cluster.totalVolume === 'number' ? cluster.totalVolume : 0,
        keywords: (Array.isArray(cluster.keywords) ? cluster.keywords : []).map((kw: KeywordVolumeItem) => ({ 
            text: kw.text || '', 
            searchVolume: kw.searchVolume ?? null,
            competition: kw.competition ?? null,
            competitionIndex: kw.competitionIndex ?? null,
            cpc: kw.cpc ?? null
        }))
    }));
    
    const updateData = {
      clustersWithVolume: cleanedClustersWithVolume, 
      updatedAt: Timestamp.now()
    };
    
    await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .set(updateData, { merge: true }); 
      
    console.log(`[DB] Updated clustersWithVolume for: ${researchId}`);
    return true;
  } catch (error) {
    console.error(`[DB] 更新 clustersWithVolume 失敗 (${researchId}):`, error);
    return false;
  }
}

/**
 * 更新特定 Keyword Research 的 keywords 列表（覆蓋）
 * @param researchId
 * @param keywords 完整的 KeywordVolumeItem 列表
 * @returns 更新是否成功
 */
export async function updateKeywordResearchResults(
  researchId: string,
  keywords: KeywordVolumeItem[]
): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!researchId) throw new Error('Research ID is required');

  try {
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    // Prepare keywords for Firestore (ensure no undefined values, etc.)
    // Although KeywordVolumeItem allows optional fields, Firestore might prefer null or absence
    const keywordsToSave = keywords.map(kw => ({
      text: kw.text,
      searchVolume: kw.searchVolume ?? null,
      competition: kw.competition ?? null,
      competitionIndex: kw.competitionIndex ?? null,
      cpc: kw.cpc ?? null
    }));

    await docRef.update({
      keywords: keywordsToSave,
      updatedAt: Timestamp.now()
    });

    console.log(
      'Keyword results updated successfully for researchId:',
      researchId
    );
    return true;
  } catch (error) {
    console.error('Error updating keyword results:', error);
    return false;
  }
}

/**
 * 更新現有 Keyword Research 的用戶畫像
 */
export async function updateKeywordResearchPersonas(
  researchId: string,
  personas: UserPersona[]
): Promise<boolean> {
  if (!db) {
    console.error('[DB] Database instance (db) is not initialized.');
    return false;
  }
  if (!researchId) {
    console.error('Error updating user personas: researchId is missing.');
    return false;
  }
  if (!personas || !Array.isArray(personas) || personas.length === 0) {
    console.error('Error updating user personas: personas data is invalid.');
    return false;
  }

  try {
    const researchRef = db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId);
    await researchRef.update({
      personas: personas,
      updatedAt: Timestamp.now()
    });
    console.log(
      `[DB] Updating personas for research item: ${researchId}`
    );
    return true;
  } catch (error) {
    console.error(
      `Error updating personas for research item ${researchId}:`,
      error
    );
    return false;
  }
}

// --- NEW: Create Keyword Research Entry ---
/**
 * Creates a new keyword research document in Firestore.
 * @param dataToSave The data object adhering to Firestore structure (uses Timestamps).
 * @returns The ID of the newly created document.
 * @throws Throws error if creation fails.
 */
export async function createKeywordResearchEntry(
  dataToSave: Omit<KeywordResearchItem, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  }
): Promise<string> {
  if (!db) throw new Error('Database not initialized');
  console.log('[DB] Creating new keyword research entry...');
  try {
    // Ensure all fields expected by Firestore are present, even if empty/default
    // The input `dataToSave` should now fully conform to KeywordResearchItem structure (minus id, with Timestamps)
    const fullDataToSave = {
        ...dataToSave,
        // Ensure potentially undefined array/object fields have defaults if needed by Firestore
        keywords: dataToSave.keywords || [],
        clusters: dataToSave.clusters || {},
        personas: dataToSave.personas || [],
        tags: dataToSave.tags || [],
    };
    const docRef = await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      // Firestore expects a plain object, ensure dataToSave matches
      .add(fullDataToSave); // Use the potentially defaulted object
    console.log(`[DB] Successfully created entry with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('[DB] Error creating keyword research entry:', error);
    throw new Error(`Failed to create keyword research entry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- NEW: Update Keyword Research Entry (General) ---
/**
 * Updates an existing keyword research document in Firestore.
 * @param researchId The ID of the document to update.
 * @param input The fields to update.
 * @returns True if update was successful.
 * @throws Throws error if update fails.
 */
export async function updateKeywordResearchEntry(
  researchId: string,
  input: UpdateKeywordResearchInput
): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!researchId) throw new Error('Research ID is required for update');

  console.log(`[DB] Updating keyword research entry: ${researchId}`);
  try {
    const dataToUpdate = { ...input, updatedAt: Timestamp.now() };
    await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .update(dataToUpdate);
    console.log(`[DB] Successfully updated entry: ${researchId}`);
    return true;
  } catch (error) {
    console.error(`[DB] Error updating keyword research entry ${researchId}:`, error);
     throw new Error(`Failed to update keyword research entry ${researchId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- NEW: Delete Keyword Research Entry ---
/**
 * Deletes a specific keyword research document from Firestore.
 * @param researchId The ID of the document to delete.
 * @returns True if deletion was successful.
 * @throws Throws error if deletion fails.
 */
export async function deleteKeywordResearchEntry(
  researchId: string
): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!researchId) throw new Error('Research ID is required for deletion');

  console.log(`[DB] Deleting keyword research entry: ${researchId}`);
  try {
    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();
    console.log(`[DB] Successfully deleted entry: ${researchId}`);
    return true;
  } catch (error) {
    console.error(`[DB] Error deleting keyword research entry ${researchId}:`, error);
    throw new Error(`Failed to delete keyword research entry ${researchId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- NEW: Find and Remove Duplicate Entries ---
/**
 * Finds and removes duplicate keyword research entries based on query, language, and region.
 * Keeps the newest entry for each unique combination.
 * @returns The number of entries removed.
 * @throws Throws error if the process fails.
 */
export async function findAndRemoveDuplicateEntries(): Promise<number> {
   if (!db) throw new Error('Database not initialized');
   console.log('[DB] Starting duplicate removal process...');

   let removedCount = 0;
   try {
     const snapshot = await db
       .collection(COLLECTIONS.KEYWORD_RESEARCH)
       .orderBy('createdAt', 'desc') // Get newest first
       .get();

     const seen = new Map<string, string>(); // Key: "query|lang|region", Value: docId
     let batch = db.batch();
     let batchSize = 0;
     const MAX_BATCH_SIZE = 400;

     console.log(`[DB] Found ${snapshot.size} total entries to check for duplicates.`);

     for (const doc of snapshot.docs) {
       const data = doc.data() as Partial<Pick<KeywordResearchItem, 'query' | 'language' | 'region'>>;
       const query = data.query || 'unknown_query';
       const language = data.language || 'unknown_language';
       const region = data.region || 'unknown_region';
       const key = `${query}|${language}|${region}`;

       if (seen.has(key)) {
         batch.delete(doc.ref);
         removedCount++;
         batchSize++;
       } else {
         seen.set(key, doc.id);
       }

       if (batchSize >= MAX_BATCH_SIZE) {
         console.log(`[DB] Committing batch of ${batchSize} deletions...`);
         await batch.commit();
         batch = db.batch();
         batchSize = 0;
       }
     }

     if (batchSize > 0) {
       console.log(`[DB] Committing final batch of ${batchSize} deletions...`);
       await batch.commit();
     }

     console.log(`[DB] Duplicate removal completed. Total removed: ${removedCount}`);
     return removedCount;

   } catch (error) {
     console.error('[DB] Error removing duplicate entries:', error);
     throw new Error(`Failed to remove duplicate entries: ${error instanceof Error ? error.message : String(error)}`);
   }
}
