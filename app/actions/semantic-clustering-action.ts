'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Import necessary actions and types from keyword-research
// Note: Ensure these are exported from keyword-research.ts
import {
  revalidateKeywordResearch,
} from '@/app/actions/keyword-volume-action'; // Adjust path if needed
import { 
  // Import the NEW DB service function
  updateKeywordResearchClustersWithVolume, 
  getKeywordResearchDetail // Import for getting raw data
} from '@/app/services/firebase/db-keyword-research'; 
import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import type { KeywordVolumeItem, ClusterItem, KeywordResearchItem } from '@/app/services/firebase/types';

// Input for the main AI function
const aiInputSchema = z.object({
  keywords: z.array(z.string()).min(5, '至少需要5个关键词进行分群'),
  model: z
    .enum(['gpt-4.1-mini', 'gpt-4.1-mini'])
    .default('gpt-4.1-mini')
    .optional() // Updated model list
});

// Schema for the RAW AI output (Record<string, string[]>)
const rawClusterOutputSchema = z.object({
  clusters: z
    .record(z.string(), z.array(z.string()))
    .describe('Raw AI output: cluster name mapped to keyword text array')
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
3.  **Output Format:** Generate your response *exclusively* in the Markdown format specified below. Each cluster should start with '## Cluster: [主題名稱]' followed by a bulleted list of keywords using '- '.
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.
    *   Do NOT engage in conversation or ask clarifying questions.
    *   Do NOT use markdown formatting (like \`\`\` or \`\`\`markdown) around the final output block.
    *   Group keywords semantically based on whether they could be targetted by the same listicle-style article.
    *   Avoid overly generic cluster names like "基本知識".
    *   Each cluster must contain at least 2 keywords.
    *   Ensure every keyword from the input list is assigned to exactly one cluster.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---

Based *only* on the keywords provided below, perform semantic clustering.

Keywords:
${keywords.join(', ')}

Output Format Example (MUST follow this structure exactly):
## Cluster: 主題名稱1
- 關鍵字1
- 關鍵字2

## Cluster: 主題名稱2
- 關鍵字3
- 關鍵字4

Respond ONLY with the Markdown content following the specified format, starting directly with the first '## Cluster:' line and ending after the last keyword of the last cluster.`;

/**
 * Generates the prompt for converting the Markdown text output to JSON.
 */
const getClusteringConversionPrompt = (
  markdownText: string
) => `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided Markdown text, which represents keyword clusters, into the *exact* JSON format specified, using *only* the information present in the input Markdown.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Act as a data conversion bot.
2.  **Input Data:** Use *only* the provided Markdown text. The text strictly follows the format:
    \`\`\`
    ## Cluster: [Cluster Name 1]
    - Keyword1
    - Keyword2
    ## Cluster: [Cluster Name 2]
    - Keyword3
    - Keyword4
    ...
    \`\`\`
3.  **Output Format:** Generate *only* a valid JSON object matching the structure: { "clusters": { "[Cluster Name]": ["Keyword1", "Keyword2", ...] } }.
4.  **Behavior:**
    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.
    *   Do NOT interpret or analyze the data beyond extracting it into the JSON structure.
    *   Extract the cluster name accurately from the '## Cluster: ' lines.
    *   Extract the keywords accurately from the bullet points ('- ') under each cluster name, trimming any leading/trailing whitespace.
    *   Ensure the output is a single, valid JSON object.

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
 * Returns the RAW cluster definition (Record<string, string[]>).
 */
export async function performSemanticClusteringAI(
  input: z.infer<typeof aiInputSchema>
): Promise<z.infer<typeof rawClusterOutputSchema>> {
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
    // --- Add logging for rawMarkdown ---
    console.log('--- BEGIN RAW MARKDOWN ---');
    console.log(rawMarkdown);
    console.log('--- END RAW MARKDOWN ---');
    // --- End logging ---

    if (!rawMarkdown || rawMarkdown.trim().length === 0) {
      console.error(
        '[Server Action] AI returned empty or whitespace-only text for clustering.'
      );
      throw new Error('AI failed to generate clustering text.');
    }

    // --- Trim markdown before conversion ---
    const trimmedMarkdown = rawMarkdown.trim();

    // --- Step 2: Convert Text to JSON ---
    console.log(
      `[Server Action] Clustering Step 2: Requesting JSON Conversion. Model=${openaiModel}`
    );
    const conversionPrompt = getClusteringConversionPrompt(trimmedMarkdown); 
    console.log('[AI Call] Calling AI for Clustering JSON Conversion...');

    const { object: jsonResult } = await generateObject({
      model: openai(openaiModel),
      schema: rawClusterOutputSchema, // Use the RAW output schema here
      prompt: conversionPrompt,
      mode: 'json' 
    });

    console.log(
      '[Server Action] Clustering Step 2: Received and validated RAW JSON result.'
    );
    return jsonResult; // Return the raw { clusters: Record<string, string[]> }
  } catch (error) {
    console.error('[Server Action] Semantic Clustering AI Error:', error);
    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', error.flatten());
      throw new Error(`Data validation failed: ${error.errors[0]?.message}`);
    }
    // --- Improve error handling for schema validation failure ---
    if (
      error instanceof Error &&
      error.message.includes('No object generated') // Or a more specific error code if available
    ) {
      console.error(
        '[Server Action] AI failed to generate valid JSON matching the schema.'
      );
      // Include details about the error if possible, e.g., from error.cause
      if (error.cause instanceof Error) {
          console.error('[Server Action] Cause:', error.cause.message);
      }
      throw new Error(
        'AI generation failed: Could not convert clustering text to the required JSON format.'
      );
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
    // Use non-null assertion db! since we checked above
    const docRef = db!.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.warn(`[Clustering Prep] Document not found: ${researchId}`);
      return { success: false, keywords: null, error: 'Research document not found' };
    }

    const data = docSnap.data() as KeywordResearchItem; // Assuming type
    if (!data || !Array.isArray(data.keywords) || data.keywords.length === 0) {
      console.warn(`[Clustering Prep] No keywords found in document: ${researchId}`);
      return { success: false, keywords: null, error: 'No keywords found in research data' };
    }

    // Extract keyword texts
    const keywordTexts: string[] = data.keywords
                                    .map((kw: KeywordVolumeItem) => kw.text)
                                    .filter((text): text is string => !!text); // Filter out null/undefined/empty strings

    if (keywordTexts.length === 0) {
        console.warn(`[Clustering Prep] Keywords array exists but contains no valid text for ${researchId}`);
        return { success: false, keywords: null, error: 'No valid keyword text found' };
    }

    // console.log(`[Clustering Prep] Prepared ${keywordTexts.length} keywords for ${researchId}`);
    return { success: true, keywords: keywordTexts };

  } catch (error) {
    console.error(`[Clustering Prep] Error preparing keywords for ${researchId}:`, error);
    return { success: false, keywords: null, error: error instanceof Error ? error.message : 'Failed to prepare keywords' };
  }
}

// --- Helper Function: Save Clustering Results with Volume ---
/**
 * Calculates volumes for clusters and saves them to the `clustersWithVolume` field.
 * @param researchId The ID of the Keyword Research item.
 * @param rawClusters The raw cluster output from the AI (Record<string, string[]>).
 * @returns Object indicating success or an error message.
 * @private Internal helper function.
 */
async function _calculateAndSaveClustersWithVolume(
  researchId: string,
  rawClusters: Record<string, string[]>
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Clustering Save] Starting calculation and save for ${researchId}`);
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }
  if (!rawClusters || Object.keys(rawClusters).length === 0) {
    console.log(`[Clustering Save] No raw clusters provided for ${researchId}. Skipping save.`);
    // Decide if this is success or failure - let's say success as there was nothing to save
    return { success: true }; 
  }

  try {
    // 1. Fetch the keyword data (including volumes) for this research item
    // Use the DB service directly to avoid potential stale cache from action
    console.log(`[Clustering Save] Fetching keyword volume data for ${researchId}...`);
    const researchDetail = await getKeywordResearchDetail(researchId); 
    if (!researchDetail || !Array.isArray(researchDetail.keywords)) {
      console.error(`[Clustering Save] Failed to fetch keyword volume data for ${researchId}.`);
      return { success: false, error: 'Could not retrieve keyword volume data.' };
    }

    // 2. Create the volume lookup map
    const keywordVolumeMap = new Map<string, KeywordVolumeItem>();
    researchDetail.keywords.forEach((kw: KeywordVolumeItem) => {
      if (kw && kw.text) {
        const normalizedText = kw.text.trim().toLowerCase();
        const volume = typeof kw.searchVolume === 'number' ? kw.searchVolume : 0;
        keywordVolumeMap.set(normalizedText, { ...kw, searchVolume: volume });
      }
    });
    console.log(`[Clustering Save] Created volume map with ${keywordVolumeMap.size} entries for ${researchId}.`);

    // Helper to get volume item or default
    const getKeywordVolumeItem = (text: string): KeywordVolumeItem => {
      const normalizedText = text.trim().toLowerCase();
      const foundItem = keywordVolumeMap.get(normalizedText);
      if (foundItem) return foundItem;
      console.warn(`[Clustering Save ${researchId}] Keyword "${text}" from cluster not found in main list. Defaulting volume.`);
      return { text: text.trim(), searchVolume: 0 };
    };

    // 3. Process raw clusters into ClusterItem[] structure
    const clustersWithVolume: ClusterItem[] = Object.entries(rawClusters).map(([clusterName, keywordTexts]) => {
      const clusterKeywords = (Array.isArray(keywordTexts) ? keywordTexts : [])
                              .map(text => getKeywordVolumeItem(text)); 
      const totalVolume = clusterKeywords.reduce((sum, kw: KeywordVolumeItem) => sum + (kw.searchVolume ?? 0), 0);
      return { 
        clusterName: clusterName,
        keywords: clusterKeywords,
        totalVolume: totalVolume,
      };
    });

    console.log(`[Clustering Save] Processed ${clustersWithVolume.length} clusters with volumes for ${researchId}.`);
    // console.log(`[Clustering Save - Debug] Clusters with Volume:`, JSON.stringify(clustersWithVolume, null, 2));

    // 4. Save the processed array to the new DB field
    console.log(`[Clustering Save] Saving processed clusters to DB for ${researchId}...`);
    const updateResult = await updateKeywordResearchClustersWithVolume(researchId, clustersWithVolume);

    if (updateResult) {
      console.log(`[Clustering Save] Successfully saved clusters with volume for ${researchId}.`);
      await revalidateKeywordResearch(researchId); 
      console.log(`[Clustering Save] Revalidated cache for ${researchId}.`);
      return { success: true };
    } else {
      console.error(`[Clustering Save] DB update function failed for ${researchId}.`);
      await _attemptRevalidationOnError(researchId, 'DB save failure');
      return { success: false, error: 'Failed to save processed clusters to database.' };
    }

  } catch (error) {
    console.error(`[Clustering Save] Error calculating/saving clusters with volume for ${researchId}:`, error);
    await _attemptRevalidationOnError(researchId, 'save calculation error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error processing cluster volumes.'
    };
  }
}

