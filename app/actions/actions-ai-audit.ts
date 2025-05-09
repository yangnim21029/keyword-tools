"use server";

import { ScrapedPageContent } from "@/app/services/firebase/data-onpage-result"; // Assuming this type is relevant
import { LanguageModel, generateObject } from "ai";
import { AI_MODELS } from "../global-config";
import { z } from "zod"; // Import Zod
import { GscKeywordMetrics } from "@/app/services/firebase/schema"; // <-- Import GSC type

// Import the new combined type from actions-opportunity (or define locally if preferred)
// Assuming EnrichedKeywordData is defined in actions-opportunity.ts and exported, or we define it here:
interface EnrichedKeywordData extends GscKeywordMetrics {
  searchVolume?: number | null; // Added from Google Ads
}

export interface KeywordGroup {
  csvKeyword: string;
  aiPrimaryKeyword: string;
  aiRelatedKeyword1: string;
  aiRelatedKeyword2: string;
  aiPrimaryKeywordVolume?: number | null; // ADDED: Volume for the primary keyword
  aiRelatedKeyword1Volume?: number | null;
  aiRelatedKeyword2Volume?: number | null;
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

// Add this helper function near the top
const normalizeKeyword = (keyword: string): string => {
  if (!keyword) return "";
  return keyword.replace(/\s+/g, "").toLowerCase(); // Remove all whitespace and lowercase
};

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

    let primaryKeywordVolume: number | null | undefined = undefined;
    let finalAiPrimaryKeyword = validatedSelection.aiPrimaryKeyword.trim(); // Default to AI's selection

    const normalizedSelectedPrimary = normalizeKeyword(finalAiPrimaryKeyword);

    if (
      enrichedKeywords &&
      enrichedKeywords.length > 0 &&
      normalizedSelectedPrimary
    ) {
      const matchedKeyword = enrichedKeywords.find(
        (kw) => normalizeKeyword(kw.keyword) === normalizedSelectedPrimary
      );

      if (matchedKeyword) {
        primaryKeywordVolume = matchedKeyword.searchVolume ?? 0;
        // Ensure we use the exact keyword string from our list if a match is found,
        // to counteract any minor case/spacing changes by the AI not caught by normalizeKeyword for display purposes.
        finalAiPrimaryKeyword = matchedKeyword.keyword;
      } else {
        console.error(
          `[AI Audit ERROR] AI selected primary keyword "${validatedSelection.aiPrimaryKeyword}" (Normalized: "${normalizedSelectedPrimary}") was NOT FOUND in the provided enriched list. This should not happen if AI follows instructions. CSV Hint: ${originalCsvKeyword}. URL: ${scrapedContent.url}. Setting volume to null and using AI's original selection string.`
        );
        primaryKeywordVolume = null; // Explicitly null as it couldn't be verified
        // Keep finalAiPrimaryKeyword as what AI returned, but log error.
      }
    } else if (normalizedSelectedPrimary) {
      console.warn(
        `[AI Audit] Cannot lookup volume for AI selected primary "${finalAiPrimaryKeyword}": EnrichedKeywords list was empty. CSV Hint: ${originalCsvKeyword}. URL: ${scrapedContent.url}.`
      );
      primaryKeywordVolume = 0; // New: Default to 0 if enrichedKeywords list is empty
    } else {
      console.warn(
        `[AI Audit] AI did not select a primary keyword or selection was empty. CSV Hint: ${originalCsvKeyword}. URL: ${scrapedContent.url}.`
      );
      primaryKeywordVolume = 0; // New: Default to 0 if AI selection is empty
      finalAiPrimaryKeyword = originalCsvKeyword; // Fallback to CSV keyword if AI selection is effectively empty
    }

