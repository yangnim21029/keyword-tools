'use server';

import { openai } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

// Define input schema for a SINGLE cluster
const personaInputSchema = z.object({
  clusterName: z.string().describe('要生成畫像的分群主題名稱'),
  keywords: z.array(z.string()).min(1).describe('該分群包含的關鍵字列表'),
  model: z.enum(['gpt-4.1-mini', 'gpt-4o']).default('gpt-4.1-mini').optional()
});

// Define output schema for a SINGLE persona string
const personaOutputSchema = z.object({
  userPersona: z.string().describe('AI 基於單一關鍵字分群生成的使用者畫像描述')
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
 * Generates the prompt for converting the persona text description to JSON.
 */
const getPersonaConversionPrompt = (
  personaText: string
) => `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided plain text user persona description into the *exact* JSON format specified, using *only* the information present in the input text.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Act as a data conversion bot.
2.  **Input Data:** Use *only* the provided persona description text.
3.  **Output Format:** Generate *only* a valid JSON object matching the structure: { "userPersona": "string" }.
4.  **Behavior:**
    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.
    *   Place the entire input text into the "userPersona" field of the JSON object.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---

Input Persona Description Text:
${personaText}

Convert this text into the following JSON structure:
{
  "userPersona": "<The entire input persona description text>"
}

Respond ONLY with the valid JSON object.`;

/**
 * Uses a two-step AI process: generate text (persona description), then convert text to JSON.
 * @param input Contains clusterName, keywords, and optional model.
 * @returns The validated JSON persona object.
 */
export async function generateUserPersonaFromClusters(
  input: z.infer<typeof personaInputSchema>
): Promise<z.infer<typeof personaOutputSchema>> {
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

    // --- Step 2: Convert Text to JSON ---
    console.log(
      `[Server Action] Persona Gen Step 2: Requesting JSON Conversion. Cluster='${clusterName}', Model=${openaiModel}`
    );
    const conversionPrompt = getPersonaConversionPrompt(trimmedPersonaText);
    console.log('[AI Call] Calling AI for Persona JSON Conversion...');
    const { object: jsonResult } = await generateObject({
      model: openai(openaiModel),
      schema: personaOutputSchema,
      prompt: conversionPrompt
    });

    console.log(
      `[Server Action] Persona Gen Step 2: Received and validated JSON for cluster '${clusterName}'.`
    );

    return jsonResult;
  } catch (error) {
    // Enhanced error logging
    const clusterName = (input as any)?.clusterName || 'unknown';
    console.error(
      `[Server Action] Error generating persona for cluster '${clusterName}':`,
      error
    );
    if (error instanceof z.ZodError) {
      console.error('Zod validation error details:', error.flatten());
      throw new Error(
        `Persona data validation failed: ${error.errors[0]?.message}`
      );
    }
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Unknown error during user persona generation process.');
    }
  }
}
