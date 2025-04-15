'use server';

import { getKeywordSuggestions, getUrlSuggestions } from '@/app/actions';
import { generateRelatedKeywordsAI } from '@/app/services/ai-keyword-patch';
import { COLLECTIONS, db } from '@/app/services/firebase/config';
import { getSearchVolume } from '@/app/services/keyword-idea-api.service';
// Import types primarily from schemas
import {
  type ClusteringStatus,
  type CreateKeywordResearchInput, // Use inferred type from schema
  type KeywordResearchFilter,
  type KeywordResearchItem, // Use inferred type from schema
  type KeywordResearchListItem, // Use inferred type from schema
  type KeywordVolumeItem, // Assuming this comes from keyword.schema?
  type UpdateClustersInput, // Use inferred type from schema
  type UpdateKeywordResearchInput,
  type UserPersona // <-- Import UserPersona type
} from '@/lib/schema'; // Adjusted import path
// Import the extended list item and potentially Keyword from our specific types file
import { updateKeywordResearchResults } from '@/app/services/firebase/keyword-research';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { performSemanticClustering as performSemanticClusteringService } from './semantic-clustering';
// --- Import the Chinese type detection utility ---

interface ProcessQueryInput {
  query: string;
  region: string;
  language: string;
  useAlphabet: boolean;
  useSymbols: boolean;
  maxKeywords?: number; // OBSOLETE - Now using fixed limit below
  minSearchVolume?: number;
}

interface ProcessQueryResult {
  success: boolean;
  researchId: string | null;
  error?: string | null;
}

// Define the fixed limit for keywords sent to Ads API
const MAX_VOLUME_CHECK_KEYWORDS = 60;

const KEYWORD_RESEARCH_TAG = 'KeywordResearch';

// Define the extended type locally
export type KeywordResearchListItemWithTotalVolume = KeywordResearchListItem & {
  totalVolume: number;
};

// --- Firestore Helper Functions (Internal) ---

/**
 * Converts Firestore Timestamps to Dates.
 */
function convertTimestamps<
  T extends {
    id?: string;
    createdAt?: Timestamp | Date | string | number | unknown;
    updatedAt?: Timestamp | Date | string | number | unknown;
  } & Record<string, unknown>
>(
  data: T
): Omit<T, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date } {
  const result = { ...data } as any; // Start with a copy

  // Simplified conversion logic (similar to previous working version)
  if (data.createdAt instanceof Timestamp) {
    result.createdAt = data.createdAt.toDate();
  } else if (data.createdAt) {
    try {
      result.createdAt = new Date(data.createdAt as any);
    } catch {
      /* ignore */
    }
    if (!result.createdAt || isNaN(result.createdAt.getTime()))
      delete result.createdAt;
  } else {
    delete result.createdAt; // Ensure property is removed if not convertible
  }

  if (data.updatedAt instanceof Timestamp) {
    result.updatedAt = data.updatedAt.toDate();
  } else if (data.updatedAt) {
    try {
      result.updatedAt = new Date(data.updatedAt as any);
    } catch {
      /* ignore */
    }
    if (!result.updatedAt || isNaN(result.updatedAt.getTime()))
      delete result.updatedAt;
  } else {
    delete result.updatedAt; // Ensure property is removed if not convertible
  }

  return result; // Return type is inferred correctly by TS now
}

// --- Internal Cache Revalidation Helper ---

async function revalidateResearch(researchId?: string) {
  // Always revalidate the list tag and history page path
  revalidateTag(KEYWORD_RESEARCH_TAG);
  console.log(
    `[Internal Helper][Revalidate] Revalidated tag: ${KEYWORD_RESEARCH_TAG} and `
  );

  // Only revalidate the specific item tag AND path if an ID is provided
  if (researchId) {
    const itemPath = `/keyword-mapping/${researchId}`;
    // Adding the specific tag for detail view cache
    revalidateTag(`${KEYWORD_RESEARCH_TAG}_${researchId}`);
    revalidatePath(itemPath); // Add path revalidation for the specific item
    console.log(
      `[Internal Helper][Revalidate] Also revalidated specific tag: ${KEYWORD_RESEARCH_TAG}_${researchId} and path: ${itemPath}.`
    );
  }
}

// --- Cache Revalidation Action (NEW - Keep for potential other uses?) ---

/**
 * Server action dedicated to revalidating keyword research cache tags and paths.
 * Can be safely called from client components after an operation completes.
 * @param researchId Optional ID for revalidating a specific item.
 */
export async function revalidateKeywordData(
  researchId?: string
): Promise<void> {
  // Simply call the internal helper
  await revalidateResearch(researchId);
}

