'use server';

import {
  getContentTypeAnalysisPrompt,
  getContentTypeConversionPrompt,
  getContentTypeRecommendationPrompt,
  getUserIntentConversionPrompt,
  getUserIntentRecommendationPrompt,
  getTitleRecommendationPrompt,
  getSerpTitleAnalysisPrompt,
  getUserIntentAnalysisPrompt,
  getBetterHaveConversionPrompt,
  getBetterHaveRecommendationPrompt,
  getBetterHaveInArticlePrompt,
} from '@/app/prompt/serp-prompt-design';
import {
  findSerpDataDoc,
  saveSerpDataDoc,
  updateSerpDataField,
  deleteSerpDataDocById,
  getSerpDataDocById
} from '@/app/services/firebase/db-serp-data';
import { fetchSerpByKeyword } from '@/app/services/serp.service';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import {
    BetterHaveJsonSchema,
} from '@/app/services/firebase/schema';
import type {
    FirebaseSerpDataDoc as OriginalFirebaseSerpDataDoc, 
    ContentTypeAnalysisJson, 
    UserIntentAnalysisJson, 
    TitleAnalysisJson,
    BetterHaveAnalysisJson
} from '@/app/services/firebase/schema';

// Define a client-safe version for the return type
export type ClientSafeSerpDataDoc = Omit<OriginalFirebaseSerpDataDoc, 'createdAt' | 'updatedAt'> & {
    id: string;
    createdAt: string | null;
    updatedAt: string | null;
};

// --- Zod Schemas for AI Output Validation ---

// --- RE-ADD Schemas for generateText output --- 
const contentTypeAnalysisTextSchema = z.object({
  analysisText: z.string().describe('包含內容類型分析的原始文本/Markdown')
});
const userIntentAnalysisTextSchema = z.object({
  analysisText: z.string().describe('包含用戶意圖分析的原始文本/Markdown')
});

// Schemas for generateObject output (Title analysis and Conversion outputs)
const pageReferenceSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url()
});

// Schema for Content Type JSON structure (Matches definition in db-serp.ts)
const contentTypeAnalysisJsonSchema = z.object({
  analysisTitle: z.string(),
  reportDescription: z.string(),
  usageHint: z.string(),
  contentTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().nonnegative(),
      pages: z.array(pageReferenceSchema)
    })
  )
});
// Re-exporting type for clarity in function signatures
export type { ContentTypeAnalysisJson };

// Schema for User Intent JSON structure (Matches definition in db-serp.ts)
const userIntentAnalysisJsonSchema = z.object({
  analysisTitle: z.string(),
  reportDescription: z.string(),
  usageHint: z.string(),
  intents: z.array(
    z.object({
      category: z.enum([
        'Navigational',
        'Informational',
        'Commercial',
        'Transactional'
      ]),
      specificIntent: z.string(),
      count: z.number().int().nonnegative(),
      pages: z.array(pageReferenceSchema)
    })
  ),
  relatedKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        searchVolume: z.number().nullable()
      })
    )
    .optional()
});
// Re-exporting type for clarity in function signatures
export type { UserIntentAnalysisJson };

// Schema for Title Analysis JSON structure (Matches definition in db-serp.ts)
const titleAnalysisOutputSchema = z.object({
  title: z.string(),
  analysis: z.string(),
  recommendations: z.array(z.string())
});
// Re-exporting type for clarity in function signatures
export type { TitleAnalysisJson };

// --- Server Actions for Analysis ---

interface AnalyzeParams {
  docId: string;
  keyword: string;
  serpString: string;
  model?: string;
}

interface UserIntentParams extends AnalyzeParams {
  relatedKeywordsRaw: string;
}

