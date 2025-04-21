'use server';

import { getKeywordSuggestions, getUrlSuggestions } from '@/app/actions';
import { generateRelatedKeywordsAI } from '@/app/services/ai-keyword-patch';
import {
  createKeywordResearchEntry,
  deleteKeywordResearchEntry,
  findAndRemoveDuplicateEntries,
  getKeywordResearchDetail,
  getKeywordResearchSummaryList,
  updateKeywordResearchClusters as updateKeywordResearchClustersDb,
  updateKeywordResearchEntry,
  updateKeywordResearchResults,
  type KeywordResearchSummaryItem
} from '@/app/services/firebase/db-keyword-research';
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
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
// --- Import the Chinese type detection utility ---
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

// --- Define a new type for the transformed item --- 
// It extends the base item but overrides the clusters property
type KeywordResearchItemWithArrayClusters = Omit<KeywordResearchItem, 'clusters'> & {
  clusters: Array<{
      clusterName: string;
      keywords: KeywordVolumeItem[];
      totalVolume?: number; 
  }> | null; // Explicitly define the expected array structure
};
// --- End New Type Definition --- 

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
      `[Action Cache Miss] Fetching keyword research SUMMARY list: userId=${userId}, limit=${limit}, filters=${JSON.stringify(
        filters
      )}`
    );
    // Directly call the DB function
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

// --- Fetch Detail Action (Refactored Cache Wrapper) ---
const getCachedKeywordResearchDetail = unstable_cache(
  async (researchId: string): Promise<KeywordResearchItem | null> => {
    // Direct fetch logic moved here
    console.log(`[Action Cache Miss] Fetching detail for researchId: ${researchId}`);
    if (!researchId) return null;

    try {
      // Call the DB service function directly
      const detail = await getKeywordResearchDetail(researchId);
      // DB service now handles timestamp conversion
      return detail;
    } catch (error) {
        console.error(`[Action Cache Miss] Error fetching detail from DB for ${researchId}:`, error);
        // Return null or rethrow based on how caching should handle DB errors
        return null;
    }
  },
  // Key Parts: Base + researchId makes the cache key unique per item
  ['keywordResearchDetail'], // Base key part remains
  {
    // Revert to static tags - revalidation will handle invalidation
    tags: [KEYWORD_RESEARCH_TAG],
  }
);

// 获取特定 Keyword Research 详情 (Uses cached function again)
// Update the return type to use the new internal type
export async function fetchKeywordResearchDetail(
  researchId: string
): Promise<KeywordResearchItemWithArrayClusters | null> { // <-- Updated return type
  try {
    console.log(
      `[Server Action] Attempting to fetch detail via cache for: ${researchId}`
    );
    // Fetch using the original type internally
    const detail = await getCachedKeywordResearchDetail(researchId);

    if (!detail) {
      return null;
    }

    // --- Add Transformation Logic Here --- 
    let transformedClustersArray: KeywordResearchItemWithArrayClusters['clusters'] = null; 

    if (detail.clusters) {
      if (!Array.isArray(detail.clusters)) {
        // If clusters is an object (old format), transform it
        console.log(`[Action ${researchId}] Transforming clusters from object format to array format.`);
        try {
          transformedClustersArray = Object.entries(detail.clusters as Record<string, any>).map(([clusterName, keywordsData]) => {
            let keywordsArray: KeywordVolumeItem[] = [];
            if (Array.isArray(keywordsData)) {
              keywordsArray = keywordsData.map((kw: any) => {
                 if (typeof kw === 'string') {
                   return { text: kw, searchVolume: null, competition: null, competitionIndex: null, cpc: null };
                 } else if (typeof kw === 'object' && kw !== null && kw.text) {
                   return {
                      text: kw.text,
                      searchVolume: kw.searchVolume ?? null,
                      competition: kw.competition ?? null,
                      competitionIndex: kw.competitionIndex ?? null,
                      cpc: kw.cpc ?? null
                   };
                 } else {
                   return { text: JSON.stringify(kw), searchVolume: null, competition: null, competitionIndex: null, cpc: null };
                 }
              });
            }
            const totalVolume = keywordsArray.reduce((sum, kw) => sum + (kw.searchVolume ?? 0), 0);
            return {
              clusterName: clusterName,
              keywords: keywordsArray,
              totalVolume: totalVolume
            };
          });
        } catch (transformError) {
            console.error(`[Action ${researchId}] Failed to transform clusters object:`, transformError);
            transformedClustersArray = null; // Set to null on error
        }
      } else {
        // Clusters field exists and is already an array - ensure totalVolume exists
        console.log(`[Action ${researchId}] Clusters field is already an array. Ensuring totalVolume exists.`);
        transformedClustersArray = detail.clusters.map((cluster: any) => {
           if (typeof cluster.totalVolume !== 'number' && Array.isArray(cluster.keywords)) {
              const calculatedVolume = cluster.keywords.reduce((sum: number, kw: any) => sum + (kw?.searchVolume ?? 0), 0);
              return { ...cluster, totalVolume: calculatedVolume };
           } 
           return cluster; 
        });
      }
    } else {
      console.log(`[Action ${researchId}] No clusters found in detail object.`);
      transformedClustersArray = null;
    }
    // --- End Transformation Logic ---

    // Construct the final object conforming to the new return type
    const result: KeywordResearchItemWithArrayClusters = {
        ...detail, // Spread properties from original detail
        clusters: transformedClustersArray // Assign the correctly typed transformed clusters
    };

    return result; // No need to cast 'any' anymore

  } catch (error) {
    console.error(`獲取詳情 (${researchId}) 失敗:`, error);
    return null;
  }
}

