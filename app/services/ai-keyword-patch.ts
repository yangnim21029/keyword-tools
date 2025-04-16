/**
 * AI Service - 提供 AI 相關的功能
 */
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const RELATED_KEYWORDS_MODEL = 'gpt-o3-mini';

// 定義 AI 服務的輸入類型 (保持泛用性)
export interface AIServiceInput {
  keywords: string[];
  region?: string;
  language?: string;
  model?: 'gpt-4.1-mini' | 'gpt-o3-mini'; // Keep this generic for now
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

  // --- Updated Prompt (Focus on Related Phrases) ---
  const prompt = `你是一位專業的關鍵字研究專家，專注於 ${region} 地區、使用 ${language} 語言的市場。
核心查詢概念：「${query}」

任務：請將以上「核心查詢概念」視為一個**整體**來分析。
生成大約 ${count} 個用戶在搜索「${query}」之後，**可能也會感興趣並搜索的其他相關查詢短語或主題**。

**重要指示：**
1.  **關注相關性**：生成的短語需要與「${query}」這個**完整概念**高度相關。
2.  **生成完整短語**：優先生成具有獨立搜索意義的短語或主題，而不僅僅是同義詞。
3.  **禁止提取子詞**：**絕對不要**僅僅提取「${query}」中的某個單詞作為結果。例如，如果輸入是「韓國 首爾 小吃」，你不應該只輸出「小吃」或「首爾」。
4.  **目標搜索詞**：想像一個用戶搜了「${query}」，他接下來還可能搜什麼？例如，對於「韓國 首爾 小吃」，好的相關查詢可能是「明洞 美食推薦」、「廣藏市場 必吃」、「首爾 街頭小吃」。
5.  **多樣性**：如果可能，提供不同角度的相關查詢（例如地點、具體食物種類、體驗類型）。

請將生成的相關查詢短語以 JSON 數組的格式返回，例如：["明洞 美食推薦", "廣藏市場 必吃", "首爾 街頭小吃", ...]
不要包含任何其他文字或解釋，僅返回 JSON 數組。`;
  // --- End Updated Prompt ---

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
