/**
 * AI Service - 提供 AI 相關的功能
 */
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const RELATED_KEYWORDS_MODEL = 'gpt-4.1-mini';

// 定義 AI 服務的輸入類型 (保持泛用性)
export interface AIServiceInput {
  keywords: string[];
  region?: string;
  language?: string;
  model?: 'gpt-4.1-mini' | 'gpt-4.1-mini'; // Keep this generic for now
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
 * Uses AI to generate related keyword suggestions based on an initial query.
 * Focuses on generating related search phrases, not just sub-terms.
 *
 * @param query The initial search query (e.g., "韓國 首爾 小吃").
 * @param region The target region (e.g., 'TW').
 * @param language The target language (e.g., 'zh-TW').
 * @param count The desired number of suggestions (default: 10).
 * @returns A promise that resolves to an array of suggested related search phrases.
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

  // --- NEW Prompt (Focus on Prefixes, Suffixes, Alternatives) ---
  const prompt = `你是一位專注於 ${region} 地區、使用 ${language} 語言市場的關鍵字變化專家。
核心關鍵字：「${query}」

任務：根據核心關鍵字「${query}」，生成大約 ${count} 個相關且有意義的搜索關鍵字變化。

請通過以下方式生成變化：
1.  **前綴 (Prefixes)**：思考可以在「${query}」**之前**添加的簡短詞語（通常1-3個字），形成一個新的、有意義的搜索詞。例如，如果核心是「蛋糕」，前綴可以是「生日」，生成「生日 蛋糕」。
2.  **後綴 (Suffixes)**：思考可以在「${query}」**之後**添加的簡短詞語（通常1-3個字），形成一個新的、有意義的搜索詞。例如，如果核心是「蛋糕」，後綴可以是「食譜」，生成「蛋糕 食譜」。
3.  **替代/同義詞 (Alternatives/Synonyms)**：思考可以**替代**「${query}」的簡短同義詞或非常相關的概念。例如，如果核心是「蛋糕」，替代詞可以是「甜點」。

**組合與輸出：**
*   將生成的前綴和後綴與核心關鍵字「${query}」組合起來，形成完整的關鍵字（例如：「前綴 ${query}」，「${query} 後綴」）。
*   直接包含生成的替代/同義詞。
*   確保生成的關鍵字是人們實際可能搜索的自然詞語。
*   優先考慮簡短、常用的修飾詞。
*   避免過於冗長或複雜的添加。

請將最終生成的 **${count} 個獨特** 關鍵字變化以 JSON 數組的格式返回。數組中應只包含最終的關鍵字字符串。
例如對於核心關鍵字「妝容」，最終輸出可能像：
["萬聖節 妝容", "日常 妝容", "化妝教學", "妝容 推薦", "派對 妝容", "淡妝 妝容", ...]

不要包含任何其他文字或解釋，僅返回 JSON 數組。`;
  // --- End NEW Prompt ---

  try {
    const { text } = await generateText({
      model: openai(RELATED_KEYWORDS_MODEL),
      messages: [{ role: 'user', content: prompt }]
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
