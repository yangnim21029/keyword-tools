'use server';

import { openai } from '@ai-sdk/openai'; // Vercel AI SDK - OpenAI Provider
import { generateText } from 'ai'; // Vercel AI SDK - Core

// Check for OpenAI API Key
if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY environment variable is not set. AI calls will likely fail.");
}

interface ContentSuggestions {
  simpleExplanation: string;
  informationGathering: string;
  comparisonTableMarkdown: string; // Using Markdown for table format
  articleQualityNotes: string;
  experienceDetails: {
    why: string;
    when: string;
    where: string;
  };
  chronologyNotes: string;
  anecdotalStyleNotes: string;
  conclusionSuggestion: string;
  // Add raw AI response for debugging if needed
  // rawResponse?: string;
}

interface GenerateContentSuggestionsParams {
  keyword: string;
}

/**
 * Generates structured content suggestions based on a keyword using an AI model via Vercel AI SDK.
 */
export async function generateContentSuggestionsAction(
  params: GenerateContentSuggestionsParams
): Promise<ContentSuggestions> {
  const { keyword } = params;

  if (!keyword) {
    throw new Error('Keyword is required.');
  }

  // --- Construct the AI Prompt ---
  // Using Traditional Chinese as requested in the output structure description
  const prompt = `
基於關鍵字「${keyword}」，請生成內容創作建議，包含以下結構：

1.  **簡單說明**：針對「${keyword}」相關比較的商品或主題，提供一段簡短清晰的說明。
2.  **資訊收集**：解釋你是如何或可以如何收集與「${keyword}」相關的資訊來撰寫內容。
3.  **比較表**：創建一個Markdown格式的比較表，比較與「${keyword}」相關的幾個關鍵方面（如果適用）。如果比較表不適用，請說明原因。
4.  **文章品質**：加入提示，說明如何使文章字數充足且立場客觀，以獲得讀者好評。
5.  **經驗細節**：
    *   具體說明為什麼作者可以分享關於「${keyword}」的經驗。
    *   建議提及是何時、何地獲得這些經驗的。
6.  **時序建議**：提示作者可以試著依照時序來組織內容。
7.  **趣聞風格**：建議作者可以嘗試用描述趣聞的方式寫作，增加趣味性。
8.  **結論感想**：建議作者在結論中加入自己的感想，使文章更有效果。

請確保輸出是一個JSON對象，其鍵值如下：
"simpleExplanation": "...",
"informationGathering": "...",
"comparisonTableMarkdown": "...",
"articleQualityNotes": "...",
"experienceDetails": { "why": "...", "when": "...", "where": "..." },
"chronologyNotes": "...",
"anecdotalStyleNotes": "...",
"conclusionSuggestion": "..."

如果無法生成某部分，請在對應的值中說明原因。
`;

  console.log(`Generating content suggestions for keyword: ${keyword}`);
  console.log("Prompt length:", prompt.length); // Log prompt length, useful for debugging limits

  try {
    // --- Actual AI Call using Vercel AI SDK ---
    const { text } = await generateText({
        // You can change the model ID if needed (e.g., 'gpt-4-turbo', 'gpt-3.5-turbo')
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        // Consider adding parameters like temperature, max_tokens if needed
        // temperature: 0.7,
        // maxTokens: 1024,
    });
    // --- End AI Call ---

    console.log("Raw AI Response Text:", text);

    // --- Parse the AI Response ---
    // Attempt to parse the text response as JSON.
    // The AI should ideally return a clean JSON string based on the prompt.
    let suggestions: ContentSuggestions;
    try {
        // Sometimes the AI might wrap the JSON in markdown ```json ... ```
        const jsonString = text.replace(/^```json\s*|```$/g, '').trim();
        suggestions = JSON.parse(jsonString);

        // Basic validation (optional, but recommended)
        if (typeof suggestions.simpleExplanation !== 'string' ||
            typeof suggestions.informationGathering !== 'string' ||
            typeof suggestions.comparisonTableMarkdown !== 'string' ||
            typeof suggestions.articleQualityNotes !== 'string' ||
            // Ensure experienceDetails exists before accessing its properties
            typeof suggestions.experienceDetails !== 'object' ||
            suggestions.experienceDetails === null || // Check for null
            typeof suggestions.experienceDetails.why !== 'string' ||
            typeof suggestions.experienceDetails.when !== 'string' ||
            typeof suggestions.experienceDetails.where !== 'string' ||
            typeof suggestions.chronologyNotes !== 'string' ||
            typeof suggestions.anecdotalStyleNotes !== 'string' ||
            typeof suggestions.conclusionSuggestion !== 'string') {
            throw new Error("AI response is missing required fields or has incorrect types.");
        }

    } catch (parseError: any) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("Raw text that failed parsing:", text);
      // Throw a more specific error if parsing fails
      throw new Error(`AI response was not valid JSON or did not match the expected structure. ${parseError.message}`);
    }
    // --- END Parsing ---

    console.log("Parsed Suggestions:", suggestions);
    return suggestions;

  } catch (error) {
    console.error('Error generating content suggestions:', error);
    // Provide a more informative error message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during AI suggestion generation.';
    throw new Error(`Failed to generate content suggestions for "${keyword}". Reason: ${errorMessage}`);
  }
}
