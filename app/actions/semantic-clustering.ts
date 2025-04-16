'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

// Import necessary actions and types from keyword-research
// Note: Ensure these are exported from keyword-research.ts
import {
  fetchKeywordResearchDetail,
  revalidateKeywordResearchCache, // Renamed from revalidateResearch
  updateKeywordResearchClusters
} from '@/app/actions/keyword-research'; // Adjust path if needed
import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import type { KeywordVolumeItem } from '@/lib/schema';

// 定义分群结果的 schema
const clusterSchema = z.object({
  clusters: z
    .record(z.string(), z.array(z.string()))
    .describe('主題名稱映射到關鍵字數組的分群結果')
});

// 定义输入 schema (可选，但推荐)
const inputSchema = z.object({
  keywords: z.array(z.string()).min(5, '至少需要5个关键词进行分群'),
  model: z.enum(['gpt-4o', 'gpt-4o-mini']).default('gpt-4o-mini').optional()
  // historyId: z.string().optional(), // 暂时不需要 historyId
});

/**
 * 使用 AI 执行语义聚类
 * @param input 包含 keywords 和可选 model 的对象
 * @returns 返回聚类结果或抛出错误
 */
export async function performSemanticClusteringAI(input: {
  keywords: string[];
  model?: 'gpt-4o' | 'gpt-4o-mini';
}) {
  try {
    // 验证输入
    const validatedInput = inputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error(
        '[Server Action] 輸入驗證失敗:',
        validatedInput.error.flatten()
      );
      // 将 Zod 错误转换为更友好的消息或直接抛出第一个错误
      throw new Error(
        validatedInput.error.errors[0]?.message || '輸入參數無效'
      );
    }

    const { keywords, model } = validatedInput.data;
    // 即使有 default，類型推斷仍可能為 undefined，在此明確處理
    const openaiModel = model ?? 'gpt-4o-mini'; // 如果 model 是 undefined，使ㄏ用預設值

    console.log(
      `[Server Action] 收到語意分群請求: 模型=${openaiModel}, 關鍵字數量=${keywords.length}`
    );

    // Limit number of keywords to prevent large requests
    const MAX_CLUSTERING_KEYWORDS = 80; // 与原 API Route 保持一致
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    if (limitedKeywords.length < keywords.length) {
      console.log(
        `[Server Action] 關鍵字數量已限制: ${keywords.length} → ${limitedKeywords.length}`
      );
    }

    console.log(
      `[Server Action] 前幾個關鍵字: "${limitedKeywords
        .slice(0, 3)
        .join('", "')}", ...`
    );

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

    console.log(
      `[Server Action] 正在發送請求到 OpenAI，模型: ${openaiModel}, 關鍵字數量: ${limitedKeywords.length}`
    );

    // 使用 generateText 获取完整结果
    const { text } = await generateText({
      model: openai(openaiModel), // 使用确保非 undefined 的模型名称
      messages: [{ role: 'system', content: prompt }]
      // 注意：Server Action 中没有直接的 maxDuration 配置，执行时间依赖 Vercel 平台限制
    });

    console.log(`[Server Action] 收到 OpenAI 完整結果`); // 避免打印可能很大的 text

    // 清理 AI 返回的文本，移除可能的 Markdown 代码块标记
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.substring(7).trim(); // 移除 ```json 并再次 trim
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.substring(3).trim(); // 移除 ``` 并再次 trim
    }
    if (cleanedText.endsWith('```')) {
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
      console.error(
        '[Server Action] JSON 解析錯誤:',
        parseError,
        '清理前的原始文本:',
        text,
        '清理後的文本:',
        cleanedText
      ); // 记录原始和清理后的文本
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

// --- Helper Function: Prepare Keywords ---
/**
 * Fetches keywords for clustering. Assumes deduplication and count validation are handled elsewhere.
 * @param researchId The ID of the Keyword Research item.
 * @returns Object indicating success, prepared keywords (string[] or null if error), or an error message.
 * @private Internal helper function.
 */
async function _prepareKeywordsForClustering(
  researchId: string
): Promise<{ success: boolean; keywords: string[] | null; error?: string }> {
  if (!db) {
    console.error('[Clustering Prep] Database not initialized');
    return {
      success: false,
      keywords: null,
      error: 'Database not initialized'
    };
  }
  if (!researchId) {
    console.warn('[Clustering Prep] Research ID is required');
    return { success: false, keywords: null, error: 'Research ID is required' };
  }

  try {
    // Check document existence first (optional but good practice)
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.warn(`[Clustering Prep] Document not found: ${researchId}`);
      return {
        success: false,
        keywords: null,
        error: 'Research item not found.'
      };
    }

    // Fetch details (handles cache internally)
    console.log(`[Clustering Prep] Fetching keywords for ${researchId}`);
    const researchDetail = await fetchKeywordResearchDetail(researchId);
    if (
      !researchDetail ||
      !researchDetail.keywords ||
      researchDetail.keywords.length === 0
    ) {
      console.log(`[Clustering Prep] No keywords found for ${researchId}.`);
      // Successfully checked, but no keywords found. Return empty array.
      return { success: true, keywords: [] };
    }

    // Prepare final keyword texts directly from fetched data
    // Filter out any potential null/undefined texts just in case
    const keywordTexts = (researchDetail.keywords as KeywordVolumeItem[])
      .map(kw => kw.text)
      .filter((text): text is string => !!text);

    console.log(
      `[Clustering Prep] Found ${keywordTexts.length} keywords for ${researchId}.`
    );
    return { success: true, keywords: keywordTexts };
  } catch (error) {
    console.error(`[Clustering Prep] Failed for ${researchId}:`, error);
    const message =
      error instanceof Error ? error.message : 'Keyword preparation failed.';
    return { success: false, keywords: null, error: message };
  }
}

