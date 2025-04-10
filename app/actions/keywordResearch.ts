'use server';

import { db, COLLECTIONS } from '@/app/services/firebase/config'; 
import { Timestamp } from 'firebase-admin/firestore';
import {
    type CreateKeywordResearchInput,
    type Keyword,
    type KeywordResearchItem,
    type KeywordResearchListItem,
    type UpdateClustersInput,
    type UpdateKeywordResearchInput,
    type UpdatePersonasInput,
    type KeywordResearchFilter, // Ensure this is exported from @/app/types
    type KeywordVolumeItem // <--- Add KeywordVolumeItem import
} from '@/app/types';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { getKeywordSuggestions, getUrlSuggestions } from '@/app/actions'; // Adjust import path for suggestion actions
import { getSearchVolume } from '@/app/services/KeywordDataService'; // Import the service function
// Import the specific update function from the service file
import { updateKeywordResearchResults } from '@/app/services/firebase/keyword_research'; 
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
// Import the actual semantic clustering function
import { performSemanticClustering as performSemanticClusteringService } from './SemanticClustering';

const KEYWORD_RESEARCH_TAG = 'KeywordResearch';
const TOOLS_PATH = '/tools';

// --- Firestore Helper Functions (Internal) ---

/**
 * Converts Firestore Timestamps to Dates.
 * Adjusted generic constraint to allow other properties like id.
 * Added explicit handling for cases where createdAt/updatedAt might not be Timestamps.
 */
function convertTimestamps<T extends { id?: string; createdAt?: Timestamp | unknown; updatedAt?: Timestamp | unknown } & Record<string, unknown>>(
  data: T
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date } {
  const result = { ...data };

  // Check if createdAt is a Firestore Timestamp before converting
  if (data.createdAt instanceof Timestamp) {
    result.createdAt = data.createdAt.toDate();
  } else if (data.createdAt) {
    // Handle cases where it might already be a Date or needs different conversion
    console.warn('createdAt field was not a Firestore Timestamp:', data.createdAt);
    // Optionally attempt conversion if it looks like a date string or number, or keep as is
     result.createdAt = new Date(data.createdAt as any); // Be cautious with 'as any'
  }

  // Check if updatedAt is a Firestore Timestamp before converting
  if (data.updatedAt instanceof Timestamp) {
    result.updatedAt = data.updatedAt.toDate();
  } else if (data.updatedAt) {
    console.warn('updatedAt field was not a Firestore Timestamp:', data.updatedAt);
     result.updatedAt = new Date(data.updatedAt as any); // Be cautious with 'as any'
  }

  // Ensure the return type matches the expected output after conversion
  return result as Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date };
}

// --- Server Actions ---

// Cached function to fetch the list
const getCachedKeywordResearchList = unstable_cache(
  async (userId?: string, filters?: KeywordResearchFilter, limit = 50) => {
    console.log(`[Cache Miss] Fetching keyword research list: userId=${userId}, limit=${limit}, filters=${JSON.stringify(filters)}`);
    if (!db) throw new Error('Database not initialized');

    const query = db.collection(COLLECTIONS.KEYWORD_RESEARCH)
                  .orderBy('createdAt', 'desc')
                  .limit(limit);

    // TODO: Apply userId and filters to the query
    // if (userId) { query = query.where('userId', '==', userId); }
    // Apply other filters...

    const snapshot = await query.get();
    return snapshot.docs.map(doc =>
        convertTimestamps({ ...doc.data(), id: doc.id }) as KeywordResearchListItem
    );
  },
  // Base key parts. Arguments (userId, filters, limit) differentiate cache entries.
  ['keywordResearchList'],
  { tags: [KEYWORD_RESEARCH_TAG] }
);

// 获取 Keyword Research 列表 (使用 cached function)
export async function fetchKeywordResearchList(
    userId?: string,
    filters?: KeywordResearchFilter,
    limit = 50
): Promise<{ data: KeywordResearchListItem[]; error: string | null }> {
  try {
      const researches = await getCachedKeywordResearchList(userId, filters, limit);
      console.log(`[Server Action] Fetched ${researches.length} items (potentially cached).`);
      return { data: researches, error: null };
  } catch (error) {
      console.error('獲取 Keyword Research 列表失敗:', error);
      return { data: [], error: error instanceof Error ? error.message : 'Failed to fetch list' };
  }
}

