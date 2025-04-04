'use server'

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

// Define input schema for a SINGLE cluster
const inputSchema = z.object({
  clusterName: z.string().describe('要生成畫像的分群主題名稱'),
  keywords: z.array(z.string()).min(1).describe('該分群包含的關鍵詞列表'),
  model: z.enum(['gpt-4o', 'gpt-4o-mini']).default('gpt-4o-mini').optional(),
});

// Define output schema for a SINGLE persona string
const outputSchema = z.object({
  userPersona: z.string().describe('AI 基於單一關鍵詞分群生成的使用者畫像描述'),
});

/**
 * 使用 AI 根據單一關鍵詞分群生成用戶畫像
 * @param input 包含 clusterName, keywords 和可选 model 的对象
 * @returns 返回包含 userPersona 的对象或抛出错误
 */
export async function generateUserPersonaFromClusters(
  input: z.infer<typeof inputSchema>
): Promise<z.infer<typeof outputSchema>> { // Return type updated
  try {
    const validatedInput = inputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error('[Server Action] ClusteringToUserPersona 輸入驗證失敗:', validatedInput.error.flatten());
      throw new Error(validatedInput.error.errors[0]?.message || '輸入參數無效');
    }

    // Destructure validated data for a single cluster
    const { clusterName, keywords, model } = validatedInput.data;
    const openaiModel = model ?? 'gpt-4o-mini';

    console.log(`[Server Action] 收到生成用戶畫像請求: 分群='${clusterName}', 模型=${openaiModel}`);

    // Format keywords for the prompt
    const keywordString = keywords.join(', ');

    // Reverted Prompt to generate persona for the SINGLE provided cluster
    const prompt = `你是一位市場分析專家和用戶研究員。請根據以下提供的 **單一** 關鍵詞分群主題及其包含的關鍵詞，分析並描述這些搜索背後可能的用戶畫像。

分群主題: ${clusterName}
關鍵詞: ${keywordString}

請提供一個簡潔（約 100-150 字）的用戶畫像描述，涵蓋以下幾點：
1.  **主要意圖**: 搜索該主題關鍵詞的用戶可能想達成什麼目標？
2.  **知識水平**: 他們對該特定主題的了解程度大概如何？
3.  **潛在需求/痛點**: 與該主題相關，他們可能有什麼需求或痛點？
4.  **可能的背景**: 簡單推測用戶可能的職業、興趣或身份。

請直接返回用戶畫像的描述文字，不要包含任何前綴、標題或額外說明。`;

    console.log(`[Server Action] 正在發送請求到 OpenAI，模型: ${openaiModel}`);

    const { text } = await generateText({
      model: openai(openaiModel),
      prompt: prompt,
      // No need for json_object response format anymore
    });

    console.log(`[Server Action] 收到 OpenAI 生成的用戶畫像`);

    const userPersonaText = text.trim();

    if (!userPersonaText) {
        console.error('[Server Action] AI 返回了空的用戶畫像描述');
        throw new Error('AI未能生成有效的用戶畫像');
    }

    // Validate the single persona string output
    const validatedOutput = outputSchema.parse({ userPersona: userPersonaText });

    console.log(`[Server Action] 單一用戶畫像生成成功 for cluster '${clusterName}'`);
    return validatedOutput; // Return the object containing the single userPersona string

  } catch (error) {
    console.error('[Server Action] 生成用戶畫像錯誤:', error);
    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', error.flatten());
      throw new Error(`輸出格式驗證失敗: ${error.errors[0]?.message}`);
    }
    if (error instanceof Error) {
       throw error;
    } else {
       throw new Error('執行用戶畫像生成時發生未知錯誤');
    }
  }
} 