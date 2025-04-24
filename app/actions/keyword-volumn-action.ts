'use server';

import { getKeywordSuggestions, getUrlSuggestions } from '@/app/actions';
import { generateRelatedKeywordsAI } from '@/app/services/ai-keyword-patch';
import {
  createKeywordResearchEntry,
  deleteKeywordResearchEntry,
  getKeywordResearchSummaryList,
  updateKeywordResearchEntry,
  updateKeywordResearchResults,
  getKeywordResearchDetail,
} from '@/app/services/firebase/db-keyword-research';
import { getSearchVolume } from '@/app/services/keyword-idea-api.service';
// Import types from the centralized types file
import type { 
  KeywordResearchItem, 
  KeywordVolumeItem, 
  UpdateClustersInput, 
  UpdateKeywordResearchInput, 
} from '@/app/services/firebase/types'; 

import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, revalidateTag } from 'next/cache';
// --- Import the Chinese type detection utility ---
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
// --- Re-add Import for the persona generation action --- 
import { generateUserPersonaFromClusters } from './persona-for-writing';


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

// --- Consolidated Revalidation Action --- 

/**
 * Server action dedicated to revalidating keyword research cache tags and paths.
 * Can be safely called from client components after an operation completes.
 * @param researchId Optional ID for revalidating a specific item.
 */
export async function revalidateKeywordResearch(
  researchId?: string
): Promise<void> {
  revalidateTag(KEYWORD_RESEARCH_TAG);
  if (researchId) {
    const itemPath = `/keyword-mapping/${researchId}`;
    const detailTag = `${KEYWORD_RESEARCH_TAG}_${researchId}`; 
    revalidateTag(detailTag);
    revalidatePath(itemPath); 
    console.log(`[Revalidation Action] Revalidated: ${detailTag} and path: ${itemPath}.`);
  } else {
    console.log(`[Revalidation Action] Revalidated list tag: ${KEYWORD_RESEARCH_TAG}`);
  }
}