// --- REVERTED: Perform Content Type Analysis (Outputs Text) ---
export async function performContentTypeAnalysis({
  docId,
  keyword,
  serpString,
  model = 'gpt-4.1-mini'
}: AnalyzeParams): Promise<{ analysisText: string }> {
  const analysisKey = 'contentTypeAnalysisText'; // Field name in FirebaseSerpDataDocSchema
  console.log(
    `[Action] Performing Content Type Analysis (Text) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  if (!docId) throw new Error('Document ID is required to save analysis text.');

  try {
    const prompt = getContentTypeAnalysisPrompt(keyword, serpString);
    console.log('[AI Call] Calling AI for Content Type Text Analysis...');
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt
    });
    console.log(
      `[Action] Content Type Analysis (Text) successful for Doc ID: ${docId}. Saving to ${analysisKey}...`
    );
    
    // --- Update specific field in SERP_DATA doc ---
    await updateSerpDataField(docId, analysisKey, analysisResultText); 
    console.log(`[Action] Successfully updated ${analysisKey} for Doc ID: ${docId}`);
    
    return { analysisText: analysisResultText }; // Return the generated text

  } catch (error) {
    console.error(
      `[Action] Content Type Analysis (Text) failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `內容類型分析失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- REVERTED: Perform User Intent Analysis (Outputs Text) ---
export async function performUserIntentAnalysis({
  docId,
  keyword,
  serpString,
  relatedKeywordsRaw,
  model = 'gpt-4.1-mini'
}: UserIntentParams): Promise<{ analysisText: string }> {
  const analysisKey = 'userIntentAnalysisText'; // Field name in FirebaseSerpDataDocSchema
  console.log(
    `[Action] Performing User Intent Analysis (Text) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  if (!docId) throw new Error('Document ID is required to save analysis text.');

  try {
    const prompt = getUserIntentAnalysisPrompt(keyword, serpString, relatedKeywordsRaw);
    console.log('[AI Call] Calling AI for User Intent Text Analysis...');
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt
    });
    console.log(
      `[Action] User Intent Analysis (Text) successful for Doc ID: ${docId}. Saving to ${analysisKey}...`
    );

    // --- Update specific field in SERP_DATA doc ---
    await updateSerpDataField(docId, analysisKey, analysisResultText);
    console.log(`[Action] Successfully updated ${analysisKey} for Doc ID: ${docId}`);

    return { analysisText: analysisResultText }; // Return the generated text

  } catch (error) {
    console.error(
      `[Action] User Intent Analysis (Text) failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `用戶意圖分析失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- RE-ADD: Convert Analysis Text to JSON ---

interface ConvertParams {
  docId: string;
  analysisType: 'contentType' | 'userIntent';
  analysisText: string;
  keyword: string;
  model?: string;
}

export async function generateAnalysisJsonFromText({
  docId,
  analysisType,
  analysisText,
  keyword,
  model = 'gpt-4.1-mini'
}: ConvertParams): Promise<{
  analysisJson: ContentTypeAnalysisJson | UserIntentAnalysisJson;
  recommendationText: string;
}> {
  console.log(
    `[Action] Converting ${analysisType} text to JSON and generating recommendation for Doc ID: ${docId} (Keyword: ${keyword})`
  );

  if (!docId) {
    throw new Error('Missing Document ID, cannot save conversion result.');
  }
  if (!analysisText) {
    throw new Error('Missing analysis text, cannot perform conversion or generate recommendation.');
  }

  try {
    let conversionPrompt: string;
    let recommendationPrompt: string;
    let schema: z.ZodSchema<any>;
    let saveKey: 'contentTypeAnalysis' | 'userIntentAnalysis';

    // Prepare prompts and schema based on analysis type
    if (analysisType === 'contentType') {
      conversionPrompt = getContentTypeConversionPrompt(analysisText, keyword);
      recommendationPrompt = getContentTypeRecommendationPrompt(analysisText);
      schema = contentTypeAnalysisJsonSchema;
      saveKey = 'contentTypeAnalysis';
    } else if (analysisType === 'userIntent') {
      conversionPrompt = getUserIntentConversionPrompt(analysisText, keyword);
      recommendationPrompt = getUserIntentRecommendationPrompt(analysisText, keyword);
      schema = userIntentAnalysisJsonSchema;
      saveKey = 'userIntentAnalysis';
    } else {
      throw new Error('Invalid analysis type for conversion/recommendation.');
    }

    // --- Perform JSON Conversion (generateObject) ---
    console.log(`[AI Call] Calling AI for ${analysisType} JSON Conversion...`);
    const { object: convertedResult } = await generateObject({
      model: openai(model),
      schema: schema,
      prompt: conversionPrompt
    });
    console.log(
      `[Action] Conversion to JSON successful for ${analysisType} of ${keyword}.`
    );

    // --- Perform Recommendation Generation (generateText) ---
    console.log(`[AI Call] Calling AI for ${analysisType} Recommendation Text...`);
    const { text: recommendationResultText } = await generateText({
      model: openai(model),
      prompt: recommendationPrompt
    });
    console.log(
      `[Action] Generation of recommendation text successful for ${analysisType} of ${keyword}.`
    );

    // --- Save the converted JSON ---
    console.log(`Saving ${saveKey} JSON to Firestore...`);
    await updateSerpDataField(docId, saveKey, convertedResult);
    console.log(
      `[Action] Successfully updated ${saveKey} JSON for Doc ID: ${docId}`
    );

    // --- Return both JSON and Recommendation Text ---
    return {
      analysisJson: convertedResult as (ContentTypeAnalysisJson | UserIntentAnalysisJson),
      recommendationText: recommendationResultText
    };

  } catch (error) {
    console.error(
      `[Action] Processing failed for ${analysisType} of Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `${analysisType} processing (JSON conversion or recommendation) failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Action to Delete SERP Data ---
// Interface needed for the delete action
interface DeleteParams { 
  docId: string;
}

// Renamed from deleteSerpAnalysisAction
export async function deleteSerpDataAction({ 
  docId 
}: DeleteParams): Promise<{ success: boolean; message?: string }> { 
  console.log(`[Action] Attempting to delete SERP data document with ID: ${docId}`);

  if (!docId) {
    console.error('[Action] Delete failed: Document ID is missing.');
    return { success: false, message: '缺少文檔 ID，無法刪除。' };
  }

  try {
    // Use the renamed DB function targeting the SERP_DATA collection
    await deleteSerpDataDocById(docId); 
    console.log(
      `[Action] Successfully requested deletion for document ID: ${docId}`
    );
    // Consider if revalidation is needed here
    // revalidatePath('/some-path-displaying-serp-data'); 
    return { success: true };
  } catch (error) {
    console.error(
      `[Action] Failed to delete SERP data for ID ${docId}:`,
      error
    );
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `刪除 SERP 數據失敗: ${message}`
    };
  }
}

// --- Server Actions for Analysis (Refactored) ---

interface GetOrFetchParams {
  query: string;
  region: string;
  language: string;
}

/**
 * Converts Firestore Timestamps/Dates within a SERP data object to ISO strings.
 */
function serializeTimestamps(data: (OriginalFirebaseSerpDataDoc & { id: string }) | null): ClientSafeSerpDataDoc | null {
  if (!data) {
    return null;
  }
  // Use 'as any' for intermediate steps, then cast to the final correct type
  const serializableData = { ...data } as any;

  // Firestore Timestamp or JS Date
  if (serializableData.createdAt) {
    if (typeof serializableData.createdAt.toDate === 'function') {
      serializableData.createdAt = serializableData.createdAt.toDate().toISOString();
    } else if (serializableData.createdAt instanceof Date) {
      serializableData.createdAt = serializableData.createdAt.toISOString();
    }
  } else {
     serializableData.createdAt = null; // Ensure null if originally missing
  }

  // Firestore Timestamp or JS Date
  if (serializableData.updatedAt) {
    if (typeof serializableData.updatedAt.toDate === 'function') {
      serializableData.updatedAt = serializableData.updatedAt.toDate().toISOString();
    } else if (serializableData.updatedAt instanceof Date) {
      serializableData.updatedAt = serializableData.updatedAt.toISOString();
    }
  } else {
      serializableData.updatedAt = null; // Ensure null if originally missing
  }

  // Cast to the final client-safe type
  return serializableData as ClientSafeSerpDataDoc;
}

/**
 * Finds an existing SERP data document or fetches and saves a new one.
 * @returns The full SERP data document (including ID) or null if fetch fails.
 */
export async function getOrFetchSerpDataAction({
  query,
  region,
  language
}: GetOrFetchParams): Promise<ClientSafeSerpDataDoc | null> {
  console.log(`[Action] Getting or fetching SERP data for: ${query} (R: ${region}, L: ${language})`);

  if (!query || !region || !language) {
    throw new Error('Query, region, and language are required.');
  }

  try {
    // 1. Try to find existing data in Firestore
    const existingData = await findSerpDataDoc(query, region, language);
    if (existingData) {
      console.log(`[Action] Found existing SERP data in DB: ${existingData.id}`);
      // --- Serialize before returning ---
      return serializeTimestamps(existingData);
    }

    // 2. Not found, fetch from service (e.g., Apify)
    console.log(`[Action] Existing data not found. Fetching from SERP service...`);
    const fetchedData = await fetchSerpByKeyword({ query, region, language });
    console.log(`[Action] Fetched data from SERP service.`);

    // 3. Map fetched data to our schema and save
    //    Handle potential type mismatches identified by linter previously.
    const dataToSave: Omit<OriginalFirebaseSerpDataDoc, 'id' | 'createdAt' | 'updatedAt'> = {
      query: query, // Use the input query
      region: region, // Use the input region
      language: language, // Use the input language

      // Map fetched fields carefully, providing defaults or null
      searchQuery: typeof fetchedData.searchQuery === 'string' ? fetchedData.searchQuery : JSON.stringify(fetchedData.searchQuery ?? null),
      resultsTotal: fetchedData.resultsTotal ?? null,
      // Fix relatedQueries mapping
      relatedQueries: Array.isArray(fetchedData.relatedQueries)
        ? fetchedData.relatedQueries.map((q: any) => ({
          query: q.query || q.title || 'Missing Query', // Attempt to get query or title
          url: q.url ?? null
        }))
        : [],
      // Fix aiOverview mapping
      aiOverview: typeof fetchedData.aiOverview === 'string' ? fetchedData.aiOverview : JSON.stringify(fetchedData.aiOverview ?? null),
      paidResults: fetchedData.paidResults ?? [], // Keep as any[] for now
      paidProducts: fetchedData.paidProducts ?? [], // Keep as any[] for now
      // Fix peopleAlsoAsk mapping
      peopleAlsoAsk: Array.isArray(fetchedData.peopleAlsoAsk)
        ? fetchedData.peopleAlsoAsk.map((paa: any) => ({
          question: paa.question || 'Missing Question',
          answer: paa.answer ?? null,
          title: paa.title ?? null,
          url: paa.url ?? null
        }))
        : [],
      organicResults: Array.isArray(fetchedData.organicResults)
        ? fetchedData.organicResults.map((org: any) => ({
          position: org.position,
          url: org.url,
          title: org.title,
          description: org.description ?? null,
          displayedUrl: org.displayedUrl ?? null
          // Map other fields if needed
        }))
        : [],

      // Initialize new fields to null
      urlOutline: null,
      contentTypeAnalysisText: null,
      userIntentAnalysisText: null,
      contentTypeAnalysis: null,
      userIntentAnalysis: null,
      titleAnalysis: null,
    };

    console.log(`[Action] Saving newly fetched data to Firestore...`);
    const newDocId = await saveSerpDataDoc(dataToSave);
    console.log(`[Action] Saved new SERP data with ID: ${newDocId}`);

    // Fetch the newly created doc to include timestamps in the return
    const savedDoc = await getSerpDataDocById(newDocId);
    if (!savedDoc) {
        // This shouldn't happen ideally, but handle it
        console.error(`[Action] Failed to retrieve newly saved doc: ${newDocId}`);
        // Return the data we have, even without DB timestamps
        // Add placeholder/null timestamps to satisfy the type temporarily
        // Create a fallback object with current dates and serialize it
         const fallbackData = {
            ...dataToSave,
            id: newDocId,
            createdAt: new Date(), // Use JS Date
            updatedAt: new Date()  // Use JS Date
        };
         // Need to cast the fallback to match the input expectation of serializeTimestamps
         return serializeTimestamps(fallbackData as (OriginalFirebaseSerpDataDoc & { id: string }));
    }
    console.log(`[Action] Successfully retrieved newly saved doc with timestamps.`);
    // --- Serialize before returning ---
    return serializeTimestamps(savedDoc);

  } catch (error) {
    console.error(`[Action] Failed to get or fetch SERP data for ${query}:`, error);
    // Depending on requirements, you might return null or re-throw
    return null;
  }
}

// --- NEW: Perform Title Analysis (Outputs JSON + Recommendation Text) ---
export async function performSerpTitleAnalysis({
  docId,
  keyword,
  serpString,
  model = 'gpt-4.1-mini'
}: AnalyzeParams): Promise<{
  analysisJson: TitleAnalysisJson;
  recommendationText: string;
}> {
  const analysisKey = 'titleAnalysis'; // Field name in FirebaseSerpDataDocSchema
  console.log(
    `[Action] Performing Title Analysis & Recommendation for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  if (!docId) throw new Error('Document ID is required to save title analysis.');

  try {
    // --- 1. Generate the structured JSON analysis ---
    const analysisPrompt = getSerpTitleAnalysisPrompt(keyword, serpString);
    console.log('[AI Call] Calling AI for Title Analysis JSON...');
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: titleAnalysisOutputSchema, // Use the specific schema for title analysis
      prompt: analysisPrompt
    });
    console.log(
        `[Action] Title Analysis JSON generation successful for Doc ID: ${docId}.`
      );

    // --- 2. Generate the recommendation text based on the JSON analysis ---
    const recommendationPrompt = getTitleRecommendationPrompt(
      analysisResultJson.title,
      analysisResultJson.analysis
    );
    console.log('[AI Call] Calling AI for Title Recommendation Text...');
    const { text: recommendationResultText } = await generateText({
        model: openai(model), // Can use the same model
        prompt: recommendationPrompt
    });
    console.log(
        `[Action] Title Recommendation Text generation successful for Doc ID: ${docId}.`
      );

    // --- 3. Save the JSON analysis to Firestore ---
    console.log(`[Action] Saving ${analysisKey} JSON to Firestore...`);
    await updateSerpDataField(docId, analysisKey, analysisResultJson);
    console.log(`[Action] Successfully updated ${analysisKey} for Doc ID: ${docId}`);

    // --- 4. Return both the JSON and the recommendation text ---
    return {
        analysisJson: analysisResultJson, // No need to cast if schema matches type
        recommendationText: recommendationResultText
    };

  } catch (error) {
    console.error(
      `[Action] Title Analysis or Recommendation failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `標題分析或建議生成失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- Interface for the new analysis ---
interface BetterHaveParams {
  docId: string;
  keyword: string;
  serpString: string; // Top 15 organic results
  paaString: string;
  relatedQueriesString: string;
  aiOverviewString: string;
  model?: string;
}

// --- UPDATED: Perform "Better Have In Article" Analysis ---
// Update return type
export async function performBetterHaveInArticleAnalysis({
  docId,
  keyword,
  serpString,
  paaString,
  relatedQueriesString,
  aiOverviewString,
  model = 'gpt-4.1-mini'
}: BetterHaveParams): Promise<{
    analysisJson: BetterHaveAnalysisJson;
    recommendationText: string;
}> {
  // Define keys for saving, matching the updated schema
  const textAnalysisKey = 'betterHaveAnalysisText';
  const jsonAnalysisKey = 'betterHaveAnalysisJson';

  console.log(
    `[Action] Performing 'Better Have' Analysis (Text, JSON, Recommendation) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  if (!docId) throw new Error('Document ID is required.');

  try {
    // --- 1. Generate Raw Markdown Analysis Text ---
    const textPrompt = getBetterHaveInArticlePrompt(
        keyword, serpString, paaString, relatedQueriesString, aiOverviewString
    );
    console.log('[AI Call 1/3] Generating Better Have Markdown Text...');
    const { text: markdownAnalysisResultText } = await generateText({
      model: openai(model),
      prompt: textPrompt
    });
    console.log(`[Action] Raw Markdown generation successful for Doc ID: ${docId}.`);

    // --- Save Raw Text Immediately ---
    try {
         console.log(`[Action] Saving ${textAnalysisKey} to Firestore...`);
         await updateSerpDataField(docId, textAnalysisKey, markdownAnalysisResultText);
         console.log(`[Action] Successfully updated ${textAnalysisKey} for Doc ID: ${docId}`);
    } catch(saveError) {
        console.error(`[Action] Failed to save ${textAnalysisKey} for Doc ID: ${docId}:`, saveError);
        // Decide if this error is critical or if we can proceed
    }


    // --- 2. Convert Markdown to Structured JSON ---
    const conversionPrompt = getBetterHaveConversionPrompt(markdownAnalysisResultText, keyword);
    console.log('[AI Call 2/3] Converting Better Have Markdown to JSON...');
    const { object: analysisResultJson } = await generateObject({
      model: openai(model),
      schema: BetterHaveJsonSchema,
      prompt: conversionPrompt
    });
    console.log(`[Action] JSON conversion successful for Doc ID: ${docId}.`);

    // --- Save JSON Analysis ---
     try {
         console.log(`[Action] Saving ${jsonAnalysisKey} to Firestore...`);
         await updateSerpDataField(docId, jsonAnalysisKey, analysisResultJson);
         console.log(`[Action] Successfully updated ${jsonAnalysisKey} for Doc ID: ${docId}`);
    } catch(saveError) {
        console.error(`[Action] Failed to save ${jsonAnalysisKey} for Doc ID: ${docId}:`, saveError);
    }


    // --- 3. Generate Concise Recommendation Text ---
    const recommendationPrompt = getBetterHaveRecommendationPrompt(markdownAnalysisResultText, keyword);
    console.log('[AI Call 3/3] Generating Better Have Recommendation Text...');
    const { text: recommendationResultText } = await generateText({
        model: openai(model),
        prompt: recommendationPrompt
    });
     console.log(`[Action] Recommendation text generation successful for Doc ID: ${docId}.`);


    // --- 4. Return JSON and Recommendation Text ONLY ---
    return {
        analysisJson: analysisResultJson,
        recommendationText: recommendationResultText,
    };

  } catch (error) {
    console.error(
      `[Action] 'Better Have' Analysis pipeline failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `'Better Have In Article' 分析流程失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
