/**
 * AI Service - 提供 AI 相關的功能
 */
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Import OpenAI or your preferred AI SDK here
// Example: import OpenAI from 'openai';

// --- Configuration (Replace with your actual configuration) ---
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });
const RELATED_KEYWORDS_MODEL = 'gpt-4o-mini'; // Or your preferred model

// 定義 AI 服務的輸入類型 (保持泛用性)
export interface AIServiceInput {
  keywords: string[];
  region?: string;
  language?: string;
  model?: 'gpt-4o' | 'gpt-4o-mini'; // Keep this generic for now
}

// 定義 AI 服務的輸出類型 (保持泛用性)
export interface AIServiceOutput {
  results: Record<string, any>; // Can be Record<string, string> for parent keywords
  error?: string;
}

/**
 * AI 服務的主要函數 (Placeholder - can be removed if not needed)
 */
export async function processWithAI(
  input: AIServiceInput
): Promise<AIServiceOutput> {
  try {
    // 這裡可以添加 AI 處理的邏輯
    return {
      results: {}
    };
  } catch (error) {
    return {
      results: {},
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Uses AI to identify parent keywords for a list of zero-volume keywords.
 *
 * @param zeroVolumeKeywords An array of keywords with zero search volume.
 * @returns A promise that resolves to a Record mapping zero-volume keywords to their identified parent keyword.
 */
export async function identifyParentKeywordsFromAI(
  zeroVolumeKeywords: string[]
): Promise<Record<string, string>> {
  if (!zeroVolumeKeywords || zeroVolumeKeywords.length === 0) {
    return {};
  }

  // --- Placeholder for AI Interaction ---
  console.log(
    `[AI Service] identifyParentKeywordsFromAI called for ${zeroVolumeKeywords.length} keywords.`
  );

  // TODO: Implement the actual AI call logic here
  // 1. Construct the prompt for the AI model.
  //    Example Prompt Structure:
  //    "For each of the following keywords, identify the core product, brand, or overarching theme.
  //     Return only the single most relevant short-tail keyword for that theme.
  //     Format the output as JSON: {"original_keyword1": "parent_keyword1", "original_keyword2": "parent_keyword2", ...}
  //     Keywords: [keyword1, keyword2, ...]"

  // 2. Make the API call to your chosen AI model (e.g., OpenAI).
  //    Example (Conceptual using OpenAI SDK):
  //    try {
  //      const prompt = `... construct your prompt ... Keywords: ${JSON.stringify(zeroVolumeKeywords)}`;
  //      const completion = await openai.chat.completions.create({
  //        model: PARENT_KEYWORD_MODEL,
  //        messages: [{ role: 'user', content: prompt }],
  //        response_format: { type: "json_object" }, // Use JSON mode if available
  //        // Add other parameters like temperature, max_tokens etc.
  //      });
  //      const aiResponseContent = completion.choices[0]?.message?.content;
  //      if (!aiResponseContent) {
  //         throw new Error('AI response content is empty.');
  //      }
  //      // 3. Parse the AI response (expecting JSON).
  //      const parentMap = JSON.parse(aiResponseContent);
  //      // 4. Validate the response structure (optional but recommended).
  //      // ... validation logic ...
  //      console.log(`[AI Service] Successfully parsed parent keywords from AI.`);
  //      return parentMap; // Return the Record<string, string>
  //    } catch (error) {
  //      console.error('[AI Service] Error calling or parsing AI response:', error);
  //      // Decide how to handle errors: return empty object, throw, etc.
  //      // Returning empty might be safer for the overall flow.
  //      return {};
  //    }

  // Placeholder return until AI call is implemented
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async work
  // Example placeholder response structure:
  const placeholderMap: Record<string, string> = {};
  zeroVolumeKeywords.forEach(kw => {
    // Basic placeholder logic: just take the first word
    placeholderMap[kw] = kw.split(' ')[0] || kw;
  });
  console.warn(
    '[AI Service] Using placeholder logic for parent keyword identification.'
  );
  return placeholderMap;
  // --- End Placeholder ---
}

/**
 * Uses AI to generate related keyword suggestions based on an initial query.
 *
 * @param query The initial search query.
 * @param region The target region (e.g., 'TW').
 * @param language The target language (e.g., 'zh-TW').
 * @param count The desired number of suggestions (default: 10).
 * @returns A promise that resolves to an array of suggested keywords.
 */
export async function generateRelatedKeywordsAI(
  query: string,
  region: string,
  language: string,
  count: number = 10
): Promise<string[]> {
  if (!query) {
    console.warn('[AI Service] generateRelatedKeywordsAI: Query is empty.');
    return [];
  }

  console.log(
    `[AI Service] generateRelatedKeywordsAI called for query: "${query}", Region: ${region}, Lang: ${language}, Count: ${count}`
  );

  // --- Updated Prompt ---
  const prompt = `你是一位專業的關鍵字研究專家，專注於 ${region} 地區、使用 ${language} 語言的市場。
針對以下核心查詢：「${query}」

請生成大約 ${count} 個與其高度相關的補充關鍵字建議。這些建議應該包含：
1.  **核心主題/品牌詞**：如果原始查詢包含明確的核心主題或品牌（例如 "香奈兒手錶" 中的 "香奈兒"），請務必包含該核心詞本身。
2.  **相關類別/主題詞**：與核心查詢相關的、更廣泛的類別或主題（例如 "精品手錶", "奢侈品牌", "時尚配件"）。
3.  **具體補充詞**：
    *   可能的同義詞或替代說法。
    *   與核心查詢相關的具體產品、服務、型號、問題（例如 "J12", "價格", "維修"）。
    *   潛在的長尾關鍵字組合（例如 "香奈兒手錶推薦款", "如何保養香奈兒手錶"）。
4.  目標是混合生成不同層次的關鍵字，找出較有可能具有搜尋量、且能擴展原始查詢涵蓋範圍的字詞。

請將生成的關鍵字建議以 JSON 數組的格式返回，例如：["香奈兒", "精品手錶", "香奈兒手錶價格", ...]
不要包含任何其他文字或解釋，僅返回 JSON 數組。`;
  // --- End Updated Prompt ---

  try {
    const { text } = await generateText({
      model: openai(RELATED_KEYWORDS_MODEL),
      messages: [{ role: 'user', content: prompt }]
      // Add temperature or other parameters if needed
    });

    console.log(
      `[AI Service] Received raw response from AI for related keywords.`
    );

    // Clean and parse the response
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.substring(7).trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.substring(3).trim();
    }
    if (cleanedText.endsWith('```')) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3).trim();
    }

    try {
      const parsedResult = JSON.parse(cleanedText);
      if (
        Array.isArray(parsedResult) &&
        parsedResult.every(item => typeof item === 'string')
      ) {
        console.log(
          `[AI Service] Successfully parsed ${parsedResult.length} related keywords from AI.`
        );
        return parsedResult;
      } else {
        console.error(
          '[AI Service] AI response is not a valid JSON array of strings. Parsed:',
          parsedResult
        );
        return [];
      }
    } catch (parseError) {
      console.error(
        '[AI Service] Failed to parse JSON response:',
        parseError,
        'Cleaned Text:',
        cleanedText
      );
      return [];
    }
  } catch (error) {
    console.error('[AI Service] Error calling AI for related keywords:', error);
    return [];
  }
}
