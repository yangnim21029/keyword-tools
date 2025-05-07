"use server";

import { AI_MODELS } from "@/app/global-config";
import { generateText } from "ai";
import { COLLECTIONS, db } from "@/app/services/firebase/db-config";
import { FieldValue } from "firebase-admin/firestore";
import { submitCreateScrape } from "./actions-onpage-result";
import {
  getOnPageResultById,
  FirebaseOnPageResultObject,
} from "@/app/services/firebase/data-onpage-result";

/**
 * Constructs the prompt for revising an article based on graph suggestions.
 */
async function getRefineArticlePrompt(
  inputText: string,
  graphText: string
): Promise<string> {
  const promptLines = [
    `${inputText}`,
    `---`,
    `使用以下撰文建議，調整上述的結構，並補充資訊，給我『新的』文章，將列出缺乏尚需要補充的部分都寫進文章中：`,
    `---`,
    `${graphText}`,
    ``,
    `**CRITICAL INSTRUCTIONS:**`,
    `*   Generate the refined article based *only* on the provided input text and graph suggestions.`, // Added instruction
    `*   Focus on incorporating the suggestions from the graph into the original text structure and content.`, // Added instruction
    `*   Output *only* the newly generated, complete article text.`, // Added instruction
    `*   Do NOT include introductory text, explanations, or the original prompt in the response.`, // Added instruction
    `*   If the graph text is empty or doesn't provide actionable suggestions, refine the original text for clarity and completeness as best as possible.`, // Added fallback
    `---`,
    `Do not use Markdown table format. If you need to use table, table part should use html instead`, // Added instruction
  ];
  return promptLines.join("\n");
}

/**
 * Action: Generate a refined article using the original text and a knowledge graph.
 * UPDATED: Returns the refined article text on success.
 */