// --- Helper Function: Attempt Revalidation On Error ---
/**
 * Attempts to revalidate the cache for a given researchId, logging any errors.
 * Used in error handling paths.
 * @param researchId The ID of the Keyword Research item.
 * @param context A string describing the context of the error (e.g., 'save failure').
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
    await revalidateKeywordResearch(researchId);
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
    `[Clustering Action] Received request to cluster researchId: ${researchId}`
  );
  
  // Use a try...finally block to ensure certain actions run even on error
  try {
    // 1. Prepare Keywords
    const prepResult = await _prepareKeywordsForClustering(researchId);
    if (!prepResult.success || !prepResult.keywords) {
      return {
        success: false,
        error: prepResult.error || 'Keyword preparation failed.'
      };
    }
    if (prepResult.keywords.length < 5) {
      return { success: false, error: 'Insufficient keywords for clustering (minimum 5 required).' };
    }

    // 2. Perform AI Clustering to get RAW results
    let rawClusteringResult: z.infer<typeof rawClusterOutputSchema>;
    try {
      rawClusteringResult = await performSemanticClusteringAI({
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

    // --- 3. Calculate Volumes and Save Processed Clusters --- 
    const saveResult = await _calculateAndSaveClustersWithVolume(
      researchId,
      rawClusteringResult.clusters // Pass the raw Record<string, string[]>
    );
    
    // --- 4. IMMEDIATE Verification Step --- 
    if (saveResult.success) {
        console.log(`[Clustering Action] Save reported success. Performing IMMEDIATE verification read for ${researchId}...`);
        try {
            const docRef = db!.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const rawData = docSnap.data();
                console.log(`[Clustering Action - Verification] Document exists. Data snapshot:`, JSON.stringify(rawData, null, 2));
                if (rawData && rawData.clustersWithVolume) {
                    console.log(`[Clustering Action - Verification] SUCCESS: clustersWithVolume field FOUND immediately after save!`);
                } else {
                    console.error(`[Clustering Action - Verification] FAILURE: clustersWithVolume field NOT FOUND immediately after save! Raw data keys:`, rawData ? Object.keys(rawData) : 'No data');
                }
            } else {
                console.error(`[Clustering Action - Verification] FAILURE: Document ${researchId} does not exist immediately after save!`);
            }
        } catch (verifyError) {
            console.error(`[Clustering Action - Verification] Error during immediate verification read for ${researchId}:`, verifyError);
        }
    }
    // --- End Verification Step --- 

    if (!saveResult.success) {
      // Error logging and revalidation attempts handled within the helper
      return { success: false, error: saveResult.error };
    }

    // 5. Final Success Log (moved from step 4)
    console.log(
      `[Clustering Action] Clustering process completed successfully for ${researchId}.`
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
