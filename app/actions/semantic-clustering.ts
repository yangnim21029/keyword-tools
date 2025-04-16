'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
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

// Input for the main AI function
const aiInputSchema = z.object({
  keywords: z.array(z.string()).min(5, '至少需要5个关键词进行分群'),
  model: z.enum(['gpt-4.1-mini', 'gpt-4o']).default('gpt-4.1-mini').optional() // Updated model list
});

// Schema for the final JSON output (clusters)
const clusterOutputSchema = z.object({
  clusters: z
    .record(z.string(), z.array(z.string()))
    .describe('主題名稱映射到關鍵字數組的分群結果')
});

// --- Prompts ---

/**
 * Generates the prompt for the initial text generation step (Markdown output).
 */
const getClusteringTextPrompt = (
  keywords: string[],
  modelName: string // Pass model name for logging/context if needed
) => `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided keywords based *only* on the instructions that follow and generate output in the *exact* format specified.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Assume the persona of an expert keyword clustering specialist.
2.  **Input Data:** Base your entire analysis strictly on the provided keyword list. Do NOT use external knowledge or assumptions.
3.  **Output Format:** Generate your response *exclusively* in the Markdown format specified below. Each cluster should start with '## Cluster: [主題名稱]' followed by a bulleted list of keywords.
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.
    *   Do NOT engage in conversation or ask clarifying questions.
    *   Do NOT use markdown formatting (like \`\`\`) around the final output block.
    *   Group keywords semantically based on whether they could be targetted by the same listicle-style article.
    *   Avoid overly generic cluster names like "基本知識".
    *   Each cluster must contain at least 2 keywords.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---

Based *only* on the keywords provided below, perform semantic clustering. 

Keywords:
${keywords.join(', ')}

Output Format Example:
## Cluster: 主題名稱1
- 關鍵字1
- 關鍵字2

## Cluster: 主題名稱2
- 關鍵字3
- 關鍵字4

Respond ONLY with the Markdown content following the specified format.`;

/**
 * Generates the prompt for converting the Markdown text output to JSON.
 */
const getClusteringConversionPrompt = (
  markdownText: string
) => `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided Markdown text, which represents keyword clusters, into the *exact* JSON format specified, using *only* the information present in the input Markdown.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Act as a data conversion bot.
2.  **Input Data:** Use *only* the provided Markdown text.
3.  **Output Format:** Generate *only* a valid JSON object matching the structure: { "clusters": { "主題名稱": ["關鍵字1", ...] } }
4.  **Behavior:**
    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.
    *   Do NOT interpret or analyze the data beyond extracting it into the JSON structure.
    *   Extract the cluster name from the '## Cluster: ' lines.
    *   Extract the keywords from the bullet points under each cluster name.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---

Input Markdown Text:
\`\`\`markdown
${markdownText}
\`\`\`

Convert this Markdown into the following JSON structure:
{
  "clusters": {
    "主題名稱1": ["關鍵字1", "關鍵字2", ...],
    "主題名稱2": ["關鍵字3", "關鍵字4", ...]
  }
}

Respond ONLY with the valid JSON object.`;

/**
 * Uses a two-step AI process: generate text (Markdown), then convert text to JSON.
 * @param input Contains keywords and optional model.
 * @returns The validated JSON clustering result.
 */
export async function performSemanticClusteringAI(
  input: z.infer<typeof aiInputSchema>
): Promise<z.infer<typeof clusterOutputSchema>> {
  try {
    const validatedInput = aiInputSchema.parse(input); // Use parse, throws on error
    const { keywords, model } = validatedInput;
    const openaiModel = model ?? 'gpt-4.1-mini';

    console.log(
      `[Server Action] Clustering Step 1: Requesting Text Generation. Model=${openaiModel}, Keywords=${keywords.length}`
    );

    const MAX_CLUSTERING_KEYWORDS = 80;
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    if (limitedKeywords.length < keywords.length) {
      console.log(
        `[Server Action] Keyword count limited: ${keywords.length} -> ${limitedKeywords.length}`
      );
    }

    // --- Step 1: Generate Text (Markdown) ---
    const textPrompt = getClusteringTextPrompt(limitedKeywords, openaiModel);
    console.log('[AI Call] Calling AI for Clustering Text Generation...');
    const { text: rawMarkdown } = await generateText({
      model: openai(openaiModel),
      prompt: textPrompt
    });
    console.log('[Server Action] Clustering Step 1: Received raw text result.');

    if (!rawMarkdown || rawMarkdown.trim().length === 0) {
      console.error(
        '[Server Action] AI returned empty or whitespace-only text for clustering.'
      );
      throw new Error('AI failed to generate clustering text.');
    }

    // --- Step 2: Convert Text to JSON ---
    console.log(
      `[Server Action] Clustering Step 2: Requesting JSON Conversion. Model=${openaiModel}`
    );
    const conversionPrompt = getClusteringConversionPrompt(rawMarkdown.trim());
    console.log('[AI Call] Calling AI for Clustering JSON Conversion...');
    const { object: jsonResult } = await generateObject({
      model: openai(openaiModel),
      schema: clusterOutputSchema, // Use the defined Zod schema
      prompt: conversionPrompt
    });

    console.log(
      '[Server Action] Clustering Step 2: Received and validated JSON result.'
    );

    // The result from generateObject is already validated against the schema
    return jsonResult;
  } catch (error) {
    console.error('[Server Action] Semantic Clustering AI Error:', error);
    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', error.flatten());
      throw new Error(`Data validation failed: ${error.errors[0]?.message}`);
    }
    if (error instanceof Error) {
      throw error; // Re-throw original error
    } else {
      throw new Error('Unknown error during semantic clustering AI process.');
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
    let clusteringResult: z.infer<typeof clusterOutputSchema>;
    try {
      clusteringResult = await performSemanticClusteringAI({
        keywords: prepResult.keywords
      });
    } catch (aiError) {
      console.error(
        `[Clustering Action] AI Clustering failed for ${researchId}:`,
        aiError
      );
      await _attemptRevalidationOnError(researchId, 'AI failure');
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
    await _attemptRevalidationOnError(researchId, 'unexpected error');
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}
