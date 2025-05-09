"use server";

import { LanguageModel, generateObject, generateText } from "ai";
import { AI_MODELS } from "@/app/global-config"; // Assuming AI_MODELS.SEARCH or .BASE is suitable
import { z } from "zod";

// Zod schema for a single news/event snippet
const NewsEventSnippetSchema = z.object({
  title: z.string().describe("The concise headline of the news or event."),
  summary: z
    .string()
    .max(200)
    .describe("A brief summary of the news/event (max 200 characters)."),
  // Optional: Add a source hint or a primary entity involved if easily identifiable
  sourceOrEntityHint: z
    .string()
    .optional()
    .describe(
      "A hint about the source (e.g., news outlet) or a key entity involved."
    ),
  // Optional: If the AI can find a relevant image URL (less reliable without specific image search tools)
  // imageUrl: z.string().url().optional().describe("A URL to a relevant image, if found."),
});

// Zod schema for the AI's response (an array of snippets)
const AiNewsResponseSchema = z.object({
  newsEvents: z
    .array(NewsEventSnippetSchema)
    .describe("An array of relevant news or event snippets."),
});

// Type for the validated AI response
export type NewsEventSnippet = z.infer<typeof NewsEventSnippetSchema>;

interface SearchNewsParams {
  keyword: string;
  year: string; // e.g., "2023"
  month: string; // e.g., "5" for May, or "MAY"
  count?: number; // Number of news items to fetch
  seenNewsTitles?: string[]; // Titles of news items already fetched, to avoid duplicates
}

interface SearchNewsResult {
  success: boolean;
  snippets?: NewsEventSnippet[];
  error?: string;
  message?: string;
}

export async function searchKeywordNewsAndEvents(
  params: SearchNewsParams
): Promise<SearchNewsResult> {
  const { keyword, year, month, count = 3, seenNewsTitles = [] } = params;

  // Attempt to convert month string (e.g., "MAY", "5") to a more general query term if needed
  // For now, we'll just use the provided month string directly in the prompt.
  // A more robust solution might map month numbers/names to full month names for the search query.
  const monthQuery = month; // Could be enhanced e.g. getMonthName(parseInt(month))

  const prompt = `
    You are a helpful research assistant. Find notable news articles or significant events related to the keyword "${keyword}" that occurred around ${monthQuery} ${year}.
    Focus on events that might cause a surge or change in public interest for the keyword.

    **Instructions:**
    1.  Search for up to ${count} distinct news items or events.
    2.  For each item, provide a concise title, a brief summary (max 200 characters), and optionally a source/entity hint.
    3.  CRITICAL: Do NOT include any news items if their exact titles are in the following list of already seen titles: ${seenNewsTitles.length > 0 ? seenNewsTitles.join(", ") : "(No titles seen yet)"}.
    4.  Prioritize relevance to the keyword and potential impact on public interest.
    5.  If no relevant and new (not seen) items are found, return an empty list for newsEvents.
    
    Return the information in the specified JSON structure.

    **Output JSON Structure:**
    {
      "newsEvents": [
        {
          "title": "string",
          "summary": "string",
          "sourceOrEntityHint": "string"
        }
      ]
    }
  `;

  try {
    console.log(
      `[AI News Search] Starting search for keyword: "${keyword}", around ${monthQuery} ${year}. Excluding ${seenNewsTitles.length} seen titles.`
    );

    // Use a model capable of search-like tasks or good instruction following.
    // AI_MODELS.SEARCH might be a placeholder; use .BASE or .ADVANCED if SEARCH is not specifically tuned for this.

    // --- Temporarily switch to generateText for debugging --- START
    console.log("[AI News Search] Using generateText for debugging.");
    const {
      text: rawTextResponse,
      usage,
      finishReason,
    } = await generateText({
      model: AI_MODELS.SEARCH, // Or whichever model you are using, e.g., AI_MODELS.BASE
      prompt: prompt,
      maxTokens: 1024,
    });

    console.log(
      "[AI News Search] Raw Text Response from generateText:",
      rawTextResponse
    );
    console.log("[AI News Search] Usage:", usage);
    console.log("[AI News Search] Finish Reason:", finishReason);

    // For now, since we switched to generateText, we can't parse it with AiNewsResponseSchema directly.
    // We'll return a success with a message indicating raw text was logged.
    // In a real scenario, you'd try to parse rawTextResponse if it's expected to be JSON, or adjust the prompt for generateText.
    return {
      success: true,
      snippets: [], // Return empty snippets as we are not parsing the object
      message:
        "AI response received as raw text and logged to console. Check server logs for AI output. Modify action to parse if needed.",
    };
    // --- Temporarily switch to generateText for debugging --- END

    /* --- Original generateObject call - COMMENTED OUT ---
    const { object: aiResponse } = await generateObject({
      model: AI_MODELS.SEARCH,
      schema: AiNewsResponseSchema,
      prompt: prompt,
      maxTokens: 1024, // Adjust as needed
    });

    // Log the raw AI response for debugging
    console.log(
      "[AI News Search] Raw AI Response (from generateObject):",
      JSON.stringify(aiResponse, null, 2)
    );

    if (!aiResponse.newsEvents || aiResponse.newsEvents.length === 0) {
      return {
        success: true,
        snippets: [],
        message: `No new relevant news/events found for "${keyword}" around ${monthQuery} ${year}.`,
      };
    }

    return {
      success: true,
      snippets: aiResponse.newsEvents,
    };
    --- End of original generateObject call --- */
  } catch (error) {
    console.error("[AI News Search] Error during AI news/event search:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred during AI news/event search.";
    return {
      success: false,
      error: `AI news/event search failed: ${errorMessage}`,
      message: `AI news/event search failed: ${errorMessage}`,
    };
  }
}