// 删除 Keyword Research
export async function deleteKeywordResearch(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action] Attempting to delete research: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };

  try {
    // Call the DB service function
    const success = await deleteKeywordResearchEntry(researchId);
    if (success) {
      await revalidateKeywordResearchCache(researchId); // Use exported helper
      console.log(`[Action] Successfully deleted research: ${researchId} and revalidated cache.`);
      return { success: true };
    } else {
      // This path might not be reached if DB function throws on failure
      console.warn(`[Action] DB function reported failure deleting ${researchId}, but did not throw.`);
      return { success: false, error: 'Failed to delete research record (DB)' };
    }
  } catch (error) {
    console.error(`刪除 (${researchId}) 失敗:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete'
    };
  }
}

// --- NEW: Remove Duplicate Keyword Research Entries ---
/**
 * Removes duplicate keyword research entries based on query, language, and region.
 * Keeps the newest entry for each unique combination.
 */
export async function removeDuplicateKeywordResearch(): Promise<{
  success: boolean;
  removedCount?: number;
  error?: string;
}> {
  console.log('[Action] Starting duplicate keyword research removal process...');
  try {
    // Call the DB service function
    const removedCount = await findAndRemoveDuplicateEntries();

    console.log(`[Action] Duplicate removal completed by DB service. Total removed: ${removedCount}`);

    // Revalidate the list cache if any items were removed
    if (removedCount > 0) {
      await revalidateKeywordResearchCache(); // Revalidate list only
      console.log('[Action] Revalidated keyword research list cache.');
    }

    return { success: true, removedCount };

  } catch (error) {
    console.error('[Action] Error removing duplicate keyword research entries:', error);
    return {
      success: false,
      removedCount: 0,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to remove duplicate entries.'
    };
  }
}
// --- End NEW Action ---

// 创建 Keyword Research
export async function createKeywordResearch(
  input: CreateKeywordResearchInput
): Promise<{ researchId: string | null; error: string | null }> {
  console.log('[Action] Attempting to create keyword research...');

  // TODO: Add Zod validation here if desired
  // Note: input type only guarantees fields like query, location?, language?, etc.
  // We need to provide defaults for other KeywordResearchItem fields.

  try {
    const now = Timestamp.now();
    // Construct the data to save explicitly.
    // Pull available fields from input, provide defaults for the rest.
    // Prepare the full data object expected by the DB service function
    const dataToSave: Omit<KeywordResearchItem, 'id'> & { createdAt: Timestamp, updatedAt: Timestamp } = {
      query: input.query, // Mandatory from CreateKeywordResearchInput
      region: input.region ?? '', // Optional from input
      language: input.language ?? '', // Optional from input
      searchEngine: input.searchEngine ?? 'google', // Optional from input
      device: input.device ?? 'desktop', // Optional from input
      isFavorite: input.isFavorite ?? false, // Optional from input
      tags: input.tags ?? [], // Optional from input
      // --- Fields NOT in CreateKeywordResearchInput, provide defaults ---
      keywords: [], // Default empty array
      clusters: {}, // Default empty object
      personas: [], // CORRECT: Initialize as empty array
      // ---------------------------------------------------------------
      createdAt: now,
      updatedAt: now,
    };

    // Call the DB service function
    const newResearchId = await createKeywordResearchEntry(dataToSave);

    console.log(`[Action] Successfully created research record with ID: ${newResearchId}`);
    await revalidateKeywordResearchCache(); // Revalidate list cache

    // Return only the ID and success status
    return {
      researchId: newResearchId,
      error: null
    };
  } catch (error) {
    console.error('創建 Keyword Research 失敗:', error);
    return {
      researchId: null,
      error: error instanceof Error ? error.message : 'Failed to create research record'
    };
  }
}

// 更新 Keyword Research (通用)
export async function updateKeywordResearch(
  researchId: string,
  input: UpdateKeywordResearchInput
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action] Attempting to update research: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };
  if (Object.keys(input).length === 0) {
    console.log(`[Action] Update called with empty input for ${researchId}, skipping DB call.`);
    // Optionally still revalidate if timestamp update is desired implicitly
    // await revalidateKeywordResearchCache(researchId);
    // return { success: true }; // Or return error? Let's return error.
    return { success: false, error: 'No update data provided' };
  }

  try {
    // Call the DB service function
    const success = await updateKeywordResearchEntry(researchId, input);

    if (success) {
      console.log(`[Action] Successfully updated research: ${researchId}`);
      await revalidateKeywordResearchCache(researchId); // Revalidate on success
      return { success: true };
    } else {
      // This path might not be reached if DB function throws on failure
      console.warn(`[Action] DB function reported failure updating ${researchId}, but did not throw.`);
      return { success: false, error: 'Failed to update research record (DB)' };
    }
  } catch (error) {
    console.error(`更新 (${researchId}) 失敗:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update research record'
    };
  }
}

