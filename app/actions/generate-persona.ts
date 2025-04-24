'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

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
