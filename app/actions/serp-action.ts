'use server';

import {
  getContentTypeAnalysisPrompt,
  getContentTypeConversionPrompt,
  getSerpTitleAnalysisPrompt,
  getUserIntentAnalysisPrompt,
  getUserIntentConversionPrompt
} from '@/app/prompt/prompt-design';
import {
  deleteSerpAnalysisById,
  findSerpAnalysisByKeyword,
  saveSerpAnalysis,
  type FirebaseSerpAnalysisDoc
} from '@/app/services/firebase/db-serp';
import { fetchKeywordData } from '@/app/services/serp.service';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// --- Zod Schemas for AI Output Validation ---

// Schemas for generateText output
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

// Renamed: Schema for Content Type JSON structure
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
export type ContentTypeAnalysisJson = z.infer<
  typeof contentTypeAnalysisJsonSchema
>; // Export inferred type

// Renamed: Schema for User Intent JSON structure
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
export type UserIntentAnalysisJson = z.infer<
  typeof userIntentAnalysisJsonSchema
>; // Export inferred type

// Schema for Title Analysis JSON structure (No rename needed)
const titleAnalysisOutputSchema = z.object({
  title: z.string(),
  analysis: z.string(),
  recommendations: z.array(z.string())
});
export type TitleAnalysisJson = z.infer<typeof titleAnalysisOutputSchema>; // Export inferred type

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

