import {
    Keyword,
    KeywordResearchItem,
    KeywordResearchListItem
} from '@/app/types/keyword-research.types'; // Use correct types
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './config';

/**
 * 保存 Keyword Research 到 Firebase
 * Assumes userId is passed from the calling context (e.g., server action)
 */
export async function saveKeywordResearch(
    userId: string, // Added userId parameter
    query: string, // Renamed mainKeyword to query
    location: string | undefined, // Renamed region to location, made optional
    language: string | undefined, // Made optional
    // suggestions: string[], // Suggestions might be part of keywords now or not saved directly
    keywords: Keyword[] = [], // Renamed searchResults to keywords, use Keyword type
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
            location: location || null,
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
            updatedAt: Timestamp.now()  // Use updatedAt
        };

        // Use the correct collection
        const docRef = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).add(researchData);
        console.log(`已保存 Keyword Research: ${docRef.id}`);

        return docRef.id;
    } catch (error) {
        console.error('保存 Keyword Research 失敗:', error);
        // Consider throwing a more specific error
        return null;
    }
}

/**
 * 獲取 Keyword Research 列表，按更新時間倒序排列
 * Returns simplified list items (KeywordResearchListItem)
 */
export async function getKeywordResearchList(limit: number = 50, userId?: string): Promise<KeywordResearchListItem[]> {
    if (!db) return [];

    try {
        let queryBuilder = db.collection(COLLECTIONS.KEYWORD_RESEARCH)
                             .orderBy('updatedAt', 'desc') // Order by updatedAt
                             .limit(limit);

        // Optional: Filter by userId if provided
        if (userId) {
             queryBuilder = queryBuilder.where('userId', '==', userId);
        }

        const querySnapshot = await queryBuilder.get();

        if (querySnapshot.empty) {
            return [];
        }

        // Map Firestore docs to KeywordResearchListItem structure
        const researchList: KeywordResearchListItem[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Map Firestore fields to KeywordResearchListItem fields
            return {
                id: doc.id,
                query: data.query || '',
                userId: data.userId || '', // Assuming userId is stored
                createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
                location: data.location,
                language: data.language,
                device: data.device,
                isFavorite: data.isFavorite || false,
                tags: data.tags,
                // Omit large fields like keywords, clusters, userPersona for list view
            };
        });

        return researchList;
    } catch (error) {
        console.error('獲取 Keyword Research 列表失敗:', error);
        throw error;
    }
}

/**
 * 獲取特定 Keyword Research 詳情
 */
export async function getKeywordResearchDetail(researchId: string): Promise<KeywordResearchItem | null> {
    if (!db) return null;

    try {
        const docSnap = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).get();

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
            userId: data.userId || '',
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
            keywords: data.keywords || [],
            clusters: data.clusters || null,
            personas: data.personas || null,
            searchEngine: data.searchEngine,
            location: data.location,
            language: data.language,
            device: data.device,
            isFavorite: data.isFavorite || false,
            tags: data.tags || [],
        };

        console.log(`Keyword Research 詳情 ${researchId} 載入完成`);
        return researchDetail;

    } catch (error) {
        console.error(`獲取 Keyword Research 詳情失敗: ${researchId}`, error);
        throw error;
    }
}

/**
 * 刪除特定 Keyword Research 記錄
 */
export async function deleteKeywordResearch(researchId: string): Promise<boolean> {
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
 * 更新現有 Keyword Research 的分群結果
 */
export async function updateKeywordResearchClusters(
    researchId: string,
    clusters: Record<string, string[]>
): Promise<boolean> {
    if (!db) {
        console.error("Database instance (db) is not initialized.");
        return false; 
    }
    if (!researchId) {
        console.error('Error updating clusters: researchId is missing.');
        return false;
    }
    if (!clusters || typeof clusters !== 'object') {
        console.error('Error updating clusters: clusters data is invalid.');
        return false;
    }

    try {
        const researchRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
        await researchRef.update({
            clusters: clusters,
            updatedAt: Timestamp.now(),
        });
        console.log(`Successfully updated clusters for research item: ${researchId}`);
        return true;
    } catch (error) {
        console.error(`Error updating clusters for research item ${researchId}:`, error);
        return false;
    }
}

/**
 * 更新現有 Keyword Research 的關鍵詞結果
 */
export async function updateKeywordResearchResults(
    researchId: string,
    keywords: Keyword[] // Use Keyword[] type
): Promise<boolean> {
    if (!db) return false;

    try {
        const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
        // Optionally check existence

        await docRef.update({
            keywords: keywords, // Update the keywords field
            // resultsCount: keywords.length, // Remove if resultsCount is not in schema
            updatedAt: Timestamp.now() // Update timestamp
        });

        console.log(`已更新 Keyword Research 的關鍵詞結果: ${researchId}, 共 ${keywords.length} 條`);
        return true;
    } catch (error) {
        console.error('更新 Keyword Research 關鍵詞結果失敗:', error);
        return false;
    }
}

/**
 * 更新現有 Keyword Research 的用戶畫像
 */
export async function updateKeywordResearchPersonas(
    researchId: string,
    personas: Record<string, string> // Parameter accepts the map
): Promise<boolean> {
    if (!db) { 
        console.error("Database instance (db) is not initialized.");
        return false; 
    }
    if (!researchId) {
        console.error('Error updating user personas: researchId is missing.'); // Log msg updated
        return false;
    }
    if (typeof personas !== 'object' || personas === null) { // Check if personas is an object
        console.error('Error updating user personas: personas data is invalid.'); // Log msg updated
        return false;
    }

    try {
        const researchRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
        await researchRef.update({
            personas: personas, // Save the entire map to a field named 'personas'
            updatedAt: Timestamp.now(),
        });
        console.log(`Successfully updated personas for research item: ${researchId}`); // Log msg updated
        return true;
    } catch (error) {
        console.error(`Error updating personas for research item ${researchId}:`, error); // Log msg updated
        return false;
    }
}