// Cached function to fetch details
const getCachedKeywordResearchDetail = unstable_cache(
  async (researchId: string) => {
    console.log(`[Cache Miss] Fetching detail for researchId: ${researchId}`);
    if (!db) throw new Error('Database not initialized');
    if (!researchId) return null; // Or throw error

    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`找不到記錄: ${researchId}`);
      return null;
    }
    const data = docSnap.data();
    if (!data) return null;

    return convertTimestamps({ ...data, id: docSnap.id }) as KeywordResearchItem;
  },
  // Base key part. researchId differentiates cache entries.
  ['keywordResearchDetail'],
   // Static options object. Only include the base tag.
   // Specific invalidation will be handled by revalidateTag(`${KEYWORD_RESEARCH_TAG}_${researchId}`)
  { tags: [KEYWORD_RESEARCH_TAG] }
);

// 获取特定 Keyword Research 详情 (使用 cached function)
export async function fetchKeywordResearchDetail(researchId: string): Promise<KeywordResearchItem | null> {
  try {
    const detail = await getCachedKeywordResearchDetail(researchId);
    return detail;
  } catch (error) {
    console.error(`獲取詳情 (${researchId}) 失敗:`, error);
    return null;
  }
}

async function revalidateResearch(researchId?: string) {
    // Always revalidate the list tag and history page path
    revalidateTag(KEYWORD_RESEARCH_TAG);
    revalidatePath('/history'); 
    console.log(`[Server Action] Revalidated tag: ${KEYWORD_RESEARCH_TAG} and path: /history.`);

    // Only revalidate the specific item tag AND path if an ID is provided (update/delete)
    if (researchId) {
        const itemPath = `/tools/keyword/${researchId}`; 
        revalidateTag(`${KEYWORD_RESEARCH_TAG}_${researchId}`);
        revalidatePath(itemPath); // Add path revalidation for the specific item
        console.log(`[Server Action] Also revalidated specific tag: ${KEYWORD_RESEARCH_TAG}_${researchId} and path: ${itemPath}.`);
    } 
}

