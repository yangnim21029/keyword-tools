'use server';

import {
  getUrlSuggestions,
  performFetchKeywordSuggestions
} from '@/app/actions';
import { aiGetDifferenceEntityName } from '@/app/services/ai-keyword-patch';
import { getSearchVolume } from '@/app/services/keyword-idea-api.service';
// Import types from the centralized types file
import type {
  KeywordVolumeItem,
  KeywordVolumeObject
} from '@/app/services/firebase/schema';
// Import the base schema for list items

import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import { Timestamp } from 'firebase-admin/firestore';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getKeywordVolumeObj } from '../services/firebase/data-keyword-volume';

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
const KEYWORD_VOLUME_LIST_TAG = 'getKeywordVolumeList';

// --- Zod Schemas ---
const KeywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().nullable().optional(),
  competition: z.number().nullable().optional(),
  competitionIndex: z.number().nullable().optional(),
  cpc: z.number().nullable().optional()
});

const AiClusterItemSchema = z.object({
  name: z.string(),
  totalVolume: z.number(),
  keywords: z.array(KeywordVolumeItemSchema)
});

const KeywordVolumeObjectSchema = z.object({
  query: z.string(),
  region: z.string(),
  language: z.string(),
  searchEngine: z.string().optional().default('google'),
  tags: z.array(z.string()),
  keywords: z.array(KeywordVolumeItemSchema),
  clustersWithVolume: z.array(AiClusterItemSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  totalVolume: z.number(),
  userId: z.string().optional(),
  isFavorite: z.boolean().optional().default(false)
});


type FirestoreKeywordVolumeObject = Omit<
  z.infer<typeof KeywordVolumeObjectSchema>,
  'createdAt' | 'updatedAt'
> & {
  createdAt: Timestamp;
  updatedAt: Timestamp;
};


// Regex to check if the string consists *only* of CJK characters (and potentially spaces, handled later)
const onlyCjkRegex = /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]+$/;

// Helper function to generate spaced variations for CJK keywords
// (Made private - only used internally)
function generateSpacedVariations(uniqueBaseKeywords: string[]): string[] {
  const spacedVariations: string[] = [];
  for (const keyword of uniqueBaseKeywords) {
    if (
      onlyCjkRegex.test(keyword) &&
      keyword.length > 1 &&
      keyword.length <= 10 &&
      !keyword.includes(' ')
    ) {
      spacedVariations.push(keyword.split('').join(' '));
    }
  }
  return spacedVariations;
}


function validatedDataToFirestore(
  data: z.infer<typeof KeywordVolumeObjectSchema>
): FirestoreKeywordVolumeObject {
  // Convert Dates to Timestamps
  return {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
    updatedAt: Timestamp.fromDate(data.updatedAt)
  };
}

// Add this helper function near the top or within the DB section
function _calculateTotalVolume(
  keywords: KeywordVolumeItem[] | undefined | null
): number {
  if (!keywords || !Array.isArray(keywords)) {
    return 0;
  }
  return keywords.reduce((sum, kw) => sum + (kw.searchVolume ?? 0), 0);
}

