'use server';

import { openai } from '@ai-sdk/openai'; // Vercel AI SDK - OpenAI Provider
import { generateText } from 'ai'; // Vercel AI SDK - Core
import { SERP_ANALYSIS_MODELS } from '../global-config';

// Check for OpenAI API Key
if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY environment variable is not set. AI calls will likely fail.");
}

interface GenerateContentSuggestionsParams {
  keyword: string;
}

/**
 * Generates structured content suggestions based on a keyword using an AI model
 * via Vercel AI SDK and returns them as a formatted string.
 */
export async function generateContentSuggestionsAction(
  params: GenerateContentSuggestionsParams
): Promise<string> {
  const { keyword } = params;

  if (!keyword) {
    throw new Error('Keyword is required.');
  }

  // --- Construct the AI Prompt (Now asking for text list) ---
  const prompt = `
基於關鍵字「${keyword}」，請生成一份內容創作建議清單，包含以下要點：

*   針對「${keyword}」相關主題，提供一段簡短清晰的說明。
*   解釋可以如何收集與「${keyword}」相關的資訊。
*   如果適合，創建一個Markdown格式的比較表，比較與「${keyword}」相關的關鍵方面；若不適合，請說明原因。
*   說明如何使文章字數充足且立場客觀，以獲得讀者好評。
*   具體說明作者為何能分享「${keyword}」的經驗，以及是何時何地獲得這些經驗。
*   建議依照時序組織內容。
*   建議嘗試用描述趣聞的方式寫作。
*   建議在結論中加入作者自己的感想。
*   (若主題涉及比較) 提示需適度解釋比較對象的特徵與差異。
*   (若主題涉及比較) 提示需假設讀者為初學者。

請直接輸出這份建議清單，使用項目符號或類似的格式，無需使用JSON。
`;

  console.log(`Generating content suggestions for keyword: ${keyword}`);

  try {
    // --- Actual AI Call --- 
    const { text } = await generateText({
      model: SERP_ANALYSIS_MODELS.BASE,
      prompt: prompt
    });
    console.log("Raw AI Response Text (Expected List):", text);

    // --- Removed JSON Parsing and Formatting --- 
    // No need to parse JSON anymore.
    // The raw text is assumed to be the desired formatted list.

    return text; // RETURN THE RAW TEXT FROM AI

  } catch (error) {
    console.error('Error generating content suggestions:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during AI suggestion generation.';
    throw new Error(`Failed to generate content suggestions for "${keyword}". Reason: ${errorMessage}`);
  }
}