// --- Server Actions ---

// Cached function to fetch the list
const getCachedKeywordResearchList = unstable_cache(
  async (
    userId?: string,
    filters?: KeywordResearchFilter,
    limit = 50
  ): Promise<KeywordResearchListItemWithTotalVolume[]> => {
    console.log(
      `[Cache Miss] Fetching keyword research list: userId=${userId}, limit=${limit}, filters=${JSON.stringify(
        filters
      )}`
    );
    if (!db) throw new Error('Database not initialized');

    const query = db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    // TODO: Apply userId and filters to the query
    // if (userId) { query = query.where('userId', '==', userId); }
    // Apply other filters...

    const snapshot = await query.get();

    return snapshot.docs.map(doc => {
      // 1. Get raw data from Firestore
      const firestoreData = doc.data();

      // 2. Calculate totalVolume using the raw data
      let totalVolume = 0;
      const dataWithPotentialKeywords =
        firestoreData as Partial<KeywordResearchItem>;
      if (
        dataWithPotentialKeywords.keywords &&
        Array.isArray(dataWithPotentialKeywords.keywords)
      ) {
        totalVolume = (
          dataWithPotentialKeywords.keywords as KeywordVolumeItem[]
        ).reduce((sum: number, kw) => sum + (kw.searchVolume ?? 0), 0);
      }

      // 3. Convert timestamps separately to get Date objects
      const convertedTimestamps = convertTimestamps(firestoreData);

      // 4. Construct the final list item object using original data + converted timestamps
      return {
        id: doc.id, // Use doc.id directly
        query: firestoreData.query as string, // Use original data
        region: firestoreData.region as string | undefined, // Use original data
        language: firestoreData.language as string | undefined, // Use original data
        searchEngine: firestoreData.searchEngine as string | undefined, // Use original data
        device: firestoreData.device as 'desktop' | 'mobile' | undefined, // Use original data
        isFavorite: firestoreData.isFavorite as boolean, // Use original data
        tags: firestoreData.tags as string[], // Use original data
        clustering_status: firestoreData.clustering_status as
          | ClusteringStatus
          | undefined, // Use original data
        createdAt: convertedTimestamps.createdAt, // Use converted timestamp
        updatedAt: convertedTimestamps.updatedAt, // Use converted timestamp
        totalVolume: totalVolume
      } as KeywordResearchListItemWithTotalVolume; // Final assertion
    });
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
): Promise<{
  data: KeywordResearchListItemWithTotalVolume[];
  error: string | null;
}> {
  try {
    const researches = await getCachedKeywordResearchList(
      userId,
      filters,
      limit
    );
    console.log(
      `[Server Action] Fetched ${researches.length} items (potentially cached).`
    );
    return { data: researches, error: null };
  } catch (error) {
    console.error('獲取 Keyword Research 列表失敗:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch list'
    };
  }
}

// Re-introduce unstable_cache wrapper for detail fetching
const getCachedKeywordResearchDetail = unstable_cache(
  async (researchId: string): Promise<KeywordResearchItem | null> => {
    // Direct fetch logic moved here
    console.log(`[Cache Miss] Fetching detail for researchId: ${researchId}`);
    if (!db) throw new Error('Database not initialized');
    if (!researchId) return null;

    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`找不到記錄: ${researchId}`);
      return null;
    }
    const data = docSnap.data();
    if (!data) return null;

    // Cast to KeywordResearchItem after converting timestamps
    return convertTimestamps({
      ...data,
      id: docSnap.id
    }) as KeywordResearchItem;
  },
  // Key Parts: Base + researchId makes the cache key unique per item
  ['keywordResearchDetail'], // researchId argument is automatically part of the key
  // Use a static tag for general revalidation
  { tags: [KEYWORD_RESEARCH_TAG] }
);

// 获取特定 Keyword Research 详情 (Uses cached function again)
export async function fetchKeywordResearchDetail(
  researchId: string
): Promise<KeywordResearchItem | null> {
  try {
    console.log(
      `[Server Action] Attempting to fetch detail via cache for: ${researchId}`
    );
    const detail = await getCachedKeywordResearchDetail(researchId);
    return detail;
  } catch (error) {
    console.error(`獲取詳情 (${researchId}) 失敗:`, error);
    return null;
  }
}

