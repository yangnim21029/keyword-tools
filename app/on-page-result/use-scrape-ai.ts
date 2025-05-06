'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Ensure the OpenAI API key is set in environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('FATAL ERROR: OPENAI_API_KEY environment variable is not set.');
  // In a real app, you might throw an error or handle this more gracefully
  // For now, we log the error. The function will fail if called without a key.
}

/**
 * Processes a keyword and reference content through multiple AI steps
 * to generate a structured outline based on the reference.
 *
 * NOTE: This function assumes the referenceContent is already scraped
 * from the relevant source (e.g., the top SERP result).
 *
 * @param keyword The target keyword for the analysis.
 * @param referenceContent The scraped text content from the reference source.
 * @returns A Promise resolving to the final generated outline string, or throws an error.
 */
export async function generateQuestionsFromReference(
  keyword: string,
  referenceContent: string
): Promise<string> {
  console.log(
    `[AI Analysis] Starting outline generation for keyword: "${keyword}"`
  );

  // Ensure API key is available before proceeding
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured.');
  }

  // Initialize OpenAI client (consider doing this outside if called frequently)
  // Using the environment variable is handled by the ai sdk setup typically
  const aiClient = openai;

  try {
    // --- Step 1: Create Initial H2 Outline/Content ---
    // Python used: gpt-4o-search-preview
    console.log('[AI Analysis] Step 1: Generating initial content...');
    const step1Prompt = `
keyword: ${keyword}

搜尋類似內容：『 ${referenceContent}』

並給我文章目錄
`;
    const { text: step1Output } = await generateText({
      model: aiClient('gpt-4o-search-preview'), // Reverted to match Python script
      prompt: step1Prompt
    });
    console.log('[AI Analysis] Step 1 completed.');
    // console.log("[AI Analysis] Step 1 Output:\n", step1Output);

    // --- Step 3: Identify Replaceable Content with Alt Text ---
    // Python used: gpt-4.1-mini
    console.log('[AI Analysis] Step 3: Identifying replaceable content...');
    const step3Prompt = `
${step1Output} + 來源：${referenceContent}

在以上文章中。找尋可以用其他媒體形式（文字或圖片等不同結構），直接取代的句子，
並直接在文章中，寫入 [...] 這種 alt text 去置入替換

alt text 應該與 ${keyword} 有關，並且能夠讓人理解

例如：[布偶貓頭部特徵圖示：圓潤頭部、藍色眼睛、微彎鼻子及中等大小耳朵]

只需要給我置入後的文章，其他不用
`;
    const { text: step3Output } = await generateText({
      model: aiClient('gpt-4.1-mini'), // Reverted to match Python script
      prompt: step3Prompt
    });
    console.log('[AI Analysis] Step 3 completed.');
    // console.log("[AI Analysis] Step 3 Output:\n", step3Output);

    // --- Step 4: Extract Alt Text as List ---
    // Python used: gpt-4.1-mini
    console.log('[AI Analysis] Step 4: Extracting alt text...');
    const step4Prompt = `
將 alt text 抓出來，變成清單放在頂部 ，其他（正文）可以刪掉

Input:
${step3Output}
`;
    const { text: step4Output } = await generateText({
      model: aiClient('gpt-4.1-mini'), // Reverted to match Python script
      prompt: step4Prompt
    });
    console.log('[AI Analysis] Step 4 completed.');
    // console.log("[AI Analysis] Step 4 Output:\n", step4Output);

    // --- Step 5: Convert Alt Text List to H2/H3 Outline ---
    // Python used: gpt-4.1-mini
    console.log('[AI Analysis] Step 5: Refining outline from alt text...');
    const step5Prompt = `
Input:
${step4Output}

將 alt text 改寫成 合適的 h2 與 h3 目錄
過濾掉不適合 SEO 的部分
關鍵字：${keyword}
`;
    const { text: step5Output } = await generateText({
      model: aiClient('gpt-4.1-mini'), // Reverted to match Python script
      prompt: step5Prompt
    });
    console.log('[AI Analysis] Step 5 completed. Final Outline generated.');
    // console.log("[AI Analysis] Step 5 Output (Final Outline):\n", step5Output);

    return step5Output; // Return the final outline
  } catch (error) {
    console.error(
      '[AI Analysis] Error during outline generation pipeline:',
      error
    );
    throw new Error(
      `AI analysis pipeline failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
