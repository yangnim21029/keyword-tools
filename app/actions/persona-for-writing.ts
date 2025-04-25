'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';

// --- DB IMPORTS ---
import {
  getKeywordResearchDetail,
  dbUpdateKeywordResearch,
} from '@/app/services/firebase/db-keyword-research';

// Define input schema for a SINGLE cluster
const personaInputSchema = z.object({
  clusterName: z.string().describe('要生成畫像的分群主題名稱'),
  keywords: z.array(z.string()).min(1).describe('該分群包含的關鍵字列表'),
  model: z
    .enum(['gpt-4.1-mini', 'gpt-4.1-mini'])
    .default('gpt-4.1-mini')
    .optional()
});
/**
 * Generates the prompt for the initial persona text generation.
 */
const getPersonaTextPrompt = (
  clusterName: string,
  keywords: string[],
  modelName: string
) => `You are a highly specialized AI assistant acting as an expert market analyst and user researcher. Your sole task is to meticulously analyze the provided cluster data based *only* on the instructions that follow and generate output in the *exact* format specified.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Assume the persona of an expert market analyst specializing in user persona generation.
2.  **Input Data:** Base your entire analysis strictly on the provided cluster name and keywords. Do NOT use external knowledge or assumptions.
3.  **Output Format:** Generate your response *exclusively* as a plain text description (around 100-150 words) of the user persona.
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, titles, or self-references.
    *   Do NOT engage in conversation or ask clarifying questions.
    *   Do NOT use markdown formatting (like \`\`\`).
    *   Focus *only* on the points listed under "Task-Specific Instructions".
    *   **Crucially: If you speculate on the user's potential background, profession, interests, or identity (Point 4 below), you MUST briefly justify it based on specific keywords provided.** For example, if suggesting they are students, mention which keywords suggest this (e.g., "textbook", "assignment help"). Avoid unsupported generalizations.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---

Based *only* on the provided keyword cluster theme and its keywords, analyze and describe the likely user persona behind these searches.

**Cluster Theme:** ${clusterName}
**Keywords:** ${keywords.join(', ')}

Provide a concise user persona description (around 100-150 words) covering the following points:
1.  **Primary Intent:** What specific goal or information is the user likely seeking with these keywords?
2.  **Knowledge Level:** Based on the specificity or technicality of the keywords, how familiar are they likely to be with this topic (e.g., beginner, intermediate, expert)?
3.  **Potential Needs/Pain Points:** What problems, needs, or challenges related *directly* to the keywords might the user be trying to address?
4.  **Possible Background/Identity:** Briefly speculate on the user's potential profession, interests, or identity, **but only if supported by the keywords, and state your reasoning based on those keywords.** If no strong evidence exists in the keywords, state that the background is unclear or omit this point.

Respond ONLY with the persona description text.`;

/**
 * REMOVED: Unused function for JSON conversion.
 */
// const getPersonaConversionPrompt = (personaText: string) => { ... };

/**
 * Uses AI to generate a text persona description for a cluster.
 * @param input Contains clusterName, keywords, and optional model.
 * @returns An object containing the persona string or an error.
 */
export async function generateUserPersonaFromClusters(
  input: z.infer<typeof personaInputSchema>
): Promise<{ userPersona: string | null; error: string | null }> {
  try {
    const validatedInput = personaInputSchema.parse(input);
    const { clusterName, keywords, model } = validatedInput;
    const openaiModel = model ?? 'gpt-4.1-mini';

    console.log(
      `[Server Action] Persona Gen Step 1: Requesting Text. Cluster='${clusterName}', Model=${openaiModel}`
    );

    // --- Step 1: Generate Text (Persona Description) ---
    const textPrompt = getPersonaTextPrompt(clusterName, keywords, openaiModel);
    console.log('[AI Call] Calling AI for Persona Text Generation...');
    const { text: rawPersonaText } = await generateText({
      model: openai(openaiModel),
      prompt: textPrompt
    });
    console.log(
      `[Server Action] Persona Gen Step 1: Received raw text for cluster '${clusterName}'.`
    );

    const trimmedPersonaText = rawPersonaText.trim();
    if (!trimmedPersonaText) {
      console.error(
        '[Server Action] AI returned empty persona description for cluster:',
        clusterName
      );
      throw new Error('AI failed to generate a valid persona description.');
    }

    // Return the success object with the persona text
    return { userPersona: trimmedPersonaText, error: null };

  } catch (error) {
    // Enhanced error logging
    const clusterName = (input as any)?.clusterName || 'unknown';
    console.error(
      `[Server Action] Error generating persona for cluster '${clusterName}':`,
      error
    );
    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', error.flatten());
      // Construct error message for return
      const errorMessage = `Persona data validation failed: ${error.errors[0]?.message}`;
      return { userPersona: null, error: errorMessage };
    }
    // Construct error message for return
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during persona generation.';
    return { userPersona: null, error: errorMessage };
  }
}

