'use server';

import { getKeywordSuggestions, getUrlSuggestions } from '@/app/actions';
import { generateRelatedKeywordsAI } from '@/app/services/ai-keyword-patch';
import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import { getSearchVolume } from '@/app/services/keyword-idea-api.service';
// Import types primarily from schemas
import {
  type CreateKeywordResearchInput, // Use inferred type from schema
  type KeywordResearchFilter,
  type KeywordResearchItem, // Use inferred type from schema
  type KeywordVolumeItem, // Assuming this comes from keyword.schema?
  type UpdateClustersInput, // Use inferred type from schema
  type UpdateKeywordResearchInput,
  type UserPersona // <-- Import UserPersona type
} from '@/lib/schema'; // Adjusted import path
// Import the extended list item and potentially Keyword from our specific types file
import { updateKeywordResearchResults } from '@/app/services/firebase/db-keyword-research';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
// --- Import the Chinese type detection utility ---
import {
  getKeywordResearchSummaryList, // <-- Import NEW DB function
  type KeywordResearchSummaryItem // <-- Import NEW DB type
} from '@/app/services/firebase/db-keyword-research';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

interface ProcessQueryInput {
  query: string;
  region: string;
  language: string;
  useAlphabet: boolean;
  useSymbols: boolean;
  filterZeroVolume: boolean;
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
export type KeywordResearchListItemWithTotalVolume = KeywordResearchItem & {
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

// --- Exported Cache Revalidation Helper ---
/**
 * Revalidates cache tags and paths related to keyword research.
 * Use this after mutations to ensure fresh data.
 * @param researchId Optional ID to revalidate a specific item's cache.
 */
export async function revalidateKeywordResearchCache(researchId?: string) {
  // Always revalidate the list tag and history page path
  revalidateTag(KEYWORD_RESEARCH_TAG);
  console.log(
    `[Cache Helper][Revalidate] Revalidated tag: ${KEYWORD_RESEARCH_TAG}`
  );

  // Only revalidate the specific item tag AND path if an ID is provided
  if (researchId) {
    const itemPath = `/keyword-mapping/${researchId}`;
    // Adding the specific tag for detail view cache
    // Ensure detail cache uses a consistent tagging scheme if modified
    const detailTag = `${KEYWORD_RESEARCH_TAG}_${researchId}`; // Define tag explicitly
    revalidateTag(detailTag);
    revalidatePath(itemPath); // Add path revalidation for the specific item
    console.log(
      `[Cache Helper][Revalidate] Also revalidated specific tag: ${detailTag} and path: ${itemPath}.`
    );
  }
}

// --- Cache Revalidation Action (Keep for potential other uses?) ---

/**
 * Server action dedicated to revalidating keyword research cache tags and paths.
 * Can be safely called from client components after an operation completes.
 * @param researchId Optional ID for revalidating a specific item.
 */
export async function revalidateKeywordData(
  researchId?: string
): Promise<void> {
  // Simply call the exported helper
  await revalidateKeywordResearchCache(researchId);
}

// --- Server Actions ---

// --- NEW: Cached function to fetch the summary list ---
const getCachedKeywordResearchSummaryList = unstable_cache(
  async (
    userId?: string,
    filters?: KeywordResearchFilter, // Keep filters param for future use
    limit = 50
  ): Promise<KeywordResearchSummaryItem[]> => {
    console.log(
      `[Cache Miss] Fetching keyword research SUMMARY list: userId=${userId}, limit=${limit}, filters=${JSON.stringify(
        filters
      )}`
    );
    // Directly call the DB function
    // TODO: Apply filters if/when implemented in getKeywordResearchSummaryList or here
    const summaryList = await getKeywordResearchSummaryList(limit, userId);
    return summaryList;
  },
  // Base key parts. Arguments (userId, filters, limit) differentiate cache entries.
  ['keywordResearchSummaryList'], // Use a new base key
  { tags: [KEYWORD_RESEARCH_TAG] } // Use the same tag for revalidation
);

// --- NEW: Action to fetch the summary list (replaces old fetchKeywordResearchList) ---
export async function fetchKeywordResearchSummaryAction(
  userId?: string,
  filters?: KeywordResearchFilter,
  limit = 50
): Promise<{
  data: KeywordResearchSummaryItem[] | null;
  error: string | null;
}> {
  try {
    const researches = await getCachedKeywordResearchSummaryList(
      userId,
      filters,
      limit
    );
    console.log(
      `[Server Action] Fetched ${researches.length} summary items (potentially cached).`
    );
    return { data: researches, error: null };
  } catch (error) {
    console.error('獲取 Keyword Research Summary 列表失敗:', error);
    return {
      data: null, // Return null on error
      error:
        error instanceof Error ? error.message : 'Failed to fetch summary list'
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
  // Use specific tag for item revalidation, matching revalidateKeywordResearchCache
  // Remove explicit type annotations from the function signature and return type
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
    // Note: We pass researchId directly. unstable_cache handles key generation.
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
    await revalidateKeywordResearchCache(researchId); // Use exported helper
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

    await revalidateKeywordResearchCache(); // Revalidate list only

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
      personas: convertedData.personas as UserPersona[] // Ensure personas array is correct type
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
    await revalidateKeywordResearchCache(researchId); // Use exported helper
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
    // Revalidation is now handled by the caller (requestClustering)
    // await revalidateKeywordResearchCache(researchId);
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
      // Revalidation should be handled by the calling action if needed
      // await revalidateKeywordResearchCache(researchId);
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

// --- NEW: Server Action to Find Relevant Research Queries using AI ---

// Define the expected output schema from the AI
const RelevantQueriesSchema = z.object({
  relevantQueries: z
    .array(z.string())
    .describe('An array containing only the query strings deemed relevant.')
});

interface FindRelevantQueriesInput {
  currentSerpQuery: string;
  recentQueries: string[];
  model?: string;
}

export async function findRelevantResearchQueries({
  currentSerpQuery,
  recentQueries,
  model = 'gpt-4.1-mini' // Or your preferred model
}: FindRelevantQueriesInput): Promise<{
  data: string[] | null;
  error: string | null;
}> {
  console.log(
    `[Server Action] Finding relevant queries for "${currentSerpQuery}" from ${recentQueries.length} recent items using ${model}.`
  );

  if (!currentSerpQuery || recentQueries.length === 0) {
    console.log(
      '[Server Action] Missing current query or recent queries list.'
    );
    return { data: [], error: null }; // Return empty if no input
  }

  // Construct the prompt for the AI
  const recentQueriesListString = recentQueries.map(q => `- ${q}`).join('\n');

  const prompt = `
Current SERP Query: "${currentSerpQuery}"

Recent Keyword Research Queries:
${recentQueriesListString}

Task: Analyze the list of "Recent Keyword Research Queries". Identify which of these recent queries are semantically relevant or closely related to the "Current SERP Query". Consider synonyms, related concepts, and user intent.

Output Format: Return ONLY a JSON object containing a single key "relevantQueries" which holds an array of strings. This array should contain ONLY the query strings from the "Recent Keyword Research Queries" list that you identified as relevant. If none are relevant, the array should be empty [].

Example Output:
{ "relevantQueries": ["relevant query string 1", "relevant query string 3"] }
{ "relevantQueries": [] }
`;

  try {
    console.log('[AI Call] Requesting relevance analysis...');
    const { object: aiResult } = await generateObject({
      model: openai(model),
      schema: RelevantQueriesSchema,
      prompt: prompt,
      mode: 'json' // Ensure JSON output mode
    });

    console.log(
      `[Server Action] AI analysis successful. Found ${aiResult.relevantQueries.length} relevant queries.`
    );
    // console.log('[Server Action] Relevant queries:', aiResult.relevantQueries);

    return { data: aiResult.relevantQueries, error: null };
  } catch (error) {
    console.error('[Server Action] AI relevance analysis failed:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to get relevance analysis from AI.';
    return { data: null, error: message };
  }
}
// --- End NEW Server Action ---

// --- Process and Save Keyword Query (remains the same for now) ---
export async function processAndSaveKeywordQuery(
  input: ProcessQueryInput
): Promise<ProcessQueryResult> {
  console.log('[Action: processAndSave] Received input:', input);
  
  // Destructure input, excluding useAlphabet and useSymbols
  const { query, region, language, filterZeroVolume } = 
    input;

  // Hardcode useAlphabet and useSymbols
  const useAlphabet = false;
  const useSymbols = true;

  console.log('[Server Action processAndSaveKeywordQuery] Processing keyword query:', query); 
  console.log('[Server Action processAndSaveKeywordQuery] Region:', region);
  console.log('[Server Action processAndSaveKeywordQuery] Language:', language);
  console.log('[Server Action processAndSaveKeywordQuery] Use Alphabet:', useAlphabet); // Log hardcoded value
  console.log('[Server Action processAndSaveKeywordQuery] Use Symbols:', useSymbols);   // Log hardcoded value
  console.log('[Server Action processAndSaveKeywordQuery] Filter Zero Volume:', filterZeroVolume);

  let aiSuggestList: string[] = [];
  let googleSuggestList: string[] = [];
  let volumeDataList: KeywordVolumeItem[] = [];
  let savedResearchId: string | null = null;
  const isUrl = query.startsWith('http');
  const currentInputType = isUrl ? 'url' : 'keyword';

  try {
    // --- Step 2: Generate Space Variations (REMOVED) ---
    console.log(
      '[Server Action] Step 2: Space Variations Generation Disabled.'
    );

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
    } catch (aiError) {
      console.error(`[Server Action] Failed to get AI suggestions:`, aiError);
      aiSuggestList = [];
    }

    // --- Step 4: Get Google Suggestions ---
    console.log(
      `[Server Action] Starting Step 4: Get Google Suggestions for: ${query}`
    );
    let suggestionsResult;
    if (currentInputType === 'keyword') {
      // --- Add Logging --- 
      console.log(`[Action: processAndSave] >>> Calling getKeywordSuggestions with useSymbols: ${useSymbols}`); // Log right before call
      suggestionsResult = await getKeywordSuggestions({
        query, // Pass as object property
        region,
        language,
        useAlphabet, // Pass as object property
        useSymbols   // Pass as object property
      });
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
      googleSuggestList = suggestionsResult.suggestions;
      console.log(
        `[Server Action] Got ${googleSuggestList.length} suggestions from Google.`
      );
    }

    // --- Step 5: Combine All & Deduplicate ---
    console.log('[Server Action] Starting Step 5: Combine All & Deduplicate');
    const allCombinedSources = [...aiSuggestList, ...googleSuggestList];
    // Ensure original query is included if not generated/suggested elsewhere
    if (query.trim() && !allCombinedSources.includes(query.trim())) {
      allCombinedSources.unshift(query.trim()); // Add original query to the beginning
    }

    const initialUniqueKeywords = [...new Set(allCombinedSources)].filter(
      kw => kw && kw.trim()
    );
    console.log(
      `[Server Action] Total unique keywords from all sources: ${initialUniqueKeywords.length}`
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

    // Start prioritization directly with AI Suggestions, then Google Suggestions
    console.log('[Server Action] Prioritizing AI Suggestions...');
    aiSuggestList.forEach(addPrioritized);
    console.log(
      `[Server Action] Added ${keywordsForVolumeCheck.length} keywords after AI suggestions.`
    );

    console.log('[Server Action] Prioritizing Google Suggestions...');
    googleSuggestList.forEach(addPrioritized);
    console.log(
      `[Server Action] Added ${keywordsForVolumeCheck.length} keywords after Google suggestions.`
    );

    // If still under limit, fill with remaining unique keywords
    if (keywordsForVolumeCheck.length < MAX_VOLUME_CHECK_KEYWORDS) {
      console.log(
        '[Server Action] Filling remaining slots with other unique keywords...'
      );
      initialUniqueKeywords.forEach(addPrioritized);
    }

    console.log(
      `[Server Action] Final list for volume check (${keywordsForVolumeCheck.length} keywords):`
    );
    // console.log(keywordsForVolumeCheck); // Keep commented out for brevity

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
      `[Server Action] Starting Step 8: Filter & Finalize Keyword List (Filter Zero Volume: ${filterZeroVolume})`
    );
    const finalKeywordMap = new Map<string, KeywordVolumeItem>();

    // Process keywords that HAVE volume data first (from volumeDataList)
    const processedVolumeKeywords = new Set<string>(); // Track normalized text from volume results
    volumeDataList.forEach((item: KeywordVolumeItem) => {
      if (!item.text) return;
      const normalizedText = item.text.toLowerCase().replace(/\s+/g, '');
      processedVolumeKeywords.add(normalizedText); // Mark as processed

      // Filter based on filterZeroVolume setting
      const currentVolume = item.searchVolume ?? 0;
      const shouldKeep = filterZeroVolume ? currentVolume > 0 : currentVolume >= 0;

      if (shouldKeep) {
        const existing = finalKeywordMap.get(normalizedText);
        // Keep the item with the highest volume if duplicates exist after normalization
        if (!existing || currentVolume > (existing.searchVolume ?? 0)) {
          finalKeywordMap.set(normalizedText, item);
        }
      } else {
        // Filtered out due to zero volume (when filterZeroVolume is true)
      }
    });
    console.log(
      `[Server Action] ${finalKeywordMap.size} keywords kept after processing volume results (Filter Zero: ${filterZeroVolume}).`
    );

    // Add back keywords from the *full master list* only if filterZeroVolume is FALSE
    if (!filterZeroVolume) {
      console.log('[Server Action] filterZeroVolume is false, adding back keywords missed/not processed as zero volume.');
      initialUniqueKeywords.forEach(keywordText => {
        if (!keywordText) return;
        const normalizedText = keywordText.toLowerCase().replace(/\s+/g, '');
        // Add IF it's not already in the final map 
        if (!finalKeywordMap.has(normalizedText)) {
          finalKeywordMap.set(normalizedText, {
            text: keywordText, // Keep original text from the master list
            searchVolume: 0
          });
        }
      });
    } else {
       console.log('[Server Action] filterZeroVolume is true, skipping adding back zero-volume keywords.');
    }

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
        // Decide if this should throw an error or just be logged
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

    // After saving keywords (or if none), revalidate the specific item cache
    if (savedResearchId) {
      await revalidateKeywordResearchCache(savedResearchId);
      console.log(
        `[Server Action] Revalidated cache for ${savedResearchId} after keyword processing.`
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

    // Attempt to revalidate cache even on failure if we have an ID
    if (savedResearchId) {
      try {
        await revalidateKeywordResearchCache(savedResearchId);
        console.log(
          `[Server Action] Revalidated cache for ${savedResearchId} after process error.`
        );
      } catch (revalError) {
        console.error(
          `[Server Action] Failed to revalidate cache for ${savedResearchId} after process error:`,
          revalError
        );
      }
    }

    return { success: false, researchId: savedResearchId, error: message };
  }
}
