'use server';

import { COLLECTIONS, db } from '@/app/services/firebase/db-config'; // <--
// --- Import new constants from global-config ---
import {
  DEFAULT_SERP_ANALYSIS_MODEL,
  SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT
} from '@/app/global-config';

import {
  // DB Read functions
  findSerpResultObjects,
  // Prompt functions moved to data-serp-result
  getBetterHaveConversionPrompt,
  getBetterHaveInArticlePrompt,
  getBetterHaveRecommendationPrompt,
  getContentTypeAnalysisPrompt,
  getContentTypeConversionPrompt,
  getContentTypeRecommendationPrompt,
  getSerpResultById,
  getSerpTitleAnalysisPrompt,
  getTitleRecommendationPrompt,
  getUserIntentAnalysisPrompt,
  getUserIntentConversionPrompt,
  getUserIntentRecommendationPrompt
} from '@/app/services/firebase/data-serp-result';
import {
  // Import Zod schemas directly from schema.ts for AI validation
  AiContentTypeAnalysisJsonSchema,
  AiSerpBetterHaveJsonSchema,
  AiTitleAnalysisJsonSchema,
  AiUserIntentAnalysisJsonSchema,
  // Import the main SERP object type
  FirebaseSerpResultObject
} from '@/app/services/firebase/schema';
import { fetchSerpByKeyword } from '@/app/services/serp.service';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { FieldValue } from 'firebase-admin/firestore'; // Import Timestamp
import { revalidateTag } from 'next/cache';

const SERP_DATA_LIST_TAG = 'serpDataList';

