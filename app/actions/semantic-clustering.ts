'use server'

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

// 定义分群结果的 schema
const clusterSchema = z.object({
  clusters: z.record(z.string(), z.array(z.string()))
    .describe('主題名稱映射到關鍵字數組的分群結果'),
});

// 定义输入 schema (可选，但推荐)
const inputSchema = z.object({
  keywords: z.array(z.string()).min(5, '至少需要5个关键词进行分群'),
  model: z.enum(['gpt-4o', 'gpt-4o-mini']).default('gpt-4o-mini').optional(),
  // historyId: z.string().optional(), // 暂时不需要 historyId
});

/**
 * 使用 AI 执行语义聚类
 * @param input 包含 keywords 和可选 model 的对象
 * @returns 返回聚类结果或抛出错误
 */
export async function performSemanticClustering(input: { keywords: string[], model?: 'gpt-4o' | 'gpt-4o-mini' }) {
  try {
    // 验证输入
    const validatedInput = inputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error('[Server Action] 輸入驗證失敗:', validatedInput.error.flatten());
      // 将 Zod 错误转换为更友好的消息或直接抛出第一个错误
      throw new Error(validatedInput.error.errors[0]?.message || '輸入參數無效');
    }
    
    const { keywords, model } = validatedInput.data;
    // 即使有 default，類型推斷仍可能為 undefined，在此明確處理
    const openaiModel = model ?? 'gpt-4o-mini'; // 如果 model 是 undefined，使ㄏ用預設值
    
    console.log(`[Server Action] 收到語意分群請求: 模型=${openaiModel}, 關鍵字數量=${keywords.length}`);
    
    // Limit number of keywords to prevent large requests
    const MAX_CLUSTERING_KEYWORDS = 80; // 与原 API Route 保持一致
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    if (limitedKeywords.length < keywords.length) {
      console.log(`[Server Action] 關鍵字數量已限制: ${keywords.length} → ${limitedKeywords.length}`);
    }
    
    console.log(`[Server Action] 前幾個關鍵字: "${limitedKeywords.slice(0, 3).join('", "')}", ...`);

    // 使用更明確的提示 (与原 API Route 保持一致)
    const prompt = `你是一個專業的關鍵字分群專家。請根據以下關鍵字進行語意分群，將相關的關鍵字歸類到合適的主題中。

語意辨識的方法是根據能否放到同一篇文章作為列表文章(listicle)的依據，不是以 SEO 為主。避免使用"基本知識"這種過於概括的詞分群。

關鍵字列表：
${limitedKeywords.join(', ')}

請將關鍵字分群並返回一個 JSON 對象，格式如下：
{
  "clusters": {
    "主題名稱1": ["關鍵字1", "關鍵字2", ...],
    "主題名稱2": ["關鍵字3", "關鍵字4", ...]
  }
}

注意事項：
1. 每個主題名稱應該簡潔明確
2. 每個分群至少包含 2 個關鍵字
3. 確保返回的是有效的 JSON 格式
4. 不要添加任何額外的說明文字，只返回 JSON 對象`;

    console.log(`[Server Action] 正在發送請求到 OpenAI，模型: ${openaiModel}, 關鍵字數量: ${limitedKeywords.length}`);
    
    // 使用 generateText 获取完整结果
    const { text } = await generateText({
      model: openai(openaiModel), // 使用确保非 undefined 的模型名称
      messages: [
        { role: "system", content: prompt }
      ]
      // 注意：Server Action 中没有直接的 maxDuration 配置，执行时间依赖 Vercel 平台限制
    });
    
    console.log(`[Server Action] 收到 OpenAI 完整結果`); // 避免打印可能很大的 text

    // 清理 AI 返回的文本，移除可能的 Markdown 代码块标记
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.substring(7).trim(); // 移除 ```json 并再次 trim
    } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.substring(3).trim(); // 移除 ``` 并再次 trim
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3).trim(); // 移除末尾的 ``` 并再次 trim
    }

    try {
      // 尝试解析清理后的 JSON
      const result = JSON.parse(cleanedText);
      // console.log(`[Server Action] 解析後的結果:`, JSON.stringify(result, null, 2)); // 调试时可取消注释
      
      // 验证结果格式
      const validatedResult = clusterSchema.parse(result);
      console.log(`[Server Action] 分群結果驗證成功`);
      
      // 返回验证后的结果
      return validatedResult;
      
    } catch (parseError) {
      console.error('[Server Action] JSON 解析錯誤:', parseError, '清理前的原始文本:', text, '清理後的文本:', cleanedText); // 记录原始和清理后的文本
      throw new Error('無法解析 AI 返回的 JSON 格式');
    }
  } catch (error) {
    console.error('[Server Action] 語意分群錯誤:', error);
    // 抛出原始错误或更具体的错误类型
    if (error instanceof Error) {
       throw error; // 重新抛出原始错误，保留堆栈信息
    } else {
       throw new Error('執行語意分群時發生未知錯誤');
    }
  }
} 