// --- Helper Function: Save Results & Revalidate ---
/**
 * Saves the clustering results to the database and revalidates the cache.
 * Handles the case where no clusters were generated.
 * @param researchId The ID of the Keyword Research item.
 * @param clusters The generated clusters.
 * @returns Object indicating success or failure.
 * @private Internal helper function.
 */
async function _saveClusteringResults(
  researchId: string,
  clusters: Record<string, string[]>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (Object.keys(clusters).length === 0) {
      console.log(
        `[Clustering Save] No clusters generated by AI for ${researchId}. Skipping save.`
      );
      // Still revalidate even if no clusters were saved to ensure data consistency
      await revalidateKeywordResearchCache(researchId);
      return { success: true }; // Successfully handled the "no clusters" case
    }

    console.log(
      `[Clustering Save] Saving ${
        Object.keys(clusters).length
      } clusters for ${researchId}`
    );
    const updateResult = await updateKeywordResearchClusters(researchId, {
      clusters,
      updatedAt: new Date() // Placeholder, actual value set in update action
    });
    if (!updateResult.success) {
      // Propagate error from the update action
      throw new Error(
        updateResult.error ||
          'Failed to save clusters via updateKeywordResearchClusters'
      );
    }

    // Revalidate *after* successful save
    await revalidateKeywordResearchCache(researchId);

    return { success: true };
  } catch (error) {
    console.error(`[Clustering Save] Failed for ${researchId}:`, error);
    // Attempt revalidation even on save failure, as state might be inconsistent.
    await _attemptRevalidationOnError(researchId, 'save failure');
    const message =
      error instanceof Error
        ? error.message
        : 'Saving clustering results failed.';
    return { success: false, error: message };
  }
}

// --- Helper Function: Attempt Revalidation On Error ---
/**
 * Attempts to revalidate the cache for a given researchId, logging any errors.
 * Used in error handling paths.
 * @param researchId The ID of the Keyword Research item.
 * @param context A string describing the context of the error (e.g., 'AI failure').
 * @private Internal helper function.
 */
async function _attemptRevalidationOnError(
  researchId: string,
  context: string
): Promise<void> {
  try {
    console.warn(
      `[Clustering Action] Attempting cache revalidation for ${researchId} after ${context}.`
    );
    await revalidateKeywordResearchCache(researchId);
  } catch (revalError) {
    // Log critical failure but don't let it stop the main error flow
    console.error(
      `[Clustering Action] CRITICAL: Failed to revalidate cache for ${researchId} after ${context}:`,
      revalError
    );
  }
}

/**
 * Requests and executes the keyword clustering process for a specific research item.
 * Orchestrates fetching/preparing keywords, calling AI, saving results, and cache revalidation.
 *
 * @param researchId The ID of the Keyword Research item.
 * @returns Object indicating success or failure.
 */
export async function requestClustering(
  researchId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `[Clustering Action] requestClustering started for researchId: ${researchId}`
  );

  try {
    // 1. Prepare Keywords (Fetch only)
    const prepResult = await _prepareKeywordsForClustering(researchId);
    if (!prepResult.success) {
      // Error already logged by helper
      return { success: false, error: prepResult.error };
    }
    // If preparation was successful but returned no keywords (empty array),
    // it means no keywords were found in the source document.
    if (!prepResult.keywords || prepResult.keywords.length === 0) {
      console.log(
        `[Clustering Action] No keywords found for ${researchId}. Process finished.`
      );
      // No need to save or revalidate further as nothing changed.
      return { success: true }; // Successfully determined no action needed.
    }

    // 2. Perform Clustering (Call AI)
    let clusteringResult;
    try {
      // Logging for AI call start/end is inside performSemanticClusteringAI
      clusteringResult = await performSemanticClusteringAI({
        keywords: prepResult.keywords
      });
    } catch (aiError) {
      console.error(
        `[Clustering Action] AI Clustering failed for ${researchId}:`,
        aiError
      );
      await _attemptRevalidationOnError(researchId, 'AI failure'); // Attempt revalidation on AI error
      const message =
        aiError instanceof Error ? aiError.message : 'AI clustering failed.';
      return { success: false, error: message };
    }

    // 3. Save Results & Revalidate Cache
    const saveResult = await _saveClusteringResults(
      researchId,
      clusteringResult.clusters
    );
    if (!saveResult.success) {
      // Error logging and revalidation attempt handled within the save helper
      return { success: false, error: saveResult.error };
    }

    // 4. Final Success Log
    console.log(
      `[Clustering Action] Clustering completed successfully for ${researchId}.`
    );
    return { success: true };
  } catch (error) {
    // Catch unexpected errors during the orchestration logic itself
    console.error(
      `[Clustering Action] Unexpected error during clustering process for ${researchId}:`,
      error
    );
    await _attemptRevalidationOnError(researchId, 'unexpected error'); // Attempt revalidation
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}
