'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { COLLECTIONS, db, getKeywordVolumeObj } from '../services/firebase';
import { AiClusterItem } from '../services/firebase/schema';
import { AI_MODELS } from '../global-config';

// --- DB IMPORTS ---

/**
 * Generates the prompt for the initial persona text generation.
 */
const getPersonaTextPrompt = ({
  clusterName,
  keywords
}: {
  clusterName: string;
  keywords: string[];
}) => `You are a highly specialized AI assistant acting as an expert market analyst and user researcher. Your sole task is to meticulously analyze the provided cluster data based *only* on the instructions that follow and generate output in the *exact* format specified.

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

async function _genreatePersonaText({
  clusterName,
  keywords,
  model
}: {
  clusterName: string;
  keywords: string[];
  model: string;
}): Promise<string | null> {
  const textPrompt = getPersonaTextPrompt({
    clusterName,
    keywords
  });

  const { text: rawPersonaText } = await generateText({
    model: AI_MODELS.BASE,
    prompt: textPrompt
  });

  const trimmedPersonaText = rawPersonaText.trim();
  if (!trimmedPersonaText) {
    return null;
  }
  return trimmedPersonaText;
}

/**
 * Generates a persona for a specific cluster and saves it to the database.
 * @returns An object containing the persona string or an error.
 */
export async function submitGeneratePersonaForCluster({
  keywordVolumeObjectId,
  clusterName,
  model = 'gpt-4.1-mini'
}: {
  keywordVolumeObjectId: string;
  clusterName: string;
  model?: string;
}): Promise<{ success: boolean; error?: string }> {
  const keywordVolumeObject = await getKeywordVolumeObj({
    researchId: keywordVolumeObjectId
  });

  if (!keywordVolumeObject) {
    // Object not found
    return { success: false, error: 'Keyword research object not found.' };
  }

  const clusters = keywordVolumeObject.clustersWithVolume;

  // Check if clusters is a valid array
  if (!Array.isArray(clusters)) {
    console.error(
      `[Action] clustersWithVolume is not an array for research '${keywordVolumeObjectId}'. Cannot generate persona.`
    );
    return { success: false, error: 'Invalid cluster data structure.' };
  }

  // Find the target cluster in the ARRAY
  const targetClusterIndex = clusters.findIndex(
    (cluster: AiClusterItem) => cluster.clusterName === clusterName
  );

  if (targetClusterIndex === -1) {
    // Cluster not found
    console.error(
      `[Action] Cluster '${clusterName}' not found in research object '${keywordVolumeObjectId}'. Cannot generate persona.`
    );
    return {
      success: false,
      error: `Cluster '${clusterName}' not found.`
    };
  }

  // Extract keywords relevant to the target cluster
  const targetClusterKeywords =
    clusters[targetClusterIndex]?.keywords?.map(kw => kw.text) || [];
  if (targetClusterKeywords.length === 0) {
    console.warn(`[Action] Target cluster '${clusterName}' has no keywords.`);
  }

  try {
    // Generate Persona Text
    const personaText = await _genreatePersonaText({
      clusterName,
      keywords: targetClusterKeywords,
      model
    });

    if (!personaText) {
      throw new Error('AI returned empty persona description');
    }

    // Save to DB
    if (!db) {
      throw new Error('Database not initialized');
    }
    const researchDocRef = db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      .doc(keywordVolumeObjectId);

    // Update the cluster in the ARRAY
    const updatedClustersWithVolume = clusters.map((cluster, index) => {
      if (index === targetClusterIndex) {
        return { ...cluster, personaDescription: personaText };
      }
      return cluster;
    });

    await researchDocRef.update({
      clustersWithVolume: updatedClustersWithVolume,
      updatedAt: new Date()
    });

    // Revalidate Cache
    console.log(`[Cache] Revalidating cache for ${keywordVolumeObjectId}...`);
    revalidateTag(keywordVolumeObjectId);
    revalidateTag('getKeywordVolumeList');

    return { success: true };
  } catch (error) {
    // Error Handling
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[Action] Error in submitGeneratePersonaForCluster (Research: ${keywordVolumeObjectId}, Cluster: ${clusterName}):`,
      errorMessage,
      error instanceof z.ZodError ? error.flatten() : error
    );
    return { success: false, error: errorMessage };
  }
}
