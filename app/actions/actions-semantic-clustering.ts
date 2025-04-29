'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { AI_MODELS } from '../global-config';

// Import necessary actions and types from keyword-research
// Note: Ensure these are exported from keyword-research.ts
import { getKeywordVolumeObj } from '@/app/services/firebase';
import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import type {
  AiClusterItem,
  KeywordVolumeItem
} from '@/app/services/firebase/schema';

// Define the schema for the new AI output structure: { clusters: [ { clusterName: string, keywords: string[] } ] }
const AiClusterListSchema = z.object({
  clusters: z.array(
    z.object({
      clusterName: z.string().describe('The name of the semantic cluster'),
      keywords: z
        .array(z.string())
        .describe('List of keyword strings belonging to the cluster')
    })
  )
});

// Type alias for the array of cluster objects inferred from the schema
type AiClusterList = z.infer<typeof AiClusterListSchema>['clusters'];

// --- Prompts ---

/**
 * Generates the prompt for the initial text generation step (Markdown output).
 */
const getClusteringTextPrompt = (
  keywords: string[]
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
3.  **Output Format:** Generate *only* a valid JSON object matching the structure: { "clusters": [ { "clusterName": "[Cluster Name]", "keywords": ["Keyword1", "Keyword2", ...] }, ... ] }.\n4.  **Behavior:**
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
  "clusters": [
    { "clusterName": "主題名稱1", "keywords": ["關鍵字1", "關鍵字2", ...] },
    { "clusterName": "主題名稱2", "keywords": ["關鍵字3", "關鍵字4", ...] }
  ]
}