// --- Specific Update Actions (Clusters, Personas, Keywords) ---

// 更新 Clusters
export async function updateKeywordResearchClusters(
  researchId: string,
  input: UpdateClustersInput
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action] Attempting to update clusters for: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };

  // --- Add Logging --- 
  console.log(`[Action - Debug] Received clusters input for ${researchId}:`, JSON.stringify(input.clusters, null, 2));
  // --- End Logging --- 

  try {
    // Call the specific DB service function (already existed, check name)
    const success = await updateKeywordResearchClustersDb(researchId, input.clusters);

    if (success) {
       console.log(`[Action] Successfully updated clusters for: ${researchId}`);
       // Revalidation is handled by the caller (requestClustering)
      return { success: true };
    } else {
      console.warn(`[Action] DB function failed to update clusters for ${researchId}.`);
      return { success: false, error: 'Failed to update clusters (DB)' };
    }
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
  console.log(`[Action] Attempting to update keywords for: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };

  // TODO: Add validation for the structure of each Keyword in the array using a Zod schema if needed

  try {
    // Call the specific DB service function (already existed, check name: updateKeywordResearchResults)
    const success = await updateKeywordResearchResults(researchId, keywords);
    if (success) {
      // Revalidation should be handled by the calling action if needed
      // await revalidateKeywordResearchCache(researchId);
      console.log(`[Action] Successfully updated keywords for: ${researchId}`);
      // Revalidation might be needed here or handled by caller (processAndSave)
      // Let's assume caller handles it for now.
      return { success: true };
    } else {
      console.warn(`[Action] DB function failed to update keywords for ${researchId}.`);
      return {
        success: false,
        error: 'Failed to update keywords via DB service'
      };
    }
  } catch (error) {
    // Catch errors from the service function call itself
    console.error(`[Action] Error updating keywords for ${researchId}:`, error);
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
  const { query, region, language, filterZeroVolume } = input;

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
      if (createResult.error || !createResult.researchId)
        throw new Error(createResult.error || 'Failed to create empty record');
      return {
        success: true,
        researchId: createResult.researchId,
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

    // --- Step 9: Save (Refactored) ---
    try { // Wrap final save steps in try/catch

      // --- Step 9: Save (Refactored) ---
      console.log('[Action: processAndSave] Starting Step 9: Save Results');
      const now = Timestamp.now();
      // Prepare data for the *new* DB creation function
       const researchDataToCreate: Omit<KeywordResearchItem, 'id'> & { createdAt: Timestamp, updatedAt: Timestamp } = {
        query: query,
        region: region ?? '',
        language: language ?? '',
        // Add other required fields with defaults
        searchEngine: 'google',
        device: 'desktop',
        isFavorite: false,
        tags: [],
        keywords: [], // Will be updated shortly
        clusters: {},
        personas: [],
        createdAt: now,
        updatedAt: now,
      };

      // Call the NEW DB service function to create the entry
      savedResearchId = await createKeywordResearchEntry(researchDataToCreate);
      console.log(`[Action: processAndSave] Research record created via DB service: ${savedResearchId}`);

      // Update record with the final keyword list
      if (finalKeywordsToSave.length > 0) {
        console.log(
          `[Server Action] Updating record ${savedResearchId} with ${finalKeywordsToSave.length} final keywords...`
        );
        // Call the action which in turn calls the specific DB update function
        const updateKeywordsResult = await updateKeywordResearchKeywords(
          savedResearchId,
          finalKeywordsToSave
        );
        if (!updateKeywordsResult.success) {
          // Log error but don't necessarily fail the whole process?
          console.error(
            `[Action: processAndSave] Failed to update keywords for ${savedResearchId}:`,
            updateKeywordsResult.error
          );
          // Maybe throw here if keywords are critical?
          // throw new Error(`Failed to save keywords: ${updateKeywordsResult.error}`);
        } else {
          console.log(
            `[Action: processAndSave] Successfully updated keywords for ${savedResearchId}`
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
          `[Action: processAndSave] Revalidated cache for ${savedResearchId} after processing.`
        );
      }

      console.log(
        `[Action: processAndSave] Process completed successfully for ${savedResearchId}.`
      );
      return { success: true, researchId: savedResearchId, error: null };

    } catch (error: unknown) { // Catch errors during save/update/revalidate
      console.error(
        '[Action: processAndSave] Critical error during final save/update steps:',
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
            `[Action: processAndSave] Revalidated cache for ${savedResearchId} after process error.`
          );
        } catch (revalError) {
          console.error(
            `[Action: processAndSave] Failed to revalidate cache for ${savedResearchId} after process error:`,
            revalError
          );
        }
      }

      // Return failure, include ID if creation succeeded but update/revalidate failed
      return { success: false, researchId: savedResearchId, error: message };
    }
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