// 删除 Keyword Research
export async function deleteKeywordResearch(researchId: string): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: 'Database not initialized' };
    if (!researchId) return { success: false, error: 'Research ID is required' };

    try {
      await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();
      await revalidateResearch(researchId); // Use helper
      return { success: true };
    } catch (error) {
      console.error(`刪除 (${researchId}) 失敗:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete' };
    }
}

// 创建 Keyword Research
export async function createKeywordResearch(input: CreateKeywordResearchInput): Promise<{ data: KeywordResearchItem | null; error: string | null }> {
    if (!db) return { data: null, error: 'Database not initialized' };

    // TODO: Add Zod validation here if desired
    // Note: input type only guarantees fields like query, location?, language?, etc.
    // We need to provide defaults for other KeywordResearchItem fields.

    try {
      const now = Timestamp.now();
      // Construct the data to save explicitly.
      // Pull available fields from input, provide defaults for the rest.
      const dataToSave = {
        query: input.query, // Mandatory from CreateKeywordResearchInput
        location: input.location ?? '', // Optional from input
        language: input.language ?? '', // Optional from input
        searchEngine: input.searchEngine ?? 'google', // Optional from input
        device: input.device ?? 'desktop', // Optional from input
        isFavorite: input.isFavorite ?? false, // Optional from input
        tags: input.tags ?? [], // Optional from input
        // --- Fields NOT in CreateKeywordResearchInput, provide defaults ---
        name: 'Untitled Research', // Default name
        description: '', // Default description
        keywords: [], // Default empty array
        clusters: {}, // Default empty object
        personas: {}, // Default empty object
        // ---------------------------------------------------------------
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).add(dataToSave);
      const newResearchId = docRef.id;
      // Add the generated id to the object before converting timestamps
      const newResearchData = { ...dataToSave, id: newResearchId };

      await revalidateResearch(); // Revalidate list only

      // Cast to KeywordResearchItem (should be compatible now after schema change)
      return { data: convertTimestamps(newResearchData) as KeywordResearchItem, error: null };

    } catch (error) {
        console.error('創建 Keyword Research 失敗:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Failed to create' };
    }
}

// 更新 Keyword Research (通用)
export async function updateKeywordResearch(researchId: string, input: UpdateKeywordResearchInput): Promise<{ success: boolean; error?: string }> {
    if (!db) return { success: false, error: 'Database not initialized' };
    if (!researchId) return { success: false, error: 'Research ID is required' };
    if (Object.keys(input).length === 0) return { success: false, error: 'No update data' };

    try {
        const dataToUpdate = { ...input, updatedAt: Timestamp.now() };
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update(dataToUpdate);
        await revalidateResearch(researchId); // Use helper
        return { success: true };
    } catch (error) {
        console.error(`更新 (${researchId}) 失敗:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update' };
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
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update({ clusters: input.clusters, updatedAt: Timestamp.now() });
        await revalidateResearch(researchId); // Use helper
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
        await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).update({ personas: input.personas, updatedAt: Timestamp.now() });
        await revalidateResearch(researchId); // Use helper
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
    // Remove direct db access check if db is handled within the service function
    // if (!db) return { success: false, error: 'Database not initialized' }; 
    if (!researchId) return { success: false, error: 'Research ID is required' };

    // TODO: Add validation for the structure of each Keyword in the array using a Zod schema if needed

    try {
        // Call the service function to handle the update
        const success = await updateKeywordResearchResults(researchId, keywords);

        if (success) {
             await revalidateResearch(researchId); // Revalidate cache after successful update
             return { success: true };
        } else {
            // The service function should log the specific error
            return { success: false, error: 'Failed to update keywords via service function' };
        }
    } catch (error) {
        // Catch errors from the service function call itself
        console.error(`更新 Keywords (${researchId}) 失敗 via service:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update keywords' };
    }
}

// --- Placeholder Clustering Service ---
// Replace this with your actual clustering implementation
async function performClustering(keywords: Keyword[]): Promise<Record<string, string[]>> {
  console.log(`[Clustering Service] Preparing ${keywords.length} keywords for semantic clustering...`);
  if (!keywords || keywords.length === 0) {
    console.warn('[Clustering Service] No keywords provided.');
    return {};
  }

  // Extract just the text from the Keyword objects
  const keywordTexts = keywords.map(kw => kw.text).filter(text => !!text); // Ensure no null/empty strings

  if (keywordTexts.length < 5) { // Match the validation in performSemanticClusteringService
      console.warn(`[Clustering Service] Not enough keywords (${keywordTexts.length}) for semantic clustering. Minimum is 5.`);
      return {};
  }

  try {
    // Call the actual semantic clustering server action
    // Note: We don't specify the model, letting it use the default ('gpt-4o-mini')
    const clusteringResult = await performSemanticClusteringService({ keywords: keywordTexts });

    // The service already validates the schema and returns the clusters object
    console.log(`[Clustering Service] Semantic clustering complete. Found ${Object.keys(clusteringResult.clusters).length} clusters.`);
    return clusteringResult.clusters; // Return the clusters part of the result

  } catch (error) {
    console.error('[Clustering Service] Error calling performSemanticClusteringService:', error);
    // Decide how to handle the error - return empty or re-throw?
    // Returning empty allows the process to continue without clusters.
    return {};
  }
}

// --- Server Action to Trigger and Save Clustering ---
export async function triggerKeywordClustering(researchId: string): Promise<{ success: boolean; error?: string }> {
    if (!researchId) return { success: false, error: 'Research ID is required' };

    try {
        console.log(`[Server Action] Triggering clustering for researchId: ${researchId}`);
        // 1. Fetch the research item to get keywords
        const researchDetail = await fetchKeywordResearchDetail(researchId); // Uses cache
        if (!researchDetail || !researchDetail.keywords || researchDetail.keywords.length === 0) {
            console.warn(`[Server Action] No keywords found for ${researchId} to cluster.`);
            return { success: true }; // Nothing to cluster
        }

        // --- Deduplication Logic ---
        const normalizedKeywordMap = new Map<string, Keyword>();
        researchDetail.keywords.forEach(keyword => {
            if (!keyword.text) return; // Skip if text is missing

            const normalizedText = keyword.text.toLowerCase().replace(/\s+/g, '');
            const existingKeyword = normalizedKeywordMap.get(normalizedText);

            // If no keyword with this normalized text exists OR the current keyword has higher volume, add/replace it
            if (!existingKeyword || (keyword.searchVolume ?? 0) > (existingKeyword.searchVolume ?? 0)) {
                normalizedKeywordMap.set(normalizedText, keyword);
            }
        });

        const deduplicatedKeywords = Array.from(normalizedKeywordMap.values());
        console.log(`[Server Action] Deduplicated keywords for ${researchId}: ${researchDetail.keywords.length} -> ${deduplicatedKeywords.length}`);
        // --- End Deduplication ---

        // 2. Perform clustering (Uses deduplicated keywords)
        if (deduplicatedKeywords.length < 5) { // Also check here before calling clustering
            console.warn(`[Server Action] Not enough unique keywords (${deduplicatedKeywords.length}) after deduplication for ${researchId}. Minimum is 5. Skipping clustering.`);
            return { success: true }; // Not an error, just nothing to cluster
        }
        const clusters = await performClustering(deduplicatedKeywords);

        // 3. Save the clusters
        if (Object.keys(clusters).length > 0) {
            console.log(`[Server Action] Saving ${Object.keys(clusters).length} clusters for ${researchId}`);
            // Use the existing action to update clusters and handle revalidation
            // Fix: Add updatedAt to satisfy the type checker, even if overridden internally.
            const updateResult = await updateKeywordResearchClusters(researchId, { clusters, updatedAt: new Date() });
            if (!updateResult.success) {
                throw new Error(updateResult.error || 'Failed to save clusters via updateKeywordResearchClusters');
            }
            console.log(`[Server Action] Clusters saved successfully for ${researchId}`);
        } else {
             console.log(`[Server Action] No clusters generated for ${researchId}. Not updating.`);
        }

        return { success: true };

    } catch (error) {
        console.error(`[Server Action] Clustering failed for ${researchId}:`, error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred during clustering';
        return { success: false, error: message };
    }
}

// --- New Server Action for Processing Full Query ---

interface ProcessQueryInput {
    query: string;
    region: string;
    language: string;
    useAlphabet: boolean;
    useSymbols: boolean;
    // userId?: string; // Keep consistent with createKeywordResearch
}

interface ProcessQueryResult {
    success: boolean;
    researchId: string | null;
    // Remove suggestions/volumeData as they are intermediate steps now
    // suggestions?: string[];
    // volumeData?: KeywordVolumeItem[];
    error?: string | null;
}

export async function processAndSaveKeywordQuery(
    input: ProcessQueryInput
): Promise<ProcessQueryResult> {
    const { query, region, language, useAlphabet, useSymbols } = input;
    let suggestionsList: string[] = [];
    let volumeList: KeywordVolumeItem[] = [];
    let savedResearchId: string | null = null;
    const isUrl = query.startsWith('http');
    const currentInputType = isUrl ? 'url' : 'keyword';

    try {
        // 1. Fetch Suggestions
        console.log(`[Server Action] Fetching suggestions for: ${query}`);
        let suggestionsResult;
        if (currentInputType === 'keyword') {
            suggestionsResult = await getKeywordSuggestions(query, region, language, useAlphabet, useSymbols);
        } else {
            suggestionsResult = await getUrlSuggestions({ url: query, region, language });
        }

        if (suggestionsResult.error || !suggestionsResult.suggestions || suggestionsResult.suggestions.length === 0) {
            const errorMsg = suggestionsResult.error || (currentInputType === 'keyword' ? '未找到關鍵詞建議' : '無法從 URL 獲取建議');
             console.warn(`[Server Action] Suggestion Warning: ${errorMsg}`);
             suggestionsList = []; // Ensure list is empty for subsequent steps
        } else {
            suggestionsList = suggestionsResult.suggestions;
            console.log(`[Server Action] Got ${suggestionsList.length} suggestions.`);
        }

        // 2. Fetch Volume Data (if suggestions exist)
        const suggestionsToProcess = suggestionsList.slice(0, 200); // Limit volume processing
        if (suggestionsToProcess.length > 0) {
            console.log(`[Server Action] Fetching volume for ${suggestionsToProcess.length} keywords.`);
            const volumeResult = await getSearchVolume(
                suggestionsToProcess,
                region,
                isUrl ? query : undefined,
                language
            );

            if (volumeResult.error || !volumeResult.results) {
                console.warn("[Server Action] Error fetching volume:", volumeResult.error || 'Unknown volume error');
                volumeList = []; // Proceed without volume if it fails
            } else {
                volumeList = volumeResult.results;
                console.log(`[Server Action] Got volume data for ${volumeList.length} keywords.`);
            }
        } else {
             console.log("[Server Action] No suggestions found to fetch volume for.");
        }

        // --- Apply Deduplication Logic Here ---
        console.log("[Server Action] Starting keyword deduplication...");
        const normalizedKeywordMap = new Map<string, Keyword>();

        // Process keywords with volume first
        volumeList.forEach(item => {
            if (!item.text) return; // Skip if text is missing

            const normalizedText = item.text.toLowerCase().replace(/\s+/g, '');
            const existingKeyword = normalizedKeywordMap.get(normalizedText);
            const currentVolume = item.searchVolume ?? 0;

            // Add if new or has higher volume than existing entry for this normalized text
            if (!existingKeyword || currentVolume > (existingKeyword.searchVolume ?? 0)) {
                normalizedKeywordMap.set(normalizedText, {
                    text: item.text, // Keep original text
                    searchVolume: currentVolume,
                });
            }
        });

        // Add suggestions that didn't have volume data or were lower volume duplicates
        suggestionsList.forEach(suggestionText => {
            if (!suggestionText) return;
            const normalizedText = suggestionText.toLowerCase().replace(/\s+/g, '');
            // Only add if this normalized text wasn't already added from the volume list
            if (!normalizedKeywordMap.has(normalizedText)) {
                normalizedKeywordMap.set(normalizedText, {
                    text: suggestionText, // Keep original text
                    searchVolume: 0, // Default volume
                });
            }
        });

        const deduplicatedKeywordsToSave: Keyword[] = Array.from(normalizedKeywordMap.values());
        console.log(`[Server Action] Deduplication complete. Keywords to save: ${deduplicatedKeywordsToSave.length}`);
        // --- End Deduplication ---

        // 3. Save Keyword Research Record (Create)
        console.log("[Server Action] Creating research record...");
        const researchInput: CreateKeywordResearchInput = {
            query: query,
            location: region,
            language: language,
            // Default other fields inside createKeywordResearch
        };
        const saveResult = await createKeywordResearch(researchInput); // Uses revalidate internally

        if (saveResult.error || !saveResult.data?.id) {
            // This is critical, throw the error
            throw new Error(`Failed to create research record: ${saveResult.error || 'Missing ID after creation'}`);
        }
        savedResearchId = saveResult.data.id;
        console.log(`[Server Action] Research record created: ${savedResearchId}`);

        // 4. Update record with *DEDUPLICATED* keywords (if any)
        if (deduplicatedKeywordsToSave.length > 0) {
             console.log(`[Server Action] Updating record ${savedResearchId} with ${deduplicatedKeywordsToSave.length} deduplicated keywords...`);
             // Call the specific update action which handles revalidation
             const updateKeywordsResult = await updateKeywordResearchKeywords(savedResearchId, deduplicatedKeywordsToSave);

             if (!updateKeywordsResult.success) {
                 // Log error but don't fail the whole operation, record is created.
                 console.error(`[Server Action] Failed to update keywords for ${savedResearchId}:`, updateKeywordsResult.error);
                 // Consider if this partial failure should be reflected in the final response
             } else {
                  console.log(`[Server Action] Successfully updated keywords for ${savedResearchId}`);
             }
        } else {
            console.log(`[Server Action] No keywords derived after deduplication for record ${savedResearchId}. Skipping keyword update.`);
        }

        // 5. Trigger Background Clustering (remains the same, uses the now deduplicated saved keywords)
        if (savedResearchId) {
            console.log(`[Server Action] Initiating background clustering task for ${savedResearchId}...`);
            triggerKeywordClustering(savedResearchId).then(result => {
                if (!result.success) {
                    console.error(`[Server Action - Background] Clustering failed for ${savedResearchId}:`, result.error);
                } else {
                    console.log(`[Server Action - Background] Clustering completed for ${savedResearchId}.`);
                }
            }).catch(error => {
                console.error(`[Server Action - Background] Unexpected error during clustering trigger for ${savedResearchId}:`, error);
            });
        }

        // Success! Return immediately after initiating clustering
        console.log(`[Server Action] Returning success early for ${savedResearchId}. Clustering runs in background.`);
        return {
            success: true,
            researchId: savedResearchId,
            error: null,
        };

    } catch (error: unknown) {
        console.error("[Server Action] Critical error in processAndSaveKeywordQuery:", error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred during processing.';
        // Return error state
        return {
            success: false,
            researchId: savedResearchId, // Return ID if created before the error
            error: message,
        };
    }
}

// Ensure Keyword type is imported or defined if not already
// type Keyword = { text: string; searchVolume?: number; /* other fields */ };