// 删除 Keyword Volume Object
export async function submitDeleteKeywordVolumeObj({
  researchId
}: {
  researchId: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log(`[Action] Client requested delete for research: ${researchId}`);
  if (!researchId) return { success: false, error: 'Research ID is required' };

  if (!db) throw new Error('Database not initialized');
  if (!researchId) throw new Error('Research ID is required for deletion');
  console.log(`[Action] Deleting keyword research entry: ${researchId}`);
  try {
    await db.collection(COLLECTIONS.KEYWORD_VOLUME).doc(researchId).delete();
    console.log(`[Action] Successfully deleted entry: ${researchId}`);
    // Revalidation handled by the calling user-facing action
    revalidateTag(KEYWORD_VOLUME_LIST_TAG);
    return { success: true };
  } catch (error) {
    console.error(
      `[Action] Error deleting keyword research entry ${researchId}:`,
      error
    );
    throw new Error(
      `Failed to delete keyword research entry ${researchId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Process and Save Keyword Query (remains the same for now) ---
export async function submitCreateKeywordVolumeObj({
  query,
  region,
  language,
  filterZeroVolume,
  useAlphabet,
  useSymbols
}: ProcessQueryInput): Promise<ProcessQueryResult> {
  let aiSuggestList: string[] = [];
  let googleSuggestList: string[] = [];
  let suggestionsResult;

  const isUrl = query.startsWith('https://');

  try {
    aiSuggestList = await aiGetDifferenceEntityName(
      query,
      region,
      language,
      10
    );

    // get google suggestions 自製取 url 尾端的關鍵字去找數據
    if (isUrl) {
      suggestionsResult = await getUrlSuggestions({
        url: query,
        region,
        language
      });
    }

    if (!isUrl) {
      suggestionsResult = await performFetchKeywordSuggestions({
        query,
        region,
        language,
        useAlphabet,
        useSymbols
      });
    }

    if (
      suggestionsResult &&
      (suggestionsResult.error || !suggestionsResult.suggestions)
    ) {
      console.warn(
        `[Server Action] Google Suggestion Warning: ${
          suggestionsResult.error || 'No suggestions found'
        }`
      );
      googleSuggestList = [];
    }
  } catch (error) {
    console.error('[Action] Error creating keyword research entry:', error);
    throw new Error(
      `Failed to create keyword research entry: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // 合併關鍵字 獲取關鍵字數據
  const keywordsForVolumeCheck = [
    ...new Set([...generateSpacedVariations([query.trim()]), ...aiSuggestList, ...googleSuggestList])
  ].slice(0, MAX_VOLUME_CHECK_KEYWORDS);

  const volumeResult = await getSearchVolume({
    keywords: keywordsForVolumeCheck,
    region: region,
    language: language,
    filterZeroVolume: filterZeroVolume
  });

  // Validate data using Zod with the original volumeResult
  const validationResult = KeywordVolumeObjectSchema.safeParse({
    query: query,
    region: region,
    language: language,
    searchEngine: 'google',
    tags: [],
    keywords: volumeResult || [], // Use original volumeResult
    clustersWithVolume: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    totalVolume: _calculateTotalVolume(volumeResult || []), // Use original volumeResult
    isFavorite: false
  });

  if (!validationResult.success) {
    console.error(
      '[Action] Zod validation failed:',
      validationResult.error.errors
    );
    return {
      success: false,
      researchId: null,
      error: `Validation failed: ${validationResult.error.errors
        .map(e => `${e.path.join('.')} (${e.message})`)
        .join(', ')}`
    };
  }

  // Convert undefined values to null before Firestore conversion
  const validatedData = validationResult.data;
  if (validatedData.keywords) {
    validatedData.keywords = validatedData.keywords.map(kw => ({
      ...kw,
      searchVolume: kw.searchVolume === undefined ? null : kw.searchVolume,
      competition: kw.competition === undefined ? null : kw.competition,
      competitionIndex:
        kw.competitionIndex === undefined ? null : kw.competitionIndex,
      cpc: kw.cpc === undefined ? null : kw.cpc
    }));
  }

  // Convert validated data (with nulls instead of undefined) for Firestore
  const validatedDataForFirestore = validatedDataToFirestore(
    validatedData // Pass the modified data
  );

  if (!db) throw new Error('Database not initialized');
  console.log('[Action] Creating new keyword research entry...');
  try {
    const docRef = await db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      .add(validatedDataForFirestore);
    console.log(
      `[Action] Successfully created entry with ID: ${docRef.id}, Total Volume: ${validatedDataForFirestore.totalVolume}`
    );
    revalidateTag(KEYWORD_VOLUME_LIST_TAG);
    revalidatePath('/keyword-volume');
    return { success: true, researchId: docRef.id, error: null };
  } catch (error) {
    console.error('[Action] Error creating keyword research entry:', error);
    throw new Error(
      `Failed to create keyword research entry: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Updates an existing keyword research document in Firestore.
 */
export async function submitUpdateKeywordVolumeObj(
  researchId: string,
  input: Partial<KeywordVolumeObject>
): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!researchId) throw new Error('Research ID is required for update');

  console.log(`[Action] Updating keyword research entry: ${researchId}`);
  try {
    const dataToUpdate = { ...input, updatedAt: Timestamp.now() };
    await db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      .doc(researchId)
      .update(dataToUpdate); // Firestore update method handles partial updates

    console.log(`[Action] Successfully updated entry: ${researchId}`);
    return true;
  } catch (error) {
    console.error(
      `[Action] Error updating keyword research entry ${researchId}:`,
      error
    );
    throw new Error(
      `Failed to update keyword research entry ${researchId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function submitGetKeywordVolumeObj({
  researchId
}: {
  researchId: string;
}): Promise<KeywordVolumeObject | null> {
  const keywordVolumeObj = await getKeywordVolumeObj({ researchId });
  return keywordVolumeObj;
}
