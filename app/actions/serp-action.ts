'use server';

import {
  getContentTypeAnalysisPrompt,
  getContentTypeConversionPrompt,
  getSerpTitleAnalysisPrompt,
  getUserIntentAnalysisPrompt,
  getUserIntentConversionPrompt
} from '@/app/prompt/prompt-design';
import { saveSerpAnalysis } from '@/app/services/firebase';
import { sanitizeKeywordForId } from '@/lib/utils';
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
  keyword: string;
  serpString: string;
  model?: string; // Optional model override
}

interface UserIntentParams extends AnalyzeParams {
  relatedKeywordsRaw: string;
}

// Helper to get sanitized ID
const getSanitizedId = (keyword: string): string => {
  const sanitizedId = sanitizeKeywordForId(keyword);
  if (!sanitizedId) {
    throw new Error(`無法處理關鍵字 \"${keyword}\" 以生成有效 ID。`);
  }
  return sanitizedId;
};

// --- Perform Content Type Analysis (Outputs Text) ---
export async function performContentTypeAnalysis({
  keyword,
  serpString,
  model = 'gpt-4o'
}: AnalyzeParams): Promise<z.infer<typeof contentTypeAnalysisTextSchema>> {
  const sanitizedId = getSanitizedId(keyword);
  const analysisKey = 'contentTypeAnalysisText';
  console.log(
    `[Action] Performing Content Type Analysis (Text) for ${keyword} (ID: ${sanitizedId}) using ${model}`
  );
  try {
    const prompt = getContentTypeAnalysisPrompt(keyword, serpString);
    console.log('[AI Call] Calling AI for Content Type Text Analysis...');
    const { text: analysisResultText } = await generateText({
      model: openai(model),
      prompt
    });
    console.log(
      `[Action] Content Type Analysis (Text) successful for ${keyword}. Saving raw text...`
    );
    const result = { analysisText: analysisResultText };
    const validatedResult = contentTypeAnalysisTextSchema.parse(result); // Use parse for direct validation
    await saveSerpAnalysis(keyword, {
      [analysisKey]: validatedResult.analysisText
    });
    return validatedResult;
  } catch (error) {
    console.error(
      `[Action] Content Type Analysis (Text) failed for ${keyword}:`,
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
  keyword,
  serpString,
  relatedKeywordsRaw,
  model = 'gpt-4o'
}: UserIntentParams): Promise<z.infer<typeof userIntentAnalysisTextSchema>> {
  const sanitizedId = getSanitizedId(keyword);
  const analysisKey = 'userIntentAnalysisText';
  console.log(
    `[Action] Performing User Intent Analysis (Text) for ${keyword} (ID: ${sanitizedId}) using ${model}`
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
      `[Action] User Intent Analysis (Text) successful for ${keyword}. Saving raw text...`
    );
    const result = { analysisText: analysisResultText };
    const validatedResult = userIntentAnalysisTextSchema.parse(result);
    await saveSerpAnalysis(keyword, {
      [analysisKey]: validatedResult.analysisText
    });
    return validatedResult;
  } catch (error) {
    console.error(
      `[Action] User Intent Analysis (Text) failed for ${keyword}:`,
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
  keyword,
  serpString,
  model = 'gpt-4o'
}: AnalyzeParams): Promise<z.infer<typeof titleAnalysisOutputSchema>> {
  const sanitizedId = getSanitizedId(keyword);
  const analysisKey = 'titleAnalysis';
  console.log(
    `[Action] Performing Title Analysis (JSON) for ${keyword} (ID: ${sanitizedId}) using ${model}`
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
      `[Action] Title Analysis (JSON) successful for ${keyword}. Saving...`
    );
    await saveSerpAnalysis(keyword, { [analysisKey]: analysisResult });
    return analysisResult;
  } catch (error) {
    console.error(
      `[Action] Title Analysis (JSON) failed for ${keyword}:`,
      error
    );
    throw new Error(
      `標題分析失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// --- NEW: Convert Analysis Text to JSON ---

interface ConvertParams {
  analysisType: 'contentType' | 'userIntent';
  analysisText: string;
  keyword: string; // Needed for context in the conversion prompt
  model?: string;
}

export async function convertAnalysisTextToJson({
  analysisType,
  analysisText,
  keyword,
  model = 'gpt-4o' // Can use a cheaper/faster model potentially
}: ConvertParams): Promise<
  | z.infer<typeof contentTypeAnalysisJsonSchema>
  | z.infer<typeof userIntentAnalysisJsonSchema>
> {
  console.log(
    `[Action] Converting ${analysisType} text to JSON for keyword: ${keyword}`
  );

  try {
    let prompt: string;
    let schema: z.ZodSchema<any>;

    if (analysisType === 'contentType') {
      prompt = getContentTypeConversionPrompt(analysisText, keyword);
      schema = contentTypeAnalysisJsonSchema;
    } else if (analysisType === 'userIntent') {
      prompt = getUserIntentConversionPrompt(analysisText, keyword);
      schema = userIntentAnalysisJsonSchema;
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
      `[Action] Conversion to JSON successful for ${analysisType} of ${keyword}.`
    );

    // Note: We are NOT saving the converted JSON back to Firestore here.
    // The client receives it directly.
    // If saving is desired, add a saveSerpAnalysis call here.
    // e.g., await saveSerpAnalysis(keyword, { [analysisType === 'contentType' ? 'contentTypeAnalysis' : 'userIntentAnalysis']: convertedResult });

    return convertedResult;
  } catch (error) {
    console.error(
      `[Action] Conversion to JSON failed for ${analysisType} of ${keyword}:`,
      error
    );
    throw new Error(
      `${analysisType} 文本轉換為 JSON 失敗: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/*
// Removed old functions
*/