export async function generateRefinedArticleFromGraph({
  docId,
}: {
  docId: string;
}): Promise<{
  success: boolean;
  refinedArticle?: string | null; // <-- Added return field
  error?: string;
  id?: string;
}> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  console.log(`[Action: Refine Article] Starting for Doc ID: ${docId}`);

  let generatedRefinedArticle: string | null = null; // Variable to store the generated text

  try {
    // 0. Fetch OnPage data
    const onPageData: FirebaseOnPageResultObject | null =
      await getOnPageResultById(docId);
    if (!onPageData) {
      console.error(
        `[Action: Refine Article] OnPage data not found for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `OnPage data not found for ID: ${docId}`,
        id: docId,
      };
    }

    // Determine the source text: use original if available, otherwise current
    const sourceText = onPageData.originalTextContent || onPageData.textContent;
    const graphText = onPageData.paragraphGraphText;

    // Check if source text exists
    if (!sourceText || sourceText.trim().length === 0) {
      console.error(
        `[Action: Refine Article] Source textContent (or originalTextContent) missing or empty for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: "Source text content is missing or empty.",
        id: docId,
      };
    }

    // Check if graph text exists (it's now required)
    if (
      typeof graphText === "undefined" ||
      graphText === null ||
      graphText.trim().length === 0
    ) {
      console.error(
        `[Action: Refine Article] Graph text (paragraphGraphText) missing or empty for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: "Graph text content is missing or empty.",
        id: docId,
      };
    }

    // 1. Generate Refined Article
    console.log(`[Action: Refine Article] Calling AI for Article Revision...`);
    const refinePrompt = await getRefineArticlePrompt(
      sourceText,
      graphText // Pass graphText directly, it's guaranteed to be a non-empty string here
    ); // Pass empty string if graph is null/undefined -> Removed fallback
    const { text: refinedArticleText } = await generateText({
      model: AI_MODELS.BASE, // Use BASE model for better text generation
      prompt: refinePrompt,
      // Consider adding parameters like maxTokens if needed
    });
    generatedRefinedArticle = refinedArticleText; // Store the generated text
    console.log(`[Action: Refine Article] Article Revision successful.`);

    // 2. Update Firestore directly
    console.log(`[Action: Refine Article] Updating Firestore...`);
    const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
    await docRef.update({
      refinedTextContent: generatedRefinedArticle, // Use the stored variable
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: Refine Article] Firestore updated.`);

    // 3. Return success WITH the generated article text
    return {
      success: true,
      id: docId,
      refinedArticle: generatedRefinedArticle, // <-- Return the text
    };
  } catch (error) {
    console.error(
      `[Action: Refine Article] Failed for Doc ID ${docId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
      await docRef.update({
        updatedAt: FieldValue.serverTimestamp(), // Still update timestamp on error
      });
    } catch (updateError) {
      console.error(
        `[Action: Refine Article] Failed to update timestamp on error for Doc ID ${docId}:`,
        updateError
      );
    }
    return {
      success: false,
      error: `Article Revision failed: ${errorMessage}`,
      id: docId, // Include docId even on failure
    };
  }
}

/**
 * Action: Generate a refined article directly from provided input text and graph text.
 */
export async function generateRefinedArticleDirectly({
  inputText,
  graphText,
}: {
  inputText: string;
  graphText: string;
}): Promise<{ success: boolean; refinedArticle?: string; error?: string }> {
  console.log(`[Action: Refine Article Directly] Starting...`);

  // Basic input validation
  if (!inputText || inputText.trim().length === 0) {
    console.error(
      `[Action: Refine Article Directly] Input text is missing or empty.`
    );
    return { success: false, error: "Input text cannot be empty." };
  }
  // Graph text can be empty, handled by the prompt
  const effectiveGraphText = graphText || "";

  try {
    // 1. Get the prompt
    const refinePrompt = await getRefineArticlePrompt(
      inputText,
      effectiveGraphText
    );

    // 2. Generate Refined Article
    console.log(
      `[Action: Refine Article Directly] Calling AI for Article Revision...`
    );
    const { text: refinedArticle } = await generateText({
      model: AI_MODELS.BASE,
      prompt: refinePrompt,
    });
    console.log(
      `[Action: Refine Article Directly] Article Revision successful.`
    );

    // 3. Return success with the article
    return {
      success: true,
      refinedArticle: refinedArticle,
    };
  } catch (error) {
    console.error(`[Action: Refine Article Directly] Failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Article Revision failed: ${errorMessage}`,
    };
  }
}

/**
 * Action: Scrapes a URL, saves content, generates graph, and returns results.
 */
export async function scrapeUrlAndGenerateGraph({
  url,
}: {
  url: string;
}): Promise<{
  success: boolean;
  docId?: string;
  inputText?: string | null;
  graphText?: string | null;
  error?: string;
}> {
  console.log(`[Action: Scrape & Graph] Starting for URL: ${url}`);
  let docId: string | undefined = undefined;
  let fetchedInputText: string | null | undefined = undefined;

  try {
    // 1. Scrape and save initial content
    console.log(`[Action: Scrape & Graph] Calling submitCreateScrape...`);
    const scrapeResult = await submitCreateScrape({ url });

    if (!scrapeResult.success || !scrapeResult.id) {
      console.error(
        `[Action: Scrape & Graph] Scrape failed: ${scrapeResult.error}`
      );
      return {
        success: false,
        error: scrapeResult.error || "Scraping failed.",
      };
    }
    docId = scrapeResult.id;
    console.log(`[Action: Scrape & Graph] Scrape successful. Doc ID: ${docId}`);

    // 2. Fetch the content we just saved
    // Note: A short delay might sometimes be needed if Firestore replication is slow,
    // but usually getOnPageResultById should retrieve the just-added doc.
    console.log(`[Action: Scrape & Graph] Fetching scraped data...`);
    const onPageData = await getOnPageResultById(docId);
    if (!onPageData) {
      console.error(
        `[Action: Scrape & Graph] Failed to fetch newly created document: ${docId}`
      );
      return {
        success: false,
        error: "Failed to retrieve scraped content after saving.",
        docId: docId,
      };
    }
    fetchedInputText = onPageData.textContent; // Use textContent (may have been cleaned by scraper)

    if (!fetchedInputText || fetchedInputText.trim().length === 0) {
      console.error(
        `[Action: Scrape & Graph] Fetched document has no textContent: ${docId}`
      );
      return {
        success: false,
        error: "Scraped content was empty.",
        docId: docId,
      };
    }
    console.log(`[Action: Scrape & Graph] Fetched textContent successfully.`);

    // 3. Generate the paragraph graph
    console.log(
      `[Action: Scrape & Graph] Calling generateSingleParagraphGraph...`
    );
    const graphResult = await generateSingleParagraphGraph({
      docId,
      textContent: fetchedInputText,
    });

    if (!graphResult.success) {
      // Log the error, but still return the scraped text
      console.warn(
        `[Action: Scrape & Graph] Graph generation failed: ${graphResult.error}. Returning scraped text only.`
      );
      return {
        success: true, // Indicate partial success (scrape worked)
        docId: docId,
        inputText: fetchedInputText,
        graphText: null, // Explicitly null
        error: `Graph generation failed: ${graphResult.error}`, // Pass along the graph error
      };
    }

    console.log(`[Action: Scrape & Graph] Graph generation successful.`);

    // 4. Return all results
    return {
      success: true,
      docId: docId,
      inputText: fetchedInputText,
      graphText: graphResult.result || null,
    };
  } catch (error) {
    console.error(
      `[Action: Scrape & Graph] Unexpected error for URL ${url}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      docId: docId, // Return docId if scraping succeeded before error
      inputText: fetchedInputText, // Return fetched text if available
      error: `An unexpected error occurred: ${errorMessage}`,
    };
  }
}