// --- Perform Content Type Analysis (Outputs Text) ---
export async function performContentTypeAnalysis({
  docId,
  keyword,
  serpString,
  model = 'gpt-o3-mini'
}: AnalyzeParams): Promise<z.infer<typeof contentTypeAnalysisTextSchema>> {
  const analysisKey = 'contentTypeAnalysisText';
  console.log(
    `[Action] Performing Content Type Analysis (Text) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  try {
    const prompt = getContentTypeAnalysisPrompt(keyword, serpString);
    console.log('[AI Call] Calling AI for Content Type Text Analysis...');
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt
    });
    console.log(
      `[Action] Content Type Analysis (Text) successful for Doc ID: ${docId}. Saving raw text...`
    );
    const result = { analysisText: analysisResultText };
    const validatedResult = contentTypeAnalysisTextSchema.parse(result);
    await saveSerpAnalysis(
      { [analysisKey]: validatedResult.analysisText },
      docId
    );
    return validatedResult;
  } catch (error) {
    console.error(
      `[Action] Content Type Analysis (Text) failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `內容類型分析失敗: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Perform User Intent Analysis (Outputs Text) ---
export async function performUserIntentAnalysis({
  docId,
  keyword,
  serpString,
  relatedKeywordsRaw,
  model = 'gpt-o3-mini'
}: UserIntentParams): Promise<z.infer<typeof userIntentAnalysisTextSchema>> {
  const analysisKey = 'userIntentAnalysisText';
  console.log(
    `[Action] Performing User Intent Analysis (Text) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  try {
    const prompt = getUserIntentAnalysisPrompt(
      keyword,
      serpString,
      relatedKeywordsRaw
    );
    console.log('[AI Call] Calling AI for User Intent Text Analysis...');
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt
    });
    console.log(
      `[Action] User Intent Analysis (Text) successful for Doc ID: ${docId}. Saving raw text...`
    );
    const result = { analysisText: analysisResultText };
    const validatedResult = userIntentAnalysisTextSchema.parse(result);
    await saveSerpAnalysis(
      { [analysisKey]: validatedResult.analysisText },
      docId
    );
    return validatedResult;
  } catch (error) {
    console.error(
      `[Action] User Intent Analysis (Text) failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `用戶意圖分析失敗: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Perform SERP Title Analysis (Outputs JSON) ---
export async function performSerpTitleAnalysis({
  docId,
  keyword,
  serpString,
  model = 'gpt-o3-mini'
}: AnalyzeParams): Promise<z.infer<typeof titleAnalysisOutputSchema>> {
  const analysisKey = 'titleAnalysis';
  console.log(
    `[Action] Performing Title Analysis (JSON) for Doc ID: ${docId} (Keyword: ${keyword}) using ${model}`
  );
  try {
    const prompt = getSerpTitleAnalysisPrompt(keyword, serpString);
    console.log('[AI Call] Calling AI for Title JSON Analysis...');
    const { object: analysisResult } = await generateObject({
      model: openai(model),
      schema: titleAnalysisOutputSchema,
      prompt
    });
    console.log(
      `[Action] Title Analysis (JSON) successful for Doc ID: ${docId}. Saving...`
    );
    await saveSerpAnalysis({ [analysisKey]: analysisResult }, docId);
    return analysisResult;
  } catch (error) {
    console.error(
      `[Action] Title Analysis (JSON) failed for Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `標題分析失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- NEW: Convert Analysis Text to JSON ---

interface ConvertParams {
  docId: string;
  analysisType: 'contentType' | 'userIntent';
  analysisText: string;
  keyword: string;
  model?: string;
}

export async function convertAnalysisTextToJson({
  docId,
  analysisType,
  analysisText,
  keyword,
  model = 'gpt-o3-mini'
}: ConvertParams): Promise<
  | z.infer<typeof contentTypeAnalysisJsonSchema>
  | z.infer<typeof userIntentAnalysisJsonSchema>
> {
  console.log(
    `[Action] Converting ${analysisType} text to JSON for Doc ID: ${docId} (Keyword: ${keyword})`
  );

  if (!docId) {
    throw new Error('缺少文檔 ID，無法儲存轉換結果。');
  }

  try {
    let prompt: string;
    let schema: z.ZodSchema<any>;
    let saveKey: 'contentTypeAnalysis' | 'userIntentAnalysis';

    if (analysisType === 'contentType') {
      prompt = getContentTypeConversionPrompt(analysisText, keyword);
      schema = contentTypeAnalysisJsonSchema;
      saveKey = 'contentTypeAnalysis';
    } else if (analysisType === 'userIntent') {
      prompt = getUserIntentConversionPrompt(analysisText, keyword);
      schema = userIntentAnalysisJsonSchema;
      saveKey = 'userIntentAnalysis';
    } else {
      throw new Error('無效的分析類型');
    }

    console.log(`[AI Call] Calling AI for ${analysisType} JSON Conversion...`);
    const { object: convertedResult } = await generateObject({
      model: openai(model),
      schema: schema,
      prompt: prompt
    });

    console.log(
      `[Action] Conversion to JSON successful for ${analysisType} of ${keyword}. Saving...`
    );

    await saveSerpAnalysis({ [saveKey]: convertedResult }, docId);
    console.log(
      `[Action] Successfully saved ${saveKey} JSON to Doc ID: ${docId}`
    );

    return convertedResult;
  } catch (error) {
    console.error(
      `[Action] Conversion to JSON failed for ${analysisType} of Doc ID: ${docId}:`,
      error
    );
    throw new Error(
      `${analysisType} 文本轉換為 JSON 或儲存時失敗: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- NEW: Action to Initiate SERP Analysis (Fetch + Create Doc) ---

interface InitiateParams {
  originalKeyword: string;
  region?: string | null;
  language?: string | null;
}

export async function initiateSerpAnalysisAction({
  originalKeyword,
  region,
  language
}: InitiateParams): Promise<string> {
  // Returns the new document ID
  console.log(
    `[Action] Initiating new SERP analysis for: ${originalKeyword} (Region: ${
      region || 'default'
    }, Lang: ${language || 'default'})`
  );

  if (!originalKeyword) {
    throw new Error('Keyword cannot be empty for initiating analysis.');
  }

  try {
    // 1. Fetch data from Apify (Assume fetchKeywordData returns the full structure)
    // IMPORTANT: Ensure fetchKeywordData in serp.service.ts returns an object
    // matching the structure defined by FirebaseSerpAnalysisDoc in db-serp.ts
    // (e.g., { searchQuery: {...}, resultsTotal: ..., organicResults: [...] })
    console.log(`[Action] Fetching SERP data from Apify...`);
    const fullSerpData = await fetchKeywordData(
      originalKeyword,
      region,
      language
    );
    console.log(`[Action] Fetched full SERP data from Apify.`);

    // 2. Prepare data for saving (create mode) - map the full structure
    // The type here should ideally match what fetchKeywordData returns
    // Assuming it largely matches FirebaseSerpAnalysisDoc structure
    const dataToSave: Partial<FirebaseSerpAnalysisDoc> & {
      originalKeyword: string;
    } = {
      originalKeyword: originalKeyword,
      // Map all relevant fields from the fetched data
      searchQuery: fullSerpData.searchQuery ?? null,
      resultsTotal: fullSerpData.resultsTotal ?? null,
      relatedQueries: fullSerpData.relatedQueries ?? [],
      aiOverview: fullSerpData.aiOverview ?? null,
      paidResults: fullSerpData.paidResults ?? [],
      paidProducts: fullSerpData.paidProducts ?? [],
      peopleAlsoAsk: fullSerpData.peopleAlsoAsk ?? [],
      organicResults: fullSerpData.organicResults ?? [], // Ensure organicResults includes all details

      // Initialize analysis fields to null
      contentTypeAnalysis: null,
      userIntentAnalysis: null,
      titleAnalysis: null,
      contentTypeAnalysisText: null,
      userIntentAnalysisText: null
    };

    // 3. Save new document to Firestore using saveSerpAnalysis (create mode)
    console.log(`[Action] Saving initial SERP data to Firestore...`);
    // Pass the more complete dataToSave object
    const newDocId = await saveSerpAnalysis(dataToSave);
    console.log(
      `[Action] Successfully created Firestore document with ID: ${newDocId}`
    );

    // 4. Return the new document ID
    return newDocId;
  } catch (error) {
    console.error(
      `[Action] Failed to initiate SERP analysis for ${originalKeyword}:`,
      error
    );
    // Re-throw a more specific error or handle as needed
    throw new Error(
      `無法為關鍵字 '${originalKeyword}' 啟動 SERP 分析: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- NEW: Action to Find or Create SERP Analysis ---

interface FindOrCreateParams {
  originalKeyword: string;
  region?: string | null;
  language?: string | null;
}

export async function findOrCreateSerpAnalysisAction({
  originalKeyword,
  region,
  language
}: FindOrCreateParams): Promise<string> {
  // Returns the document ID (existing or new)
  console.log(
    `[Action] Finding or Creating SERP analysis for: ${originalKeyword}`
  );

  if (!originalKeyword) {
    throw new Error('Keyword cannot be empty.');
  }

  try {
    // 1. Try to find existing analysis
    const existingAnalysis = await findSerpAnalysisByKeyword(originalKeyword);

    if (existingAnalysis) {
      // 2a. Found: return the existing ID
      console.log(
        `[Action] Found existing analysis with ID: ${existingAnalysis.id}`
      );
      return existingAnalysis.id;
    } else {
      // 2b. Not Found: Initiate new analysis using the other action
      console.log(
        `[Action] Existing analysis not found. Initiating new one...`
      );
      const newDocId = await initiateSerpAnalysisAction({
        originalKeyword,
        region,
        language
      });
      console.log(
        `[Action] New analysis initiated. Returning new ID: ${newDocId}`
      );
      return newDocId;
    }
  } catch (error) {
    console.error(
      `[Action] Failed to find or create SERP analysis for ${originalKeyword}:`,
      error
    );
    // Re-throw or handle as needed
    throw new Error(
      `查找或創建關鍵字 '${originalKeyword}' 的分析時失敗: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- NEW: Action to Delete SERP Analysis ---

interface DeleteParams {
  docId: string;
}

export async function deleteSerpAnalysisAction({
  docId
}: DeleteParams): Promise<{ success: boolean; message?: string }> {
  console.log(`[Action] Attempting to delete SERP analysis with ID: ${docId}`);

  if (!docId) {
    console.error('[Action] Delete failed: Document ID is missing.');
    return { success: false, message: '缺少文檔 ID，無法刪除。' };
  }

  try {
    await deleteSerpAnalysisById(docId);
    console.log(
      `[Action] Successfully requested deletion for document ID: ${docId}`
    );
    // Revalidate the path for the input page if needed, so the list updates
    // revalidatePath('/serp');
    return { success: true };
  } catch (error) {
    console.error(
      `[Action] Failed to delete SERP analysis for ID ${docId}:`,
      error
    );
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `刪除分析失敗: ${message}`
    };
  }
}
