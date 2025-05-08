"use server";

import { ScrapedPageContent } from "@/app/services/firebase/data-onpage-result"; // Assuming this type is relevant
import { LanguageModel, generateObject } from "ai";
import { AI_MODELS } from "../global-config";
import { z } from "zod"; // Import Zod
import { GscKeywordMetrics } from "@/app/services/firebase/schema"; // <-- Import GSC type

// Import the new combined type from actions-oppourtunity (or define locally if preferred)
// Assuming EnrichedKeywordData is defined in actions-oppourtunity.ts and exported, or we define it here:
interface EnrichedKeywordData extends GscKeywordMetrics {
  searchVolume?: number | null; // Added from Google Ads
}

export interface KeywordGroup {
  csvKeyword: string;
  aiPrimaryKeyword: string;
  aiRelatedKeyword1: string;
  aiRelatedKeyword2: string;
  aiPrimaryKeywordVolume?: number | null; // ADDED: Volume for the primary keyword
}

interface AiAuditInput {
  scrapedContent: Omit<ScrapedPageContent, "extractedAt">;
  originalCsvKeyword: string;
  // Expect the enriched list now
  enrichedKeywords?: EnrichedKeywordData[];
}

// Update Zod schema for the AI's expected *selection* output (before we add volume)
const AiSelectionResponseSchema = z.object({
  aiPrimaryKeyword: z
    .string()
    .describe(
      "The single best primary keyword selected EXACTLY from the provided list."
    ),
  aiRelatedKeyword1: z
    .string()
    .describe(
      "The first related keyword selected EXACTLY from the provided list, or N/A."
    ),
  aiRelatedKeyword2: z
    .string()
    .describe(
      "The second related keyword selected EXACTLY from the provided list, or N/A."
    ),
});

// Type for validated AI selection output
type ValidatedAiSelection = z.infer<typeof AiSelectionResponseSchema>;

/**
 * Analyzes scraped content and enriched keyword data (GSC+Ads) to SELECT a primary keyword group
 * AND determines the search volume for the selected primary keyword.
 */
export async function analyzeKeywordsWithAiAction(
  input: AiAuditInput
): Promise<KeywordGroup | { error: string }> {
  // Return type includes volume now
  const { scrapedContent, originalCsvKeyword, enrichedKeywords } = input;

  if (!scrapedContent.textContent || !scrapedContent.title) {
    console.error("AI Audit: Missing text content or title from scraped data.");
    return { error: "Missing text content or title for AI analysis." };
  }

  const maxContentLength = 10000;
  const truncatedContent =
    scrapedContent.textContent.length > maxContentLength
      ? scrapedContent.textContent.substring(0, maxContentLength) + "..."
      : scrapedContent.textContent;

  // Format the enriched keywords list for the prompt
  const maxKeywordsInPrompt = 20; // Ensure consistency if list is already sliced
  const enrichedKeywordsPromptList =
    enrichedKeywords && enrichedKeywords.length > 0
      ? enrichedKeywords
          .slice(0, maxKeywordsInPrompt) // Slice again just in case it wasn't
          .map(
            (kw) =>
              `- "${kw.keyword}" (GSC Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks}; Ads Vol: ${kw.searchVolume ?? "N/A"})`
          )
          .join("\n")
      : "(No enriched keywords provided or available)";
  const enrichedHint =
    enrichedKeywords && enrichedKeywords.length > maxKeywordsInPrompt
      ? `\n... and ${enrichedKeywords.length - maxKeywordsInPrompt} more.`
      : "";

  // Revised prompt: Still focuses on SELECTION, but we'll extract volume afterwards.
  // No need to ask the AI for the volume, just the keyword selection.
  const prompt = `
    You are an expert SEO keyword analyst. Your task is to SELECT the best keyword group from the provided Enriched Keyword Data based on the webpage context.

    **Context:**
    - Original Keyword Hint (from CSV): "${originalCsvKeyword}"
    - Webpage Title: "${scrapedContent.title}"
    - Webpage Content Summary: "${truncatedContent}"

    **Provided Enriched Keyword Data (GSC Metrics + Google Ads Volume):**
    ${enrichedKeywordsPromptList}
    ${enrichedHint}

    **Instructions:**
    1.  **Analyze** the context (Title, Content, Original Hint) and the Provided Enriched Keyword Data.
    2.  **Select** the single **BEST** keyword from the list that represents the primary topic of the page, considering GSC position/impressions/clicks AND Google Ads search volume. Assign this to 'aiPrimaryKeyword'.
    3.  **Select** two **DIFFERENT** related keywords also from the list that are relevant and likely have user interest (considering all metrics). Assign these to 'aiRelatedKeyword1' and 'aiRelatedKeyword2'.
    4.  **CRITICAL**: You MUST choose keywords **EXACTLY** as they appear in the list above (the string within the quotes). Do NOT invent or modify keywords.
    5.  If the list is empty or contains no suitable keywords, use the 'Original Keyword Hint' for 'aiPrimaryKeyword' and set both 'aiRelatedKeyword1' and 'aiRelatedKeyword2' to the exact string "N/A".
    6.  Provide ONLY the selected keywords according to the required output structure (aiPrimaryKeyword, aiRelatedKeyword1, aiRelatedKeyword2).
  `;

  try {
    console.log(
      `AI Audit: Starting AI keyword SELECTION using ENRICHED data for URL: ${scrapedContent.url} (Original CSV: ${originalCsvKeyword})`
    );

    const modelToUse: LanguageModel = AI_MODELS.BASE;
    // Use the selection schema here
    const { object: validatedSelection } =
      await generateObject<ValidatedAiSelection>({
        model: modelToUse,
        schema: AiSelectionResponseSchema, // Use the schema for selection only
        prompt: prompt,
      });

    // Find the search volume for the selected primary keyword from the input list
    let primaryKeywordVolume: number | null | undefined = undefined;
    const selectedPrimary = validatedSelection.aiPrimaryKeyword.trim();

    if (enrichedKeywords && enrichedKeywords.length > 0) {
      const matchedKeyword = enrichedKeywords.find(
        (kw) =>
          kw.keyword.toLowerCase().trim() ===
          selectedPrimary.toLowerCase().trim()
      );
      if (matchedKeyword) {
        // Ensure searchVolume is treated as potentially null/undefined
        primaryKeywordVolume = matchedKeyword.searchVolume ?? null;
      }
    }

    // If the selected primary keyword was the fallback (originalCsvKeyword) because the list was empty/unsuitable,
    // we won't find a volume in the enriched list. primaryKeywordVolume remains undefined/null.

    // Construct the final KeywordGroup including the volume
    const keywordGroup: KeywordGroup = {
      csvKeyword: originalCsvKeyword,
      aiPrimaryKeyword: selectedPrimary,
      aiRelatedKeyword1: validatedSelection.aiRelatedKeyword1.trim(),
      aiRelatedKeyword2: validatedSelection.aiRelatedKeyword2.trim(),
      aiPrimaryKeywordVolume: primaryKeywordVolume, // Assign the found volume
    };

    console.log(
      "AI Audit: AI keyword selection complete (using enriched data). Keyword Group:",
      keywordGroup // Log the full group including volume
    );
    return keywordGroup;
  } catch (error) {
    console.error(
      "AI Audit: Error during AI keyword selection/volume lookup using enriched data:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred during AI keyword selection/volume lookup.";
    return {
      error: `AI keyword selection/volume lookup failed: ${errorMessage}`,
    };
  }
}