// --- NEW ACTION FOR SIMPLIFIED WORKFLOW --- //

/**
 * Action: Scrapes a target URL for graph suggestions, then uses provided
 * input text and the generated graph to create a refined article.
 */
export async function generateRevisionFromInputTextAndUrlGraph({
  inputText,
  targetUrl,
}: {
  inputText: string;
  targetUrl: string;
}): Promise<{
  success: boolean;
  refinedArticle?: string;
  error?: string;
  errorType?: "scrape" | "ai";
}> {
  console.log(
    `[Action: Refine from Input & URL Graph] Starting for URL: ${targetUrl}`
  );

  // Validate inputs
  if (!inputText || inputText.trim().length === 0) {
    console.error(
      `[Action: Refine from Input & URL Graph] Input text is missing.`
    );
    return {
      success: false,
      error: "Your input text cannot be empty.",
      errorType: "ai",
    };
  }
  if (
    !targetUrl ||
    (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))
  ) {
    console.error(
      `[Action: Refine from Input & URL Graph] Invalid target URL: ${targetUrl}`
    );
    return {
      success: false,
      error:
        "Please provide a valid target URL starting with http:// or https://",
      errorType: "ai",
    };
  }

  let docId: string | undefined = undefined;
  let scrapedTextContent: string | null | undefined = undefined;
  let graphText: string | null = null;

  try {
    // 1. Scrape the target URL
    console.log(
      `[Action: Refine from Input & URL Graph] Scraping target URL: ${targetUrl}`
    );
    const scrapeResult = await submitCreateScrape({ url: targetUrl });

    if (!scrapeResult.success || !scrapeResult.id) {
      console.error(
        `[Action: Refine from Input & URL Graph] Scrape failed: ${scrapeResult.error}`
      );
      return {
        success: false,
        error: `Failed to scrape target URL: ${scrapeResult.error || "Unknown scrape error"}`,
        errorType: "scrape",
      };
    }
    docId = scrapeResult.id;
    console.log(
      `[Action: Refine from Input & URL Graph] Scrape successful. Doc ID: ${docId}`
    );

    // 2. Fetch the scraped content
    console.log(
      `[Action: Refine from Input & URL Graph] Fetching scraped content...`
    );
    const onPageData = await getOnPageResultById(docId);
    if (
      !onPageData ||
      !onPageData.textContent ||
      onPageData.textContent.trim().length === 0
    ) {
      console.error(
        `[Action: Refine from Input & URL Graph] Failed to fetch valid content for doc ${docId}`
      );
      return {
        success: false,
        error: "Failed to retrieve valid content from the scraped URL.",
        errorType: "scrape",
      };
    }
    scrapedTextContent = onPageData.textContent;
    console.log(
      `[Action: Refine from Input & URL Graph] Fetched scraped content successfully.`
    );

    // 3. Generate the graph from scraped content
    console.log(`[Action: Refine from Input & URL Graph] Generating graph...`);
    const graphResult = await generateSingleParagraphGraph({
      docId,
      textContent: scrapedTextContent,
    });

    if (!graphResult.success) {
      console.warn(
        `[Action: Refine from Input & URL Graph] Graph generation failed: ${graphResult.error}. Proceeding without graph suggestions.`
      );
      graphText = null; // Proceed with null graph
    } else {
      graphText = graphResult.result || null;
      console.log(
        `[Action: Refine from Input & URL Graph] Graph generated successfully.`
      );
    }

    // 4. Generate the refined article using USER'S input text and the SCRAPED graph
    console.log(
      `[Action: Refine from Input & URL Graph] Generating refined article...`
    );
    const refinePrompt = await getRefineArticlePrompt(
      inputText,
      graphText || ""
    );
    const { text: refinedArticle } = await generateText({
      model: AI_MODELS.BASE,
      prompt: refinePrompt,
    });
    console.log(
      `[Action: Refine from Input & URL Graph] Refined article generated.`
    );

    // 5. Optionally: Update the Firestore doc with the final refined text?
    // For now, just returning it as requested.
    // If saving is desired, uncomment below:
    /*
    if (docId) {
        try {
            const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
            await docRef.update({
                // Maybe save under a different field to distinguish it?
                finalRefinedTextFromInput: refinedArticle,
                updatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`[Action: Refine from Input & URL Graph] Saved final revision to doc ${docId}.`);
        } catch (saveError) {
            console.error(`[Action: Refine from Input & URL Graph] Failed to save final revision to doc ${docId}:`, saveError);
            // Don't fail the whole operation, just log the save error
        }
    }
    */

    // 6. Return the final refined article
    return {
      success: true,
      refinedArticle: refinedArticle,
    };
  } catch (error) {
    console.error(
      `[Action: Refine from Input & URL Graph] Unexpected error:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Try to update timestamp of the created doc if possible
    if (docId) {
      try {
        if (!db) {
          console.warn(
            "[Action: Refine from Input & URL Graph] DB not initialized, cannot update timestamp on error."
          );
          throw new Error("DB not initialized"); // Prevent proceeding
        }
        const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
        await docRef.update({ updatedAt: FieldValue.serverTimestamp() });
      } catch (updateError) {
        /* Ignore nested error */
      }
    }
    return {
      success: false,
      error: `An unexpected error occurred: ${errorMessage}`,
      errorType: "ai",
    };
  }
}

/**
 * Generates a prompt for creating a graph knowledge visualization for a single paragraph.
 * Keeps the prompt in Chinese as requested.
 */
const getSingleParagraphGraphPrompt = (textContent: string): string => {
  const prompt = `你將扮演 graph knowledge api，功能是將作者的寫作法，變成一個 graph knowledge 並可視化。請分析以下段落，不使用 python，不使用 mermaid 格式，直接寫出圖表出來，注意每一句的字詞距離。請確保完整輸出圖表結構。

不要多個 graph 結構，會從統一的一個母節點出發。

目標段落（請視為沒有換行的段落）：
${textContent}

請嚴格按照以下 H2 標題結構組織你的回覆：

## Graph Knowledge Visualization
[在這裡寫出目標段落的 graph 結構]

---

\n\n 示範（一篇文章，一個 母節點 graph 結構）：
[葉海洋]──(身份)──>【中國網紅企業家】
     └──(過去事件)──>【買上等精子、自己生混血寶寶】
     └──(2024事件)──>【誕下雙胞胎男嬰】
                              └──(結果)──>【組成五口之家】
     └──(情感關係)──>【前女友】──(行為)──>【爆料】
                              └──(影響)──>【形象翻車風波】
     └──(目前反應)──>【尚未正面回應】
     └──(引發)──>【社群熱議】
                    └──(話題1)──>【家庭】
                    └──(話題2)──>【國籍】
                    └──(話題3)──>【情感】
                    └──(話題4)──>【人設】`;
  return prompt;
};

/**
 * Interface for the graph generation response.
 */
interface GraphResponse {
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * Action: Generate Graph Knowledge Visualization for a single paragraph.
 * Saves the result to Firestore.
 */
export async function generateSingleParagraphGraph({
  docId,
  textContent,
}: {
  docId: string;
  textContent: string;
}): Promise<GraphResponse> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  if (!docId) {
    console.error("[Action: Single Paragraph Graph] Missing document ID.");
    return { success: false, error: "Document ID is required." };
  }

  try {
    if (!textContent || textContent.trim().length === 0) {
      console.error(
        "[Action: Single Paragraph Graph] Input text content is missing or empty."
      );
      return { success: false, error: "Input text content cannot be empty." };
    }

    console.log(
      "[Action: Single Paragraph Graph] Generating graph visualization..."
    );
    // Create the prompt
    const prompt = getSingleParagraphGraphPrompt(
      textContent.substring(0, 30000)
    ); // Apply truncation similar to other actions

    // Call the AI model
    const { text: graphText } = await generateText({
      model: AI_MODELS.BASE, // Or potentially a more powerful model if needed
      prompt: prompt,
    });

    console.log(
      "[Action: Single Paragraph Graph] Graph visualization generated successfully."
    );

    // --- Update Firestore ---
    console.log(
      `[Action: Single Paragraph Graph] Updating Firestore for Doc ID: ${docId}...`
    );
    const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
    await docRef.update({
      paragraphGraphText: graphText || "", // Save the generated graph text
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(
      `[Action: Single Paragraph Graph] Firestore updated for Doc ID: ${docId}.`
    );
    // ------------------------

    // Return the full text, assuming the AI follows the requested H2 structure
    return { success: true, result: graphText || "" }; // Still return result for potential immediate use
  } catch (error) {
    console.error(
      "[Action: Single Paragraph Graph] Error generating graph visualization:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during graph generation";

    // Attempt to update timestamp even on error
    try {
      const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
      await docRef.update({ updatedAt: FieldValue.serverTimestamp() });
    } catch (updateError) {
      console.error(
        `[Action: Single Paragraph Graph] Failed to update timestamp on error for Doc ID ${docId}:`,
        updateError
      );
    }

    return {
      success: false,
      result: "",
      error: errorMessage,
    };
  }
}

/**
 * Action: Generate Graph Knowledge Visualization from text directly.
 * This version doesn't require a docId and doesn't save to Firestore.
 */
export async function generateGraphFromText(
  textContent: string
): Promise<GraphResponse> {
  try {
    if (!textContent || textContent.trim().length === 0) {
      console.error(
        "[Action: Graph From Text] Input text content is missing or empty."
      );
      return { success: false, error: "Input text content cannot be empty." };
    }

    console.log("[Action: Graph From Text] Generating graph visualization...");
    // Create the prompt
    const prompt = getSingleParagraphGraphPrompt(
      textContent.substring(0, 30000)
    );

    // Call the AI model
    const { text: graphText } = await generateText({
      model: AI_MODELS.BASE,
      prompt: prompt,
    });

    console.log(
      "[Action: Graph From Text] Graph visualization generated successfully."
    );

    // Return the graph text directly
    return { success: true, result: graphText || "" };
  } catch (error) {
    console.error(
      "[Action: Graph From Text] Error generating graph visualization:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during graph generation";

    return {
      success: false,
      result: "",
      error: errorMessage,
    };
  }
}