    // Fallback for related keywords if AI chose N/A or if they are not in the list (less critical than primary)
    const ensureValidRelatedKeyword = (
      selectedRelated: string,
      list: EnrichedKeywordData[] | undefined
    ) => {
      if (selectedRelated.toUpperCase() === "N/A") return "N/A";
      if (
        list &&
        list.some(
          (kw) =>
            normalizeKeyword(kw.keyword) === normalizeKeyword(selectedRelated)
        )
      ) {
        return selectedRelated.trim(); // Use AI's if it's valid and in list
      }
      // If not in list, or list empty, consider it N/A to avoid saving invented keywords
      // console.warn(`[AI Audit] Related keyword "${selectedRelated}" not in list or list empty. Defaulting to N/A.`);
      return "N/A";
    };

    const finalAiRelatedKeyword1 = ensureValidRelatedKeyword(
      validatedSelection.aiRelatedKeyword1,
      enrichedKeywords
    );
    const finalAiRelatedKeyword2 = ensureValidRelatedKeyword(
      validatedSelection.aiRelatedKeyword2,
      enrichedKeywords
    );

    // --- Volume lookup for Related Keywords ---
    let relatedKeyword1Volume: number | null | undefined = undefined;
    const normalizedR1 = normalizeKeyword(finalAiRelatedKeyword1);
    if (
      enrichedKeywords &&
      enrichedKeywords.length > 0 &&
      finalAiRelatedKeyword1 !== "N/A" &&
      normalizedR1
    ) {
      const matchedR1 = enrichedKeywords.find(
        (kw) => normalizeKeyword(kw.keyword) === normalizedR1
      );
      if (matchedR1) {
        relatedKeyword1Volume = matchedR1.searchVolume; // Keep null/undefined if that's what searchVolume is
      } else {
        console.warn(
          `[AI Audit] AI selected R1 keyword '${finalAiRelatedKeyword1}' not found in enriched list for volume lookup. Volume will be null/undefined.`
        );
        relatedKeyword1Volume = null;
      }
    } else if (finalAiRelatedKeyword1 !== "N/A") {
      // If no enrichedKeywords or R1 is not 'N/A' but somehow normalizedR1 is falsy (empty string after normalize)
      console.warn(
        `[AI Audit] R1 '${finalAiRelatedKeyword1}' will have null/undefined volume (no enriched list or bad normalization).`
      );
      relatedKeyword1Volume = null;
    }

    let relatedKeyword2Volume: number | null | undefined = undefined;
    const normalizedR2 = normalizeKeyword(finalAiRelatedKeyword2);
    if (
      enrichedKeywords &&
      enrichedKeywords.length > 0 &&
      finalAiRelatedKeyword2 !== "N/A" &&
      normalizedR2
    ) {
      const matchedR2 = enrichedKeywords.find(
        (kw) => normalizeKeyword(kw.keyword) === normalizedR2
      );
      if (matchedR2) {
        relatedKeyword2Volume = matchedR2.searchVolume; // Keep null/undefined
      } else {
        console.warn(
          `[AI Audit] AI selected R2 keyword '${finalAiRelatedKeyword2}' not found in enriched list for volume lookup. Volume will be null/undefined.`
        );
        relatedKeyword2Volume = null;
      }
    } else if (finalAiRelatedKeyword2 !== "N/A") {
      console.warn(
        `[AI Audit] R2 '${finalAiRelatedKeyword2}' will have null/undefined volume (no enriched list or bad normalization).`
      );
      relatedKeyword2Volume = null;
    }
    // --- End Volume lookup for Related Keywords ---

    const keywordGroup: KeywordGroup = {
      csvKeyword: originalCsvKeyword,
      aiPrimaryKeyword: finalAiPrimaryKeyword, // Use the potentially corrected keyword string
      aiRelatedKeyword1: finalAiRelatedKeyword1,
      aiRelatedKeyword2: finalAiRelatedKeyword2,
      aiPrimaryKeywordVolume: primaryKeywordVolume,
      aiRelatedKeyword1Volume: relatedKeyword1Volume,
      aiRelatedKeyword2Volume: relatedKeyword2Volume,
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