export async function submitCreateSerp({
  query,
  region,
  language
}: {
  query: string;
  region: string;
  language: string;
}): Promise<{ success: boolean; error?: string; id?: string; originalKeyword?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  try {
    // 1. Try to find existing data using the read function
    // findSerpResultObjects now returns FirebaseSerpResultObject | null
    const existingData = await findSerpResultObjects({
      query,
      region,
      language
    });
    if (existingData) {
      console.log(
        `[Action: Create/Fetch] Found existing SERP data in DB: ${existingData.id}`
      );
      if (!existingData.id || typeof existingData.originalKeyword !== 'string') {
         console.error('[Action: Create/Fetch] Existing data is missing ID or originalKeyword', existingData);
         return { success: false, error: 'Found existing SERP data but it is missing required fields (id or originalKeyword).' };
      }
      return { success: true, id: existingData.id, originalKeyword: existingData.originalKeyword };
    }

    // 2. Not found, fetch from external service
    console.log(
      `[Action: Create/Fetch] Fetching from SERP service for ${query} (R: ${region}, L: ${language})...`
    );
    let fetchedData;
    try {
      fetchedData = await fetchSerpByKeyword({ query, region, language });
    } catch (fetchError) {
      console.error(
        `[Action: Create/Fetch] Error fetching from SERP service for ${query}:`,
        fetchError
      );
      throw new Error(
        `Failed to fetch data from SERP service: ${
          fetchError instanceof Error ? fetchError.message : String(fetchError)
        }`
      ); // Re-throw to be caught by outer catch
    }

    if (!fetchedData) {
      // This case handles if fetchSerpByKeyword resolves successfully but returns null/undefined
      console.error(
        `[Action: Create/Fetch] SERP service returned no data for ${query}.`
      );
      throw new Error('SERP service returned no data.');
    }
    console.log(
      `[Action: Create/Fetch] Successfully fetched data from SERP service for ${query}.`
    );

    // 3. Prepare data for saving
    // Target type is FirebaseSerpResultObject, but without id/timestamps initially
    const dataToSave: Omit<
      FirebaseSerpResultObject,
      'id' | 'createdAt' | 'updatedAt'
    > = {
      // Spread fetched data (matches schema closely now)
      ...fetchedData,
      // Explicitly set required fields
      originalKeyword: query,
      normalizedKeyword: query, // Keep normalized for potential future use
      region: region,
      language: language,
      // Overwrite/Map specific fields if needed (e.g., ensure arrays)
      relatedQueries: fetchedData.relatedQueries?.filter(q => q) ?? [], // Keep filter
      paidResults: fetchedData.paidResults ?? [],
      paidProducts: fetchedData.paidProducts ?? [],
      peopleAlsoAsk: fetchedData.peopleAlsoAsk?.filter(paa => paa) ?? [], // Keep filter
      // Keep mapping for organic results for stricter validation/structure
      organicResults:
        fetchedData.organicResults
          ?.filter(
            org =>
              org &&
              org.position != null &&
              org.title != null &&
              org.url != null
          )
          .map(org => ({
            position: org!.position!,
            title: org!.title!,
            url: org!.url!,
            description: org!.description ?? undefined,
            displayedUrl: org!.displayedUrl ?? undefined,
            emphasizedKeywords: org!.emphasizedKeywords ?? [],
            siteLinks:
              org!.siteLinks?.map(link => ({
                title: link.title ?? null,
                url: link.url ?? null,
                description: link.description ?? null
              })) ?? [],
            productInfo: org!.productInfo ?? null,
            type: org!.type ?? null,
            date: org!.date ?? null,
            views: org!.views ?? null,
            lastUpdated: org!.lastUpdated ?? null,
            commentsAmount: org!.commentsAmount ?? null,
            followersAmount: org!.followersAmount ?? null,
            likes: org!.likes ?? null,
            channelName: org!.channelName ?? null
          })) ?? [],
      contentTypeAnalysis: null,
      contentTypeAnalysisText: null,
      userIntentAnalysis: null,
      userIntentAnalysisText: null,
      titleAnalysis: null,
      betterHaveAnalysis: null,
      betterHaveAnalysisText: null,
      urlOutline: null
    };

    // 4. Save directly using db access (no converter)
    console.log(
      `[Action: Create/Fetch] Preparing to save data for ${query} to Firestore...`
    );
    const collectionRef = db.collection(COLLECTIONS.SERP_RESULT);
    const dataWithTimestamp = {
      ...dataToSave,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    let newDocRef;
    try {
      newDocRef = await collectionRef.add(dataWithTimestamp);
    } catch (saveError) {
      console.error(
        `[Action: Create/Fetch] Error saving data to Firestore for ${query}:`,
        saveError
      );
      throw new Error(
        `Failed to save data to Firestore: ${
          saveError instanceof Error ? saveError.message : String(saveError)
        }`
      ); // Re-throw
    }

    const newDocId = newDocRef.id;
    console.log(
      `[Action: Create/Fetch] Successfully saved new SERP data for ${query} with ID: ${newDocId}`
    );

    // 5. Revalidate cache
    revalidateTag(SERP_DATA_LIST_TAG);

    // 6. Return success with new ID and the original query used
    console.log(
      `[Action: Create/Fetch] Returning success for newly created doc ID: ${newDocId}, Keyword: ${query}.`
    );
    return { success: true, id: newDocId, originalKeyword: query };
  } catch (error) {
    // Log the specific error message generated within the try block
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Action: Create/Fetch] Final Catch Block - Failure for ${query} (R: ${region}, L: ${language}): ${errorMessage}`,
      error // Log the full error object as well for stack trace etc.
    );
    // Return the specific error message
    return {
      success: false,
      error: `Create/Fetch failed: ${errorMessage}` // Prepend context to the specific error
    };
  }
}

/**
 * Action: Perform Content Type Analysis (Generates Text & JSON, returns recommendation).
 */
export async function submitAiAnalysisSerpContentType({
  docId,
  model = DEFAULT_SERP_ANALYSIS_MODEL
}: {
  docId: string;
  model?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: Analyze Content Type] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(
      `[Action: Analyze Content Type] Fetching data for Doc ID: ${docId}`
    );
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze Content Type] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze Content Type] Successfully fetched data.`);

    // Extract keyword after confirming serpData is not null
    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Content Type] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`
      };
    }

    // Construct required strings using the validated serpData
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (
          r: {
            title?: string | null | undefined;
            url?: string | null | undefined;
            description?: string | null | undefined;
          },
          index: number
        ) =>
          `${index + 1}. ${r.title ?? ''} (${r.url ?? ''})${
            r.description ? '\\n   ' + r.description : ''
          }`
      )
      .join('\\n\\n');

    // 1. Generate Text Analysis
    console.log(
      `[Action: Analyze Content Type] Calling AI for Text Analysis...`
    );
    const textPrompt = getContentTypeAnalysisPrompt(keyword, serpString);
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt: textPrompt
    });
    console.log(`[Action: Analyze Content Type] Text Analysis successful.`);

    // 2. Generate JSON Analysis from Text
    console.log(
      `[Action: Analyze Content Type] Calling AI for JSON Conversion...`
    );
    const conversionPrompt = getContentTypeConversionPrompt(
      analysisResultText,
      keyword // Use locally defined keyword
    );
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: AiContentTypeAnalysisJsonSchema,
      prompt: conversionPrompt
    });
    console.log(`[Action: Analyze Content Type] JSON Conversion successful.`);

    // 3. Generate Recommendation from Text
    console.log(
      `[Action: Analyze Content Type] Calling AI for Recommendation...`
    );
    const recommendationPrompt =
      getContentTypeRecommendationPrompt(analysisResultText);
    const { text: recommendationResultText } = await generateText({
      model: openai(model),
      prompt: recommendationPrompt
    });
    console.log(`[Action: Analyze Content Type] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(
      `[Action: Analyze Content Type] Updating Firestore directly...`
    );
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      contentTypeRecommendationText: recommendationResultText,
      contentTypeAnalysisText: analysisResultText,
      contentTypeAnalysis: analysisResultJson,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: Analyze Content Type] Firestore updated.`);

    // 6. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(
      `[Action: Analyze Content Type] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `Content Type Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

/**
 * Action: Perform User Intent Analysis (Generates Text & JSON, returns recommendation).
 */
export async function submitAiAnalysisSerpIntent({
  docId,
  model = DEFAULT_SERP_ANALYSIS_MODEL
}: {
  docId: string;
  model?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: Analyze User Intent] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(
      `[Action: Analyze User Intent] Fetching data for Doc ID: ${docId}`
    );
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze User Intent] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze User Intent] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze User Intent] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? '\\n   ' + r.description : ''
          }`
      )
      .join('\\n\\n');
    const relatedKeywordsRaw = (serpData.relatedQueries ?? []).join(', ');

    // 1. Generate Text Analysis
    console.log(
      `[Action: Analyze User Intent] Calling AI for Text Analysis...`
    );
    const textPrompt = getUserIntentAnalysisPrompt(
      keyword,
      serpString,
      relatedKeywordsRaw
    );
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt: textPrompt
    });
    console.log(`[Action: Analyze User Intent] Text Analysis successful.`);

    // 2. Generate JSON Analysis from Text
    console.log(
      `[Action: Analyze User Intent] Calling AI for JSON Conversion...`
    );
    const conversionPrompt = getUserIntentConversionPrompt(
      analysisResultText,
      keyword // Use locally defined keyword
    );
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: AiUserIntentAnalysisJsonSchema,
      prompt: conversionPrompt
    });
    console.log(`[Action: Analyze User Intent] JSON Conversion successful.`);

    // 3. Generate Recommendation from Text
    console.log(
      `[Action: Analyze User Intent] Calling AI for Recommendation...`
    );
    const recommendationPrompt = getUserIntentRecommendationPrompt(
      analysisResultText,
      keyword // Use locally defined keyword
    );
    const { text: recommendationResultText } = await generateText({
      model: openai(model),
      prompt: recommendationPrompt
    });
    console.log(`[Action: Analyze User Intent] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(`[Action: Analyze User Intent] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      userIntentRecommendationText: recommendationResultText,
      userIntentAnalysisText: analysisResultText,
      userIntentAnalysis: analysisResultJson,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: Analyze User Intent] Firestore updated.`);

    // 5. Revalidate Cache

    // 6. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(
      `[Action: Analyze User Intent] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `User Intent Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

/**
 * Action: Perform Title Analysis (Generates JSON, returns JSON and recommendation).
 */
export async function submitAiAnalysisSerpTitle({
  docId,
  model = DEFAULT_SERP_ANALYSIS_MODEL
}: {
  docId: string;
  model?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: Analyze Title] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(`[Action: Analyze Title] Fetching data for Doc ID: ${docId}`);
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze Title] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze Title] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Title] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? '\\n   ' + r.description : ''
          }`
      )
      .join('\\n\\n');

    // 1. Generate JSON Analysis directly
    console.log(`[Action: Analyze Title] Calling AI for JSON Analysis...`);
    const analysisPrompt = getSerpTitleAnalysisPrompt(keyword, serpString);
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: AiTitleAnalysisJsonSchema,
      prompt: analysisPrompt
    });
    console.log(`[Action: Analyze Title] JSON Analysis successful.`);

    // 2. Generate Recommendation from JSON
    console.log(`[Action: Analyze Title] Calling AI for Recommendation...`);
    const recommendationPrompt = getTitleRecommendationPrompt(
      analysisResultJson?.title ?? '',
      analysisResultJson?.analysis ?? ''
    );
    const { text: recommendationResultText } = await generateText({
      model: openai(model),
      prompt: recommendationPrompt
    });
    console.log(`[Action: Analyze Title] Recommendation generated.`);

    // 2.5 Add recommendation text *to the JSON object*
    const modifiedAnalysisJson = analysisResultJson
      ? { ...analysisResultJson }
      : null;
    if (modifiedAnalysisJson) {
      modifiedAnalysisJson.recommendationText = recommendationResultText;
    } else {
      console.warn(
        `[Action: Analyze Title] analysisResultJson is null/undefined, cannot add recommendationText for Doc ID ${docId}`
      );
    }

    // 3. Update Firestore directly
    console.log(`[Action: Analyze Title] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      titleAnalysis: modifiedAnalysisJson,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: Analyze Title] Firestore updated.`);

    // 5. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(`[Action: Analyze Title] Failed for Doc ID ${docId}:`, error);
    return {
      success: false,
      error: `Title Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

/**
 * Action: Perform Better Have Analysis (Generates Text & JSON, returns JSON and recommendation).
 */
export async function submitAiAnalysisSerpBetterHave({
  docId,
  model = DEFAULT_SERP_ANALYSIS_MODEL
}: {
  docId: string;
  model?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: Analyze Better Have] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(
      `[Action: Analyze Better Have] Fetching data for Doc ID: ${docId}`
    );
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze Better Have] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze Better Have] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Better Have] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? '\\n   ' + r.description : ''
          }`
      )
      .join('\\n\\n');
    const paaString = (serpData.peopleAlsoAsk ?? [])
      .map(q => `- ${q}`)
      .join('\\n');
    const relatedQueriesString = (serpData.relatedQueries ?? []).join(', ');
    // Handle aiOverview potentially being an object
    const aiOverviewContent =
      typeof serpData.aiOverview === 'object' && serpData.aiOverview !== null
        ? serpData.aiOverview.content
        : null;
    const aiOverviewString = aiOverviewContent ?? '';

    // 1. Generate Text Analysis (Markdown bullet list)
    console.log(
      `[Action: Analyze Better Have] Calling AI for Text Analysis...`
    );
    const textPrompt = getBetterHaveInArticlePrompt(
      keyword,
      serpString,
      paaString,
      relatedQueriesString,
      aiOverviewString
    );
    const { text: markdownAnalysisResultText } = await generateText({
      model: openai(model),
      prompt: textPrompt
    });
    console.log(`[Action: Analyze Better Have] Text Analysis successful.`);

    // 2. Generate JSON Analysis from Text
    console.log(
      `[Action: Analyze Better Have] Calling AI for JSON Conversion...`
    );
    const conversionPrompt = getBetterHaveConversionPrompt(
      markdownAnalysisResultText,
      keyword // Use locally defined keyword
    );
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: AiSerpBetterHaveJsonSchema,
      prompt: conversionPrompt
    });
    console.log(`[Action: Analyze Better Have] JSON Conversion successful.`);

    // 3. Generate Recommendation from Text
    console.log(
      `[Action: Analyze Better Have] Calling AI for Recommendation...`
    );
    const recommendationPrompt = getBetterHaveRecommendationPrompt(
      markdownAnalysisResultText,
      keyword
    );
    const { text: recommendationResultText } = await generateText({
      model: openai(model),
      prompt: recommendationPrompt
    });
    console.log(`[Action: Analyze Better Have] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(`[Action: Analyze Better Have] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      betterHaveRecommendationText: recommendationResultText,
      betterHaveAnalysisText: markdownAnalysisResultText,
      betterHaveAnalysis: analysisResultJson,
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: Analyze Better Have] Firestore updated.`);

    // 5. Revalidate Cache

    // 6. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(
      `[Action: Analyze Better Have] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `Better Have Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

// --- NEW SERVER ACTION TO FETCH SERP DATA BY ID ---
export async function getSerpDataAction(
  docId: string
): Promise<FirebaseSerpResultObject | null> {
  if (!docId) {
    console.error('[Action: Get SERP Data] Received empty docId.');
    return null;
  }
  console.log(`[Action: Get SERP Data] Fetching SERP data for ID: ${docId}`);
  try {
    // Directly call the database function
    const serpData = await getSerpResultById(docId);

    if (!serpData) {
      console.warn(
        `[Action: Get SERP Data] No SERP data found for ID: ${docId}`
      );
      return null; // Return null if not found
    }
    console.log(
      `[Action: Get SERP Data] SERP data fetched successfully for ID: ${docId}`
    );
    return serpData; // Return the fetched object
  } catch (error) {
    console.error(
      `[Action: Get SERP Data] Error fetching SERP data for ID ${docId}:`,
      error
    );
    // Optionally, throw or return null
    return null; // Returning null to prevent crashing the client
  }
}
// --- END SERVER ACTION ---