// 删除 Keyword Research
export async function requestDeleteKeywordResearch(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action] Attempting to delete research: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };

  try {
    const success = await deleteKeywordResearchEntry(researchId);
    if (success) {
      await revalidateKeywordResearch(researchId);
      console.log(`[Action] Successfully deleted research: ${researchId} and revalidated cache.`);
      return { success: true };
    } else {
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

// --- Process and Save Keyword Query (remains the same for now) ---
export async function requestNewKeywordResearch(
  input: ProcessQueryInput
): Promise<ProcessQueryResult> {
  console.log('[Action: processAndSave] Received input:', input);
  
  const { query, region, language, filterZeroVolume } = input;

  const useAlphabet = false;
  const useSymbols = true;

  let aiSuggestList: string[] = [];
  let googleSuggestList: string[] = [];
  let volumeDataList: KeywordVolumeItem[] = [];
  let savedResearchId: string | null = null;
  const isUrl = query.startsWith('http');
  const currentInputType = isUrl ? 'url' : 'keyword';

  try {
    console.log(
      '[Server Action] Step 2: Space Variations Generation Disabled.'
    );

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

    console.log(
      `[Server Action] Starting Step 4: Get Google Suggestions for: ${query}`
    );
    let suggestionsResult;
    if (currentInputType === 'keyword') {
      console.log(`[Action: processAndSave] >>> Calling getKeywordSuggestions with useSymbols: ${useSymbols}`);
      suggestionsResult = await getKeywordSuggestions({
        query,
        region,
        language,
        useAlphabet,
        useSymbols  
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

    console.log('[Server Action] Starting Step 5: Combine All & Deduplicate');
    const allCombinedSources = [...aiSuggestList, ...googleSuggestList];
    if (query.trim() && !allCombinedSources.includes(query.trim())) {
      allCombinedSources.unshift(query.trim());
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
      const createdResearchId = await createKeywordResearchEntry({
        query,
        region,
        language,
        isFavorite: false,
        tags: [],
        keywords: [],
        clusters: {},
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      if (!createdResearchId) {
        console.error('[Server Action] Failed to create empty record.');
        return { success: false, researchId: null, error: 'Failed to create empty record.' };
      }
      return { success: true, researchId: createdResearchId, error: null };
    }

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

    if (keywordsForVolumeCheck.length < MAX_VOLUME_CHECK_KEYWORDS) {
      console.log(
        '[Server Action] Filling remaining slots with other unique keywords...'
      );
      initialUniqueKeywords.forEach(addPrioritized);
    }

    console.log(
      `[Server Action] Final list for volume check (${keywordsForVolumeCheck.length} keywords):`
    );

    const volumeResult = await getSearchVolume(
      keywordsForVolumeCheck,
      region,
      isUrl ? query : undefined,
      language
    );

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
    }

    console.log(
      `[Server Action] Starting Step 8: Filter & Finalize Keyword List (Filter Zero Volume: ${filterZeroVolume})`
    );
    const finalKeywordMap = new Map<string, KeywordVolumeItem>();

    const processedVolumeKeywords = new Set<string>();
    volumeDataList.forEach((item: KeywordVolumeItem) => {
      if (!item.text) return;
      const normalizedText = item.text.toLowerCase().replace(/\s+/g, '');
      processedVolumeKeywords.add(normalizedText);

      const currentVolume = item.searchVolume ?? 0;
      const shouldKeep = filterZeroVolume ? currentVolume > 0 : currentVolume >= 0;

      if (shouldKeep) {
        const existing = finalKeywordMap.get(normalizedText);
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

    if (!filterZeroVolume) {
      console.log('[Server Action] filterZeroVolume is false, adding back keywords missed/not processed as zero volume.');
      initialUniqueKeywords.forEach(keywordText => {
        if (!keywordText) return;
        const normalizedText = keywordText.toLowerCase().replace(/\s+/g, '');
        if (!finalKeywordMap.has(normalizedText)) {
          finalKeywordMap.set(normalizedText, {
            text: keywordText,
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

    try {
      console.log('[Action: processAndSave] Starting Step 9: Save Results');
      const now = Timestamp.now();
      const researchDataToCreate: Omit<KeywordResearchItem, 'id'> & { createdAt: Timestamp, updatedAt: Timestamp } = {
        query: query,
        region: region ?? '',
        language: language ?? '',
        searchEngine: 'google',
        device: 'desktop',
        isFavorite: false,
        tags: [],
        keywords: [],
        clusters: {},
        createdAt: now,
        updatedAt: now,
      };

      savedResearchId = await createKeywordResearchEntry(researchDataToCreate);
      console.log(`[Action: processAndSave] Research record created via DB service: ${savedResearchId}`);

      if (finalKeywordsToSave.length > 0) {
        console.log(
          `[Server Action] Updating record ${savedResearchId} with ${finalKeywordsToSave.length} final keywords...`
        );
        const updateKeywordsResult = await updateKeywordResearchResults(
          savedResearchId,
          finalKeywordsToSave
        );
        if (!updateKeywordsResult) {
          console.error(
            `[Action: processAndSave] Failed to update keywords for ${savedResearchId}`
          );
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

      if (savedResearchId) {
        await revalidateKeywordResearch(savedResearchId);
        console.log(
          `[Action: processAndSave] Revalidated cache for ${savedResearchId} after processing.`
        );
      }

      console.log(
        `[Action: processAndSave] Process completed successfully for ${savedResearchId}.`
      );
      return { success: true, researchId: savedResearchId, error: null };

    } catch (error: unknown) {
      console.error(
        '[Action: processAndSave] Critical error during final save/update steps:',
        error
      );
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during processing.';

      if (savedResearchId) {
        try {
          await revalidateKeywordResearch(savedResearchId);
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

      return { success: false, researchId: savedResearchId, error: message };
    }
  } catch (error: unknown) {
    console.error(
      '[Server Action] Critical error in requestNewKeywordResearch:',
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred during processing.';

    if (savedResearchId) {
      try {
        await revalidateKeywordResearch(savedResearchId);
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

export async function fetchKeywordResearchSummaryList(limit: number, region?: string) {
  return getKeywordResearchSummaryList(limit, region);
}

export async  function fetchKeywordResearchDetail(researchId: string) {
  return getKeywordResearchDetail(researchId);
}