// --- NEW FUNCTION: Request Persona Generation and Save to DB ---

// Input schema for the new action
const requestPersonaSchema = z.object({
  researchId: z.string().min(1, 'Research ID is required'),
  clusterName: z.string().min(1, 'Cluster name is required'),
});

/**
 * Orchestrates fetching cluster data, generating a persona, and saving it to the DB.
 * @param researchId The ID of the keyword research document.
 * @param clusterName The name of the cluster to generate a persona for.
 * @returns An object indicating success or failure with an optional error message.
 */
export async function requestGenPersonaForKeywordCluster(
  researchId: string,
  clusterName: string
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `[Action] Requesting persona generation for research: ${researchId}, cluster: ${clusterName}`
  );
  try {
    // 1. Validate Input
    const validatedInput = requestPersonaSchema.parse({ researchId, clusterName });

    // 2. Fetch Research Data
    console.log(`[Action] Fetching research details for ID: ${researchId}`);
    const researchData = await getKeywordResearchDetail(validatedInput.researchId);
    if (!researchData) {
      throw new Error(`Keyword research data not found for ID: ${researchId}`);
    }

    // 3. Find the Specific Cluster
    const targetCluster = researchData.clustersWithVolume?.find(
      (c) => c.clusterName === validatedInput.clusterName
    );
    if (!targetCluster) {
      throw new Error(
        `Cluster named "${clusterName}" not found in research ID: ${researchId}`
      );
    }
    if (!targetCluster.keywords || targetCluster.keywords.length === 0) {
      throw new Error(`Cluster "${clusterName}" has no keywords.`);
    }
    const keywords = targetCluster.keywords
      .map((kw) => kw.text || '')
      .filter(Boolean);
    if (keywords.length === 0) {
        throw new Error(`No valid keyword text found in cluster "${clusterName}".`);
    }

    // 4. Generate Persona Text using the existing function
    console.log(`[Action] Generating persona for cluster: ${clusterName}`);
    const personaResult = await generateUserPersonaFromClusters({
      clusterName: validatedInput.clusterName,
      keywords: keywords,
      // You might want to make the model configurable here too
    });

    if (personaResult.error || !personaResult.userPersona) {
      throw new Error(
        `Failed to generate persona: ${personaResult.error || 'AI returned empty result'}`
      );
    }

    // 5. Prepare and Save Persona Description directly into clustersWithVolume
    console.log(
      `[Action] Updating personaDescription for cluster: ${clusterName} in DB`
    );

    // Ensure we have clustersWithVolume to update
    const existingClusters = researchData.clustersWithVolume;
    if (!existingClusters) {
        throw new Error(`clustersWithVolume not found on research data ID: ${researchId}`);
    }
    
    // Create the updated array
    const updatedClustersArray = existingClusters.map(cluster => {
      if (cluster.clusterName === validatedInput.clusterName) {
        // Update the personaDescription for the target cluster
        return { ...cluster, personaDescription: personaResult.userPersona! }; 
      }
      return cluster; // Return unchanged clusters
    });

    // 6. Save the updated clustersWithVolume array back to Firestore
    const updateSuccess = await dbUpdateKeywordResearch(
      validatedInput.researchId,
      { 
          clustersWithVolume: updatedClustersArray,
          updatedAt: new Date()
      }
    );

    if (!updateSuccess) {
      throw new Error('Failed to save the updated persona description to the database.');
    }

    // --- Add Revalidation using Tag --- 
    revalidateTag('keyword-research-detail'); // Use the tag from unstable_cache

    console.log(
      `[Action] Successfully generated, saved, and revalidated persona for cluster: ${clusterName}`
    );
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[Action] Error in requestGenPersonaForKeywordCluster (Research: ${researchId}, Cluster: ${clusterName}):`,
      errorMessage,
      error instanceof z.ZodError ? error.flatten() : error // Log full Zod error if applicable
    );
    return { success: false, error: errorMessage };
  }
}