// 删除 Keyword Research
export async function deleteKeywordResearch(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: 'Database not initialized' };
  if (!researchId) return { success: false, error: 'Research ID is required' };

  try {
    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();
    await revalidateResearch(researchId); // Use helper
    return { success: true };
  } catch (error) {
    console.error(`刪除 (${researchId}) 失敗:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete'
    };
  }
}

// 创建 Keyword Research
export async function createKeywordResearch(
  input: CreateKeywordResearchInput
): Promise<{ data: KeywordResearchItem | null; error: string | null }> {
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
      region: input.region ?? '', // Optional from input
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
      personas: [], // CORRECT: Initialize as empty array
      clustering_status: 'pending' as ClusteringStatus, // <--- Add initial status
      // ---------------------------------------------------------------
      createdAt: now,
      updatedAt: now
    };

    const docRef = await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .add(dataToSave);
    const newResearchId = docRef.id;
    // Add the generated id to the object before converting timestamps
    const newResearchData = { ...dataToSave, id: newResearchId };

    await revalidateResearch(); // Revalidate list only

    // Convert timestamps
    const convertedData = convertTimestamps(newResearchData);

    // Explicitly construct the return object to match KeywordResearchItem schema
    const returnData: KeywordResearchItem = {
      id: newResearchId,
      query: convertedData.query,
      createdAt: convertedData.createdAt as Date, // We know it's a Date here
      updatedAt: convertedData.updatedAt as Date, // We know it's a Date here
      searchEngine: convertedData.searchEngine,
      region: convertedData.region,
      language: convertedData.language,
      device: convertedData.device,
      isFavorite: convertedData.isFavorite,
      tags: convertedData.tags,
      keywords: convertedData.keywords as KeywordVolumeItem[], // Ensure keywords array is correct type
      clusters: convertedData.clusters as Record<string, string[]>, // Ensure clusters object is correct type
      personas: convertedData.personas as UserPersona[], // Ensure personas array is correct type
      clustering_status: convertedData.clustering_status
      // Add any other fields from KeywordResearchItem if necessary
    };

    return {
      data: returnData,
      error: null
    };
  } catch (error) {
    console.error('創建 Keyword Research 失敗:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to create'
    };
  }
}

// 更新 Keyword Research (通用)
export async function updateKeywordResearch(
  researchId: string,
  input: UpdateKeywordResearchInput
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: false, error: 'Database not initialized' };
  if (!researchId) return { success: false, error: 'Research ID is required' };
  if (Object.keys(input).length === 0)
    return { success: false, error: 'No update data' };

  try {
    const dataToUpdate = { ...input, updatedAt: Timestamp.now() };
    await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .update(dataToUpdate);
    // Keep revalidation here for general updates like name/description
    await revalidateResearch(researchId);
    return { success: true };
  } catch (error) {
    console.error(`更新 (${researchId}) 失敗:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update'
    };
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
    await db
      .collection(COLLECTIONS.KEYWORD_RESEARCH)
      .doc(researchId)
      .update({ clusters: input.clusters, updatedAt: Timestamp.now() });
    // Remove revalidation - will be handled by the calling action
    // await revalidateResearch(researchId);
    return { success: true };
  } catch (error) {
    console.error(`更新 Clusters (${researchId}) 失敗:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update clusters'
    };
  }
}

// 更新 Keywords (Overwrites existing keywords)
export async function updateKeywordResearchKeywords(
  researchId: string,
  keywords: KeywordVolumeItem[] // Expects KeywordVolumeItem array now
): Promise<{ success: boolean; error?: string }> {
  // Remove direct db access check if db is handled within the service function
  // if (!db) return { success: false, error: 'Database not initialized' };
  if (!researchId) return { success: false, error: 'Research ID is required' };

  // TODO: Add validation for the structure of each Keyword in the array using a Zod schema if needed

  try {
    const success = await updateKeywordResearchResults(researchId, keywords);
    if (success) {
      // Remove revalidation - will be handled by the calling action
      // await revalidateResearch(researchId);
      return { success: true };
    } else {
      return {
        success: false,
        error: 'Failed to update keywords via service function'
      };
    }
  } catch (error) {
    // Catch errors from the service function call itself
    console.error(`更新 Keywords (${researchId}) 失敗 via service:`, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to update keywords'
    };
  }
}

// --- Placeholder Clustering Service ---
// Replace this with your actual clustering implementation
async function performClustering(
  keywords: KeywordVolumeItem[] // Use KeywordVolumeItem
): Promise<Record<string, string[]>> {
  console.log(
    `[Clustering Service] Preparing ${keywords.length} keywords for semantic clustering...`
  );
  if (!keywords || keywords.length === 0) {
    console.warn('[Clustering Service] No keywords provided.');
    return {};
  }

  // Extract just the text from the KeywordVolumeItem objects
  const keywordTexts = keywords.map(kw => kw.text).filter(text => !!text);

  if (keywordTexts.length < 5) {
    // Match the validation in performSemanticClusteringService
    console.warn(
      `[Clustering Service] Not enough keywords (${keywordTexts.length}) for semantic clustering. Minimum is 5.`
    );
    return {};
  }

  try {
    // Call the actual semantic clustering server action
    // Note: We don't specify the model, letting it use the default ('gpt-4o-mini')
    const clusteringResult = await performSemanticClusteringService({
      keywords: keywordTexts
    });

    // The service already validates the schema and returns the clusters object
    console.log(
      `[Clustering Service] Semantic clustering complete. Found ${
        Object.keys(clusteringResult.clusters).length
      } clusters.`
    );
    return clusteringResult.clusters; // Return the clusters part of the result
  } catch (error) {
    console.error(
      '[Clustering Service] Error calling performSemanticClusteringService:',
      error
    );
    // Decide how to handle the error - return empty or re-throw?
    // Returning empty allows the process to continue without clusters.
    return {};
  }
}

// --- Server Action to Trigger and Save Clustering ---
export async function triggerKeywordClustering(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  if (!researchId) return { success: false, error: 'Research ID is required' };

  // Define docRef here to use in catch block
  const docRef = db?.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
  if (!docRef)
    return {
      success: false,
      error: 'Database not initialized or invalid research ID'
    };

  try {
    console.log(
      `[Server Action] Triggering clustering for researchId: ${researchId}`
    );
    // 1. Fetch the research item to get keywords
    const researchDetail = await fetchKeywordResearchDetail(researchId); // Uses cache
    if (
      !researchDetail ||
      !researchDetail.keywords ||
      researchDetail.keywords.length === 0
    ) {
      console.warn(
        `[Server Action] No keywords found for ${researchId} to cluster.`
      );
      return { success: true }; // Nothing to cluster
    }

    // --- Deduplication Logic --- Use KeywordVolumeItem ---
    const normalizedKeywordMap = new Map<string, KeywordVolumeItem>();
    (researchDetail.keywords as KeywordVolumeItem[]).forEach(keyword => {
      if (!keyword.text) return; // Skip if text is missing

      const normalizedText = keyword.text.toLowerCase().replace(/\s+/g, '');
      const existingKeyword = normalizedKeywordMap.get(normalizedText);

      // If no keyword with this normalized text exists OR the current keyword has higher volume, add/replace it
      if (
        !existingKeyword ||
        (keyword.searchVolume ?? 0) > (existingKeyword.searchVolume ?? 0)
      ) {
        normalizedKeywordMap.set(normalizedText, keyword); // keyword is KeywordVolumeItem
      }
    });

    const deduplicatedKeywords: KeywordVolumeItem[] = Array.from(
      normalizedKeywordMap.values()
    );
    console.log(
      `[Server Action] Deduplicated keywords for ${researchId}: ${researchDetail.keywords.length} -> ${deduplicatedKeywords.length}`
    );
    // --- End Deduplication ---

    // 2. Perform clustering (Uses deduplicated keywords)
    if (deduplicatedKeywords.length < 5) {
      // Also check here before calling clustering
      console.warn(
        `[Server Action] Not enough unique keywords (${deduplicatedKeywords.length}) after deduplication for ${researchId}. Minimum is 5. Skipping clustering.`
      );
      return { success: true }; // Not an error, just nothing to cluster
    }
    const clusters = await performClustering(deduplicatedKeywords);

    // 3. Save the clusters
    if (Object.keys(clusters).length > 0) {
      console.log(
        `[Server Action] Saving ${
          Object.keys(clusters).length
        } clusters for ${researchId}`
      );
      // Use the existing action to update clusters and handle revalidation
      // Fix: Add updatedAt to satisfy the type checker, even if overridden internally.
      const updateResult = await updateKeywordResearchClusters(researchId, {
        clusters,
        updatedAt: new Date()
      });
      if (!updateResult.success) {
        throw new Error(
          updateResult.error ||
            'Failed to save clusters via updateKeywordResearchClusters'
        );
      }
      console.log(
        `[Server Action] Clusters saved successfully for ${researchId}`
      );
    } else {
      console.log(
        `[Server Action] No clusters generated for ${researchId}. Not updating.`
      );
    }

    // Inside the try block, after successful cluster update:
    // Update status to 'completed' explicitly
    await docRef.update({
      clustering_status: 'completed',
      updatedAt: Timestamp.now()
    });
    console.log(
      `[Server Action] Status updated to 'completed' for ${researchId}`
    );

    // REMOVED Revalidation - Rely on router.refresh() in client
    // await revalidateResearch(researchId);

    return { success: true };
  } catch (error) {
    console.error(
      `[Server Action] Clustering failed for ${researchId}:`,
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during clustering';

    // --- Update status to 'failed' on error ---
    try {
      await docRef.update({
        clustering_status: 'failed',
        updatedAt: Timestamp.now()
      });
      console.log(
        `[Server Action] Status updated to 'failed' for ${researchId} due to error.`
      );
    } catch (updateError) {
      console.error(
        `[Server Action] CRITICAL: Failed to update status to 'failed' for ${researchId} after error:`,
        updateError
      );
    }
    // --- End status update ---

    return { success: false, error: message };
  }
}

export async function processAndSaveKeywordQuery(
  input: ProcessQueryInput
): Promise<ProcessQueryResult> {
  // --- Keyword Generation & Processing Flow ---
  // 1. Query: Start with the user's input query.
  // 2. Generate Space Variations: Create keywords by inserting spaces.
  // 3. Get AI Suggestions: Generate supplementary keywords using AI.
  // 4. Get Google Suggestions: Fetch suggestions from Google Autocomplete (base, alphabet, symbols).
  // 5. Combine All & Deduplicate: Merge all sources and get a unique master list (`initialUniqueKeywords`).
  // 6. Prioritize for Volume Check: Select up to MAX_VOLUME_CHECK_KEYWORDS (60) keywords from the master list, prioritizing: Space Variations > AI Suggestions > Google Suggestions.
  // 7. Get Search Volume: Fetch search volume data from Google Ads API for the prioritized list.
  // 8. Filter & Finalize: Filter keywords based on minSearchVolume, merge keywords (from volume check AND the full master list) ensuring final uniqueness and including zero-volume ones.
  // 9. Save: Save the final list of KeywordVolumeItems to Firestore.
  // -------------------------------------------

  const {
    query,
    region,
    language,
    useAlphabet, // Still needed for getKeywordSuggestions
    useSymbols, // Still needed for getKeywordSuggestions
    // maxKeywords, // No longer used directly for slicing here
    minSearchVolume
  } = input;

  let spaceVariations: string[] = [];
  let aiSuggestList: string[] = [];
  let googleSuggestList: string[] = []; // Will contain base, alphabet, symbols etc.
  let volumeDataList: KeywordVolumeItem[] = [];
  let savedResearchId: string | null = null;
  const isUrl = query.startsWith('http');
  const currentInputType = isUrl ? 'url' : 'keyword';

  try {
    // --- Step 2: Generate Space Variations ---
    console.log('[Server Action] Starting Step 2: Generate Space Variations');
    // Check if the query consists ONLY of CJK characters and spaces
    if (/^[\u4e00-\u9fa5\s]+$/.test(query)) {
      console.log(
        '[Server Action] Query is CJK-only, generating space variations...'
      );
      // Add the original query itself
      spaceVariations.push(query.trim()); // Trim whitespace just in case

      // Loop through the original CJK query to insert spaces
      // Ensure we don't add leading/trailing spaces if query wasn't trimmed initially
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 1) {
        for (let i = 1; i < trimmedQuery.length; i++) {
          const spacedKeyword =
            trimmedQuery.slice(0, i) + ' ' + trimmedQuery.slice(i);
          spaceVariations.push(spacedKeyword);
        }
      }
    } else {
      console.log(
        '[Server Action] Query contains non-CJK characters, skipping space variations.'
      );
      // If query is not purely CJK/space, spaceVariations remains empty for this step
      // We might still add the original query later if needed, but not spaced variations.
    }

    // Deduplicate any generated variations (including the original if added)
    spaceVariations = [...new Set(spaceVariations)];
    console.log(
      `[Server Action] Generated ${spaceVariations.length} space variations.`
    );
    // console.log("[Server Action] Space Variations:", spaceVariations);

    // --- Step 3: Get AI Suggestions ---
    console.log(
      `[Server Action] Starting Step 3: Get AI Suggestions for: ${query}`
    );
    try {
      aiSuggestList = await generateRelatedKeywordsAI(
        query,
        region,
        language,
        10
      );
      console.log(
        `[Server Action] Got ${aiSuggestList.length} suggestions from AI.`
      );
      console.log('[Server Action] AI Suggestions List:', aiSuggestList);
    } catch (aiError) {
      console.error(`[Server Action] Failed to get AI suggestions:`, aiError);
      aiSuggestList = [];
    }

    // --- Step 4: Get Google Suggestions ---
    // Note: getKeywordSuggestions internally combines base, alphabet, symbols, and *its own* space variations.
    // We will use its output but prioritize our own generated space variations above.
    console.log(
      `[Server Action] Starting Step 4: Get Google Suggestions for: ${query}`
    );
    let suggestionsResult;
    if (currentInputType === 'keyword') {
      suggestionsResult = await getKeywordSuggestions(
        query,
        region,
        language,
        useAlphabet,
        useSymbols
      );
    } else {
      suggestionsResult = await getUrlSuggestions({
        url: query,
        region,
        language
      });
    }
    if (suggestionsResult.error || !suggestionsResult.suggestions) {
      console.warn(
        `[Server Action] Google Suggestion Warning: ${
          suggestionsResult.error || 'No suggestions found'
        }`
      );
      googleSuggestList = [];
    } else {
      // Exclude space variations already generated in Step 2 from the google list to avoid double prioritization later
      const spaceVariationSet = new Set(spaceVariations);
      googleSuggestList = suggestionsResult.suggestions.filter(
        s => !spaceVariationSet.has(s)
      );
      console.log(
        `[Server Action] Got ${googleSuggestList.length} suggestions from Google (excluding duplicates from Step 2).`
      );
      // console.log("[Server Action] Google Suggestions List (filtered):", googleSuggestList);
    }

    // --- Step 5: Combine All & Deduplicate ---
    console.log('[Server Action] Starting Step 5: Combine All & Deduplicate');
    const allCombinedSources = [
      ...spaceVariations,
      ...aiSuggestList,
      ...googleSuggestList
    ];

    const initialUniqueKeywords = [...new Set(allCombinedSources)].filter(
      kw => kw && kw.trim()
    ); // Ensure not empty/whitespace

    console.log(
      `[Server Action] Total unique keywords from all sources (after potential filtering): ${initialUniqueKeywords.length}`
    );

    if (initialUniqueKeywords.length === 0) {
      console.warn(
        '[Server Action] No unique keywords found after combining sources. Aborting further processing.'
      );
      const createResult = await createKeywordResearch({
        query,
        region,
        language
      });
      if (createResult.error || !createResult.data?.id)
        throw new Error(createResult.error || 'Failed to create empty record');
      return {
        success: true,
        researchId: createResult.data.id,
        error: 'No keywords found to process.'
      };
    }

    // --- Step 6: Prioritize for Volume Check ---
    console.log(
      `[Server Action] Starting Step 6: Prioritize up to ${MAX_VOLUME_CHECK_KEYWORDS} keywords for Volume Check`
    );
    const keywordsForVolumeCheck: string[] = [];
    const addedKeywords = new Set<string>();

    const addPrioritized = (keyword: string) => {
      const trimmedKeyword = keyword.trim();
      if (
        trimmedKeyword &&
        !addedKeywords.has(trimmedKeyword) &&
        keywordsForVolumeCheck.length < MAX_VOLUME_CHECK_KEYWORDS
      ) {
        keywordsForVolumeCheck.push(trimmedKeyword);
        addedKeywords.add(trimmedKeyword);
        return true;
      }
      return false;
    };

    console.log('[Server Action] Prioritizing Space Variations...');
    spaceVariations.forEach(addPrioritized);
    console.log(
      `[Server Action] Added ${keywordsForVolumeCheck.length} keywords after space variations.`
    );

    console.log('[Server Action] Prioritizing AI Suggestions...');
    aiSuggestList.forEach(addPrioritized);
    console.log(
      `[Server Action] Added ${keywordsForVolumeCheck.length} keywords after AI suggestions.`
    );

    console.log('[Server Action] Prioritizing Google Suggestions...');
    googleSuggestList.forEach(addPrioritized); // Add remaining Google suggestions
    console.log(
      `[Server Action] Added ${keywordsForVolumeCheck.length} keywords after Google suggestions.`
    );

    // If still under limit, fill with remaining unique keywords (less likely with combined sources)
    if (keywordsForVolumeCheck.length < MAX_VOLUME_CHECK_KEYWORDS) {
      console.log(
        '[Server Action] Filling remaining slots with other unique keywords...'
      );
      initialUniqueKeywords.forEach(addPrioritized);
    }

    console.log(
      `[Server Action] Final list for volume check (${keywordsForVolumeCheck.length} keywords):`
    );
    console.log(keywordsForVolumeCheck);

    // --- Step 7: Get Search Volume ---
    console.log('[Server Action] Starting Step 7: Get Search Volume');
    const volumeResult = await getSearchVolume(
      keywordsForVolumeCheck, // Pass the prioritized list
      region,
      isUrl ? query : undefined,
      language
    );

    // Process volume results (volumeDataList will be populated or remain [])
    if (volumeResult.error || !volumeResult.results) {
      console.warn(
        '[Server Action] Error fetching volume:',
        volumeResult.error ||
          'Unknown volume error. Proceeding without volume data.'
      );
      volumeDataList = [];
    } else {
      volumeDataList = volumeResult.results;
      console.log(
        `[Server Action] Received volume data for ${volumeDataList.length} keywords from Google Ads API.`
      );
      // console.log("[Server Action] Volume Data Received:", volumeDataList);
    }

    // --- Step 8: Filter & Finalize ---
    console.log(
      '[Server Action] Starting Step 8: Filter & Finalize Keyword List'
    );
    const finalKeywordMap = new Map<string, KeywordVolumeItem>();

    // Process keywords that HAVE volume data first (from volumeDataList)
    const processedVolumeKeywords = new Set<string>(); // Track normalized text from volume results
    volumeDataList.forEach((item: KeywordVolumeItem) => {
      if (!item.text) return;
      const normalizedText = item.text.toLowerCase().replace(/\s+/g, '');
      processedVolumeKeywords.add(normalizedText); // Mark as processed

      if ((item.searchVolume ?? 0) >= (minSearchVolume || 0)) {
        const existing = finalKeywordMap.get(normalizedText);
        if (
          !existing ||
          (item.searchVolume ?? 0) > (existing.searchVolume ?? 0)
        ) {
          finalKeywordMap.set(normalizedText, item); // Add/update with higher volume
        }
      } else {
        // Filtered out due to low volume
      }
    });
    console.log(
      `[Server Action] ${
        finalKeywordMap.size
      } keywords kept after volume filtering (min vol: ${
        minSearchVolume || 0
      }).`
    );

    // Add back keywords from the *full master list* (`initialUniqueKeywords`) that were *not* processed
    // (either not sent for volume check, or API didn't return data for them),
    // or were filtered out by minSearchVolume, marking them as zero volume.
    initialUniqueKeywords.forEach(keywordText => {
      if (!keywordText) return;
      const normalizedText = keywordText.toLowerCase().replace(/\s+/g, '');
      // Add IF it's not already in the final map (meaning it passed volume filter)
      if (!finalKeywordMap.has(normalizedText)) {
        finalKeywordMap.set(normalizedText, {
          text: keywordText, // Keep original text from the master list
          searchVolume: 0
        });
      }
    });

    const finalKeywordsToSave: KeywordVolumeItem[] = Array.from(
      finalKeywordMap.values()
    );
    console.log(
      `[Server Action] Final unique list size (including zero volume): ${finalKeywordsToSave.length}`
    );
    // console.log("[Server Action] Final list to save:", finalKeywordsToSave);

    // --- Step 9: Save ---
    console.log('[Server Action] Starting Step 9: Save Results');
    const researchInput: CreateKeywordResearchInput = {
      query,
      region,
      language
    };
    const saveResult = await createKeywordResearch(researchInput);

    if (saveResult.error || !saveResult.data?.id) {
      throw new Error(
        `Failed to create research record: ${
          saveResult.error || 'Missing ID after creation'
        }`
      );
    }
    savedResearchId = saveResult.data.id;
    console.log(`[Server Action] Research record created: ${savedResearchId}`);

    // Update record with the final keyword list
    if (finalKeywordsToSave.length > 0) {
      console.log(
        `[Server Action] Updating record ${savedResearchId} with ${finalKeywordsToSave.length} final keywords...`
      );
      const updateKeywordsResult = await updateKeywordResearchKeywords(
        savedResearchId,
        finalKeywordsToSave
      );
      if (!updateKeywordsResult.success) {
        console.error(
          `[Server Action] Failed to update keywords for ${savedResearchId}:`,
          updateKeywordsResult.error
        );
      } else {
        console.log(
          `[Server Action] Successfully updated keywords for ${savedResearchId}`
        );
      }
    } else {
      console.log(
        `[Server Action] No keywords to save for record ${savedResearchId}.`
      );
    }

    console.log(
      `[Server Action] Process completed successfully for ${savedResearchId}.`
    );
    return { success: true, researchId: savedResearchId, error: null };
  } catch (error: unknown) {
    console.error(
      '[Server Action] Critical error in processAndSaveKeywordQuery:',
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during processing.';
    return { success: false, researchId: savedResearchId, error: message };
  }
}

// --- Action to Fetch Clustering Status (Safe for Render Path) ---

/**
 * Fetches the current clustering status of a Keyword Research item.
 *
 * @param researchId The ID of the Keyword Research item.
 * @returns The current ClusteringStatus ('pending', 'processing', 'completed', 'failed', or null).
 */
export async function fetchClusteringStatus( // Renamed
  researchId: string
): Promise<ClusteringStatus | null> {
  console.log(
    `[Server Action] fetchClusteringStatus called for researchId: ${researchId}` // Renamed log
  );
  if (!db) {
    console.error(
      '[Server Action][fetchClusteringStatus] Database not initialized'
    ); // Renamed log
    return null;
  }
  if (!researchId) {
    console.warn(
      '[Server Action][fetchClusteringStatus] Research ID is required'
    ); // Renamed log
    return null;
  }

  const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);

  try {
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(
        `[Server Action][fetchClusteringStatus] Document not found: ${researchId}`
      ); // Renamed log
      return null;
    }

    const data = docSnap.data() as Omit<
      KeywordResearchItem,
      'clustering_status'
    > & { clustering_status?: ClusteringStatus };
    const currentStatus = data?.clustering_status ?? null;

    console.log(
      `[Server Action][fetchClusteringStatus] Current status for ${researchId}: ${currentStatus}`
    ); // Renamed log

    // --- Removed update, trigger, and revalidation logic ---

    return currentStatus; // Return the existing status
  } catch (error) {
    console.error(
      `[Server Action][fetchClusteringStatus] Error fetching clustering status for ${researchId}:`, // Renamed log
      error
    );
    return null;
  }
}

// --- Action to Request Clustering Start (Safe for Client Call) ---

/**
 * Requests the clustering process to start for a specific Keyword Research item.
 * Updates the status to 'processing', triggers the background job (TODO), and revalidates cache.
 * Should be called from a client component action (e.g., button click).
 *
 * @param researchId The ID of the Keyword Research item.
 * @returns Object indicating success or failure.
 */
export async function requestClustering(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `[Server Action] requestClustering called for researchId: ${researchId}`
  );
  if (!db) {
    const errorMsg =
      '[Server Action][requestClustering] Database not initialized';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  if (!researchId) {
    const errorMsg =
      '[Server Action][requestClustering] Research ID is required';
    console.warn(errorMsg);
    return { success: false, error: errorMsg };
  }

  const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);

  try {
    // Fetch current status first to avoid unnecessary updates/triggers
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      const errorMsg = `[Server Action][requestClustering] Document not found: ${researchId}`;
      console.warn(errorMsg);
      return { success: false, error: 'Research item not found.' };
    }

    const data = docSnap.data() as Omit<
      KeywordResearchItem,
      'clustering_status'
    > & { clustering_status?: ClusteringStatus };
    const currentStatus = data?.clustering_status ?? null;

    // Only proceed if status allows triggering (null, pending, or failed)
    if (
      currentStatus === null ||
      currentStatus === 'pending' ||
      currentStatus === 'failed'
    ) {
      console.log(
        `[Server Action][requestClustering] Status is '${
          currentStatus ?? 'null'
        }'. Updating to 'processing' and triggering background task...`
      );

      // Update status to 'processing' in Firestore
      await docRef.update({
        clustering_status: 'processing',
        updatedAt: Timestamp.now() // Also update the timestamp
      });

      // Trigger background task
      triggerKeywordClustering(researchId)
        .then(result => {
          if (!result.success) {
            console.error(
              `[Server Action][requestClustering Background] Clustering failed for ${researchId}:`,
              result.error
            );
            // Status should have been set to 'failed' inside triggerKeywordClustering's catch block
          } else {
            console.log(
              `[Server Action][requestClustering Background] Clustering trigger completed for ${researchId}. Actual clustering runs in background.`
            );
            // Status should have been set to 'completed' inside triggerKeywordClustering's try block
          }
        })
        .catch(error => {
          console.error(
            `[Server Action][requestClustering Background] Unexpected error during clustering trigger for ${researchId}:`,
            error
          );
          // --- Safeguard: Update status to 'failed' if the trigger itself fails ---
          docRef
            .update({
              clustering_status: 'failed',
              updatedAt: Timestamp.now()
            })
            .catch(updateError => {
              console.error(
                `[Server Action] CRITICAL: Failed to update status to 'failed' for ${researchId} after trigger error:`,
                updateError
              );
            });
          // --- End safeguard ---
        });

      // Revalidation is handled within triggerKeywordClustering now (via revalidateResearch)
      // console.log(`[Server Action][requestClustering] Revalidation deferred to background task.`);

      return { success: true };
    } else {
      // Clustering already started, completed, or failed. Don't re-trigger.
      console.log(
        `[Server Action][requestClustering] Clustering status is '${currentStatus}'. No action taken.`
      );
      // Indicate success=false but maybe provide a specific message if needed
      return {
        success: false,
        error: `Clustering already started or completed (status: ${currentStatus}).`
      };
    }
  } catch (error) {
    const errorMsg = `[Server Action][requestClustering] Error requesting clustering for ${researchId}:`;
    console.error(errorMsg, error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to request clustering.'
    };
  }
}