Respond ONLY with the valid JSON object.`;

/**
 * Uses a two-step AI process: generate text (Markdown), then convert text to JSON.
 * Fetches keywords, performs AI clustering, calculates volumes, saves results, and revalidates cache.
 */
export async function submitClustering({
  keywordVolumeObjectId,
  model = 'gpt-4.1-mini',
  maxKeywords = 80
}: {
  keywordVolumeObjectId: string;
  model?: string;
  maxKeywords?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const keywordVolumeObject = await getKeywordVolumeObj({
      researchId: keywordVolumeObjectId
    });
    if (!keywordVolumeObject) {
      throw new Error('Keyword volume object not found');
    }
    const keywords = keywordVolumeObject.keywords;
    if (!keywords) {
      throw new Error('Keywords not found in keyword volume object');
    }
    // Extract main query and language for long-tail generation
    const mainQuery = keywordVolumeObject.query;
    const language = keywordVolumeObject.language;

    const limitedKeywords = keywords.slice(0, maxKeywords);
    const keywordTexts = limitedKeywords.map(kw => kw.text);

    // --- Perform AI Clustering Steps ---
    const aiKeywordCluster = await _performAiClusteringSteps({
      keywordsToCluster: keywordTexts,
      model
    });

    // --- Calculate Clusters with Volume & Long-Tail ---
    console.log(
      `[AI Call] Calculating cluster volumes & long-tail for ${keywordVolumeObjectId}...`
    );
    let clustersWithVolume: AiClusterItem[];
    try {
      clustersWithVolume = await _calculateClustersWithVolume({
        keywordVolumeItems: keywords, // Pass the full list for volume lookup
        aiKeywordCluster,
        mainQuery, // Pass main query
        language // Pass language
      });
      console.log(
        `[AI Call] Cluster volume & long-tail calculation successful.`
      );
    } catch (calculationError) {
      console.error(
        `[Error] Cluster volume calculation failed for ${keywordVolumeObjectId}:`,
        calculationError
      );
      // Re-throw or handle as needed. For now, re-throw to be caught by the outer catch.
      throw calculationError;
    }

    // Check if calculation returned empty data (which might be valid if no clusters found)
    if (clustersWithVolume.length === 0) {
      console.log(
        `[Info] Calculation resulted in 0 clusters for ${keywordVolumeObjectId}. Proceeding without saving clusters.`
      );
      // Decide if this should be a success or not. Let's consider it success as the process ran.
      // No need to update DB or revalidate if no clusters.
      return { success: true };
    }

    // --- Save the processed clusters to the DB ---
    console.log(
      `[DB Save] Saving processed clusters for ${keywordVolumeObjectId}...`
    );
    if (!db) {
      throw new Error('Database not initialized');
    }
    const researchDocRef = db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      .doc(keywordVolumeObjectId);

    await researchDocRef.update({
      clustersWithVolume: clustersWithVolume, // This now includes longTailKeywords
      updatedAt: new Date() // Update timestamp
    });

    // --- Revalidate Cache ---
    console.log(`[Cache] Revalidating cache for ${keywordVolumeObjectId}...`);
    revalidateTag(keywordVolumeObjectId);

    console.log(
      `[Success] Clustering process completed for ${keywordVolumeObjectId}.`
    );
    return { success: true };
  } catch (error) {
    console.error('[Server Action] Semantic Clustering AI Error:', error);

    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'AI generation or save failed'
    };
  }
}

// --- NEW Helper Function: Perform AI Clustering Steps ---
/**
 * Performs the two-step AI clustering: Text generation and JSON conversion.
 * @param options - Object containing keywordsToCluster and optional model name.
 * @param options.keywordsToCluster List of keyword strings for clustering.
 * @param options.model Optional AI model name.
 * @returns A promise resolving to the AI-generated cluster list (`AiClusterList`) or throws an error.
 * @private Internal helper function.
 */
async function _performAiClusteringSteps({
  keywordsToCluster,
  model = 'gpt-4.1-mini'
}: {
  keywordsToCluster: string[];
  model?: string;
}): Promise<AiClusterList> {
  // --- Step 1: Generate Text (Markdown) ---
  const textPrompt = getClusteringTextPrompt(keywordsToCluster);
  console.log('[AI Call] Calling AI for Clustering Text Generation...');
  const { text: rawMarkdown } = await generateText({
    model: AI_MODELS.BASE,
    prompt: textPrompt
  });

  // --- Trim markdown before conversion ---
  const trimmedMarkdown = rawMarkdown.trim();
  if (!trimmedMarkdown) {
    throw new Error('AI failed to generate any clustering text output.');
  }

  // --- Step 2: Convert Text to JSON ---
  console.log('[AI Call] Clustering AI for JSON Conversion...');
  const conversionPrompt = getClusteringConversionPrompt(trimmedMarkdown);
  const { object: jsonResult } = await generateObject({
    model: AI_MODELS.FAST,
    schema: AiClusterListSchema,
    prompt: conversionPrompt,
    mode: 'json'
  });

  // Validate the structure minimally (ensure clusters exist and is an array)
  if (!jsonResult || !Array.isArray(jsonResult.clusters)) {
    throw new Error(
      'AI failed to convert text to the expected JSON structure ({ clusters: [...] }).'
    );
  }

  // Return the array of clusters
  return jsonResult.clusters;
}

// --- Helper Function: Save Clustering Results with Volume ---
/**
 * Calculates volumes and long-tail keywords for clusters.
 * @param options - Object containing keyword volume items, AI clusters, main query, and language.
 * @param options.keywordVolumeItems The list of keywords with their volume data.
 * @param options.aiKeywordCluster The AI-generated cluster list (`AiClusterList`).
 * @param options.mainQuery The original main query keyword.
 * @param options.language The language code (e.g., 'zh-TW', 'en').
 * @returns A promise resolving to an array of `AiClusterItem` with calculated volumes and long-tail keywords.
 * @private Internal helper function.
 */
async function _calculateClustersWithVolume({
  keywordVolumeItems,
  aiKeywordCluster,
  mainQuery,
  language
}: {
  keywordVolumeItems: KeywordVolumeItem[] | undefined | null;
  aiKeywordCluster: AiClusterList;
  mainQuery: string;
  language?: string;
}): Promise<AiClusterItem[]> {
  console.log(`[Clustering Calculation] Starting calculation...`);
  if (!keywordVolumeItems || keywordVolumeItems.length === 0) {
    console.log(
      `[Clustering Calculation] No keyword volume items provided. Skipping calculation.`
    );
    return [];
  }
  if (!aiKeywordCluster || aiKeywordCluster.length === 0) {
    console.log(
      `[Clustering Calculation] No raw clusters provided. Skipping calculation.`
    );
    return [];
  }

  try {
    // 2. Create the volume lookup map from the passed items
    const keywordVolumeMap = new Map<string, KeywordVolumeItem>();
    keywordVolumeItems.forEach((kw: KeywordVolumeItem) => {
      if (kw && kw.text) {
        const normalizedText = kw.text.trim().toLowerCase();
        const volume =
          typeof kw.searchVolume === 'number' ? kw.searchVolume : 0;
        keywordVolumeMap.set(normalizedText, { ...kw, searchVolume: volume });
      }
    });
    console.log(
      `[Clustering Calculation] Created volume map with ${keywordVolumeMap.size} entries.`
    );

    // Helper to get volume item or default
    const getKeywordVolumeItem = (text: string): KeywordVolumeItem => {
      const normalizedText = text.trim().toLowerCase();
      const foundItem = keywordVolumeMap.get(normalizedText);
      if (foundItem) return foundItem;
      return { text: text.trim(), searchVolume: 0 };
    };

    // Escape mainQuery for regex usage (important!)
    const escapedMainQuery = mainQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mainQueryRegex = new RegExp(`\\b${escapedMainQuery}\\b`, 'gi');

    // 3. Process clusters to add volume and long-tail
    const clustersWithVolume: AiClusterItem[] = aiKeywordCluster.map(
      cluster => {
        const { clusterName, keywords: keywordTexts } = cluster;
        const validKeywordTexts = Array.isArray(keywordTexts)
          ? keywordTexts
          : [];
        const clusterKeywords: KeywordVolumeItem[] = validKeywordTexts.map(
          text => getKeywordVolumeItem(text)
        );

        // Sort keywords by volume descending to find the main keyword
        const sortedKeywords = [...clusterKeywords].sort(
          (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0)
        );
        const mainKeyword =
          sortedKeywords.length > 0
            ? sortedKeywords[0].text
            : validKeywordTexts[0] || 'N/A';

        const totalVolume = clusterKeywords.reduce(
          (sum, kw: KeywordVolumeItem) => sum + (kw.searchVolume ?? 0),
          0
        );

        // --- Generate Long-Tail Keywords ---
        const longTailKeywords: string[] = [];
        clusterKeywords.forEach(kw => {
          const keywordText = kw.text;
          let longTailPart: string | null = null;

          if (language?.startsWith('zh')) {
            // Chinese: Remove individual characters from mainQuery
            longTailPart = keywordText
              .split('')
              .filter(char => !mainQuery.includes(char))
              .join('');
          } else {
            // English/Other: Remove whole word mainQuery (case-insensitive)
            longTailPart = keywordText
              .replace(mainQueryRegex, '')
              .replace(/\s+/g, ' ')
              .trim(); // Remove extra spaces
          }

          // Add if non-empty and different from original keyword text
          if (longTailPart && longTailPart !== keywordText) {
            longTailKeywords.push(longTailPart);
          }
        });
        // Filter for unique long-tail parts
        const uniqueLongTailKeywords = [...new Set(longTailKeywords)];

        return {
          clusterName: clusterName,
          mainKeyword: mainKeyword,
          keywords: clusterKeywords,
          totalVolume: totalVolume,
          longTailKeywords: uniqueLongTailKeywords // Add the generated list
        };
      }
    );

    console.log(
      `[Clustering Calculation] Processed ${clustersWithVolume.length} clusters with volumes.`
    );

    return clustersWithVolume;
  } catch (error) {
    console.error(
      `[Clustering Calculation] Error calculating clusters with volume:`,
      error
    );
    throw new Error(
      error instanceof Error
        ? `Error processing cluster volumes: ${error.message}`
        : 'Unknown error processing cluster volumes.'
    );
  }
}
