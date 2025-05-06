"use server";

import { COLLECTIONS, db } from "@/app/services/firebase/db-config"; // <--
// --- Import new constants from global-config ---
import {
  AI_MODELS,
  SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT,
} from "@/app/global-config";

import {
  findSerpResultObjects,
  getSerpResultById,
} from "@/app/services/firebase/data-serp-result";
import { FirebaseSerpResultObject } from "@/app/services/firebase/schema";
import { fetchSerpByKeyword } from "@/app/services/serp.service";
import { generateText } from "ai";
import { FieldValue } from "firebase-admin/firestore"; // Import Timestamp
import { revalidateTag } from "next/cache";

const SERP_DATA_LIST_TAG = "serpDataList";

// --- Prompt Generation Functions (Moved from serp-prompt-design.ts) ---

export const getContentTypeAnalysisPrompt = async (
  keyword: string,
  serpResults: string
) =>
  `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in Content Type analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided keyword and SERP results (including titles, descriptions, and URLs). Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* in the format of a Markdown table as requested later in the prompt.\n4.  **Behavior:**\n    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.\n    *   Do NOT engage in conversation or ask clarifying questions.\n    *   Do NOT use markdown formatting (like \`\`\`.\`) around the final table output.\n    *   Adhere strictly to the 8 content types defined below.\n    *   **Crucially, consider both the TITLE and the DESCRIPTION of each result when determining its content type.**\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: Content Type Analysis for [${keyword}]\n\n**What this report does:** The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type.\n\n**When to use this report:** The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.\n\nYou know that there are eight types of content as mentioned below\n\n1. How to guides\n2. Step by step tutorials\n3. List posts\n4. Opinion editorials\n5. Videos\n6. Product pages\n7. Category pages\n8. Landing pages for a service\n\nPlease create a markdown table with two columns "Content Type" and "Pages".\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".\n\nI am listing below the positions, titles, **descriptions** and URLs of the top pages. Can you analyze **both their titles and descriptions** and categorize them based on the 8 content types mentioned earlier? Once done, please collate all the content types together.\n\nI want you to output the content types, and the number of the pages that are categorized in that content type in the "Content Type" column. In the "Pages" column, list ONLY the corresponding position numbers (e.g., 1, 2, 3) for the categorized pages. **DO NOT include URLs in the output table.**\n\nThe positions, titles, descriptions and URLs are given below\n\n${serpResults}\n\nRespond ONLY with the markdown table. Do not include any other text, explanations, or formatting like \\\`\\\`\\\`.\n\n---
CRITICAL OUTPUT INSTRUCTIONS:
- Keep the content within the table cells concise and focused.
- Avoid overly long descriptions or justifications.
---
`;

export const getUserIntentAnalysisPrompt = async ({
  query,
  serpResults,
  relatedKeywordsRaw, // Raw string with keywords and volumes
}: {
  query: string;
  serpResults: string;
  relatedKeywordsRaw: string;
}) => {
  // Process related keywords for potential inclusion in the prompt (AI will handle final formatting)
  const keywordLines = relatedKeywordsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes(","));

  const keywordsData = keywordLines.map((line) => {
    const parts = line.split(",");
    const keywordName = parts.slice(0, -1).join(",").trim(); // Handle keywords with commas
    const volumeStr = parts[parts.length - 1].trim();
    const volume = parseInt(volumeStr, 10);
    return {
      keyword: keywordName,
      volume: isNaN(volume) ? "?" : volume, // Use '?' if volume is not a number
    };
  });

  // --- MODIFIED INSTRUCTIONS for Related Keywords ---
  // Ask for a summary/themes instead of exhaustive tables.
  const keywordSectionInstructions =
    keywordsData.length > 0
      ? `\n\n#### Related Keywords Summary\n\nBelow is raw data for related keywords and their search volume, illustrating the *variety* of potential user intentions related to '${query}'. Please analyze these keywords.\nInstead of creating tables for every keyword, **summarize the main themes or types of related keywords** associated with each user intent category identified earlier. Briefly mention 1-2 example keywords per category where relevant.\n\n**Provided Keywords Data:**\n${relatedKeywordsRaw}\n`
      : `\n[No related keywords data provided or found](https://keywordseverywhere.com/seo-reports.html#faq).\n`;
  // --- END MODIFICATION ---

  return `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in User Intent analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided query, SERP results (titles and descriptions), and related keywords data. Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* as Markdown content (User Intent table followed by Related Keyword summary) as requested later.\n4.  **Behavior:**\n    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.\n    *   Do NOT engage in conversation or ask clarifying questions.\n    *   Do NOT use markdown formatting (like \`\`\`.\`) around the final output blocks.\n    *   Adhere strictly to the 4 user intent types defined below.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: User Intent Analysis for [${query}]\n\n**What this report does:** The User Intent Analysis report looks at the top webpages ranking on the first page for the query '${query}'. It analyzes the **titles** to understand the user's primary **commitment** or goal, and the **descriptions** to infer the expected **website type or context** for fulfilling that commitment. It categorizes these findings by user intent and summarizes relevant related keywords.\n\n**When to use this report:** Use this report to understand the core goal (commitment) users have for the query '${query}' and the type of site/information they expect. This helps align your content strategy before writing.\n\nYou know that there are four types of search intent - Navigational, Informational, Commercial & Transactional.\n
#### User Intent Analysis\n\nPlease create a markdown table with three columns "Search Intent Category", "Actual Intent", and "Pages".\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${query}".\n\nI am listing below the positions, titles, descriptions and URLs of the top pages. Analyze them carefully:\n1.  Focus on the **Title** to determine the user's primary **commitment** or goal.\n2.  Examine the **Description** to understand the **context** or the expected **type of website/information** the user seeks to satisfy their commitment.\n3.  Figure out the user intent category (Navigational, Informational, Commercial, Transactional) that each page serves based on this analysis.\n4.  Collate the results by intent category.\n\n- In the "Search Intent Category" column, list the type (Navigational, Informational, Commercial, Transactional).\n- In the "Actual Intent" column, describe the specific **commitment/goal** inferred (e.g., "Find a step-by-step guide", "Compare product options", "Access official login page") and include the count of pages matching this specific intent. Use the description analysis for context. **Keep these descriptions concise (e.g., under 10 words).**\n- In the "Pages" column, list ONLY the corresponding position numbers (e.g., 1, 2, 3) for the categorized pages. **DO NOT include URLs in the output table.**\n\nThe positions, titles, descriptions and URLs are given below:\n\n${serpResults}\n\nIdeally your content should target one of a primary user commitment identified. Targeting multiple is acceptable if relevant.\n\n${keywordSectionInstructions}\n\n| Warning                                                                                                                                                           |\n| :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Please ensure that your Keywords Everywhere Settings for [Credit Usages for Widgets] are all enabled. If not, then LLM will hallucinate the search volume data in this report. |\n\nRespond ONLY with the markdown content described above (User Intent table followed by Related Keyword summary). Do not include any other text, explanations, or formatting like \`\`\`.\n\n---
CRITICAL OUTPUT INSTRUCTIONS:
- Keep descriptions and justifications within table cells brief and focused on the user's core commitment/goal, especially in the "Actual Intent" column.
- Ensure the Related Keywords section is a summary, not exhaustive tables.
- Ensure all generated markdown is essential for the report.
---
`;
};

export const getSerpTitleAnalysisPrompt = async (
  keyword: string,
  serpResults: string
) => `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in SERP Title analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided keyword and SERP results. Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* as a valid JSON object matching the structure specified later.\n4.  **Behavior:**\n    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object itself.\n    *   Do NOT engage in conversation or ask clarifying questions.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: Analyze SERP Titles for [${keyword}]\n\n**What this report does:** The Analyze SERP Titles report looks at the top webpages ranking in Google on the first page for the search query and tries to find patterns in them. It explains what it finds and gives recommendations for the title and also suggests a title for your content.\n\n**When to use this report:** The Analyze SERP Titles report should be used before you start writing content, by creating the page title. Read the recommendations and feel free to ask for more suggested page titles.\n\nYou know that there are four types of search intent - Navigational, Informational, Commercial & Transactional. You are able to figure out the exact search intent and then categorize it into one of the four types of search intent.\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".\n\nI am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze the titles and find what is common among all of them. Finally, also create a new title that has the best of everything that is common.\n\nThe positions, titles, descriptions and URLs are given below:\n\n${serpResults}\n\nWhen you mention any position, display the link of the URL and use the number of the position as the anchor text.\n\nRespond with a JSON object with the following structure:\n{
  "title": "Your suggested optimized title",
  "analysis": "Your detailed analysis of the SERP titles",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}\n\nDo not include any text outside of this JSON structure. Return valid JSON only.\n\n---
CRITICAL OUTPUT INSTRUCTIONS:
- Ensure the strings for "title", "analysis", and items in "recommendations" are concise and essential.
- Avoid verbose language in the "analysis" field; summarize key findings.
---
`;

export const getContentTypeRecommendationPrompt = async (
  markdownAnalysisText: string
) =>
  `You are an expert SEO analyst reviewing a Content Type Analysis report (in Markdown format). Based *only* on the provided report, generate a concise, actionable recommendation for the user on which content type(s) to focus on.

**CRITICAL INSTRUCTIONS:**
1.  **Input:** Analyze the provided Markdown report.
2.  **Task:** Identify the dominant content type(s) suggested by the analysis.
3.  **Output Format:** Respond *only* with a single sentence recommendation starting with "建議撰寫" (Suggest writing), followed by the most prominent content type, and a brief "因為" (because) justification based *directly* on the report's findings (e.g., highest frequency).
    *   Example: 建議撰寫 How to guides content type 因為：這是 SERP 中最常見的類型。
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, or explanations beyond the single sentence.
    *   Do NOT refer to yourself or the process.
    *   Base the recommendation solely on the input Markdown.

**Input Markdown Report:**
\`\`\`markdown
${markdownAnalysisText}
\`\`\`

Respond ONLY with the single recommendation sentence.

---
CRITICAL OUTPUT INSTRUCTIONS:
- Adhere STRICTLY to the single-sentence format: "建議撰寫 [TYPE] content type 因為：[REASON]".
- The reason MUST be extremely brief and directly derived from the input.
- Output ONLY this sentence and nothing else.
---
`;

export const getUserIntentRecommendationPrompt = async (
  markdownAnalysisText: string,
  keyword: string
) =>
  `You are an expert SEO analyst reviewing a User Intent Analysis report (in Markdown format) for the keyword "[${keyword}]". Based *only* on the provided report, generate a concise, actionable recommendation for the user regarding matching user intent.

**CRITICAL INSTRUCTIONS:**
1.  **Input:** Analyze the provided Markdown report for the keyword "[${keyword}]".
2.  **Task:** Identify the primary user intent category and the specific sub-intents mentioned.
3.  **Output Format:** Respond *only* with a single sentence following this exact template: "建議要匹配用戶意圖，因為關鍵字 ${keyword} 的用戶意圖主要是 \${primary_intent_category}，推測可能包含幾種不同的子意圖包括 \${sub_intent_1}, \${sub_intent_2}, ..."
    *   Replace \`\${keyword}\` with the actual keyword.
    *   Replace \`\${primary_intent_category}\` with the most dominant category (Informational, Transactional, etc.) found in the report.
    *   Replace \`\${sub_intent_1}, \${sub_intent_2}, ...\` with the specific "Actual Intent" descriptions listed for that primary category in the report. List at least one, and up to three if available.
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, or explanations beyond the single sentence.
    *   Do NOT refer to yourself or the process.
    *   Base the recommendation solely on the input Markdown.

**Input Markdown Report:**
\`\`\`markdown
${markdownAnalysisText}
\`\`\`

Respond ONLY with the single recommendation sentence matching the template.

---
CRITICAL OUTPUT INSTRUCTIONS:
- Adhere STRICTLY to the single-sentence template provided.
- List only the most relevant sub-intents (max 3).
- Output ONLY this sentence and nothing else.
---
`;

export const getTitleRecommendationPrompt = async (titleAnalysisText: string) =>
  `You are an expert SEO analyst reviewing a title analysis report (provided as text). Based *only* on the provided text, generate a concise, actionable recommendation for the user.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Input:** The raw text of the title analysis report. This text contains both the suggested title and the analysis reasoning.\n2.  **Task:** Formulate a recommendation using the provided title and analysis.\n3.  **Output Format:** Respond *only* with a single sentence following this exact template: "建議使用的標題：[The Title Extracted From Input] 因為：[Brief Summary Of Analysis From Input]".\n4.  **Behavior:**\n    *   You MUST extract the suggested title from the input text to replace \`[The Title Extracted From Input]\`.\n    *   You MUST extract or synthesize a brief summary of the analysis reasoning from the input text to replace \`[Brief Summary Of Analysis From Input]\`. Keep it concise.\n    *   Do NOT add any introductory text, concluding remarks, or explanations beyond the single sentence.\n    *   Do NOT refer to yourself or the process.\n    *   Base the recommendation solely on the input analysis text provided below.\n\n**Analysis Text:**\n${titleAnalysisText}\n\nRespond ONLY with the single recommendation sentence matching the template.\n\n---
CRITICAL OUTPUT INSTRUCTIONS:
- Adhere STRICTLY to the single-sentence template: "建議使用的標題：[TITLE] 因為：[SUMMARY]".
- The summary MUST be extremely brief ( ideally a short phrase) derived directly from the analysis.
- Output ONLY this sentence and nothing else.
---
`;

export const getBetterHaveInArticlePrompt = async (
  keyword: string,
  serpString: string, // Formatted organic results (titles/descriptions)
  paaString: string, // Formatted People Also Ask
  relatedQueriesString: string, // Formatted Related Queries
  aiOverviewString: string // Formatted AI Overview
) =>
  `You are an expert SEO Content Strategist analyzing SERP data for the keyword "[${keyword}]" to identify crucial elements for a high-quality, trustworthy article.

**TASK:**
Analyze the provided SERP data (Organic Results, People Also Ask, Related Queries, AI Overview) to identify 5-10 specific topics, questions, concepts, or phrases (beyond just the core keyword phrase itself) that are essential to include in an article about "[${keyword}]". The goal is to create content that comprehensively satisfies user intent, addresses related concerns apparent in the SERP, builds reader trust, and stands out from competitors.

**INPUT DATA:**

*   **Keyword:** ${keyword}
*   **Organic Results (Top 15 Titles/Descriptions):**
    ${serpString}
*   **People Also Ask:**
    ${paaString}
*   **Related Queries:**
    ${relatedQueriesString}
*   **AI Overview (if available):**
    ${aiOverviewString}

**OUTPUT FORMAT:**
Generate a Markdown bulleted list. Each bullet point should represent a distinct recommendation. For each recommendation, briefly explain *why* it's important based *only* on the provided SERP data (e.g., "Addresses a common PAA question", "Featured in multiple top descriptions", "Covers a related search query", "Key point from AI overview").

Example:
*   **Include a section comparing X and Y:** Justification: This comparison appears in several top descriptions and addresses a related query.
*   **Answer the question "How to do Z?":** Justification: This is a direct question from People Also Ask.
*   **Mention the importance of [Specific Concept]:** Justification: This concept was highlighted in the AI Overview and appears in titles.

**CRITICAL INSTRUCTIONS:**
1.  **Focus:** Identify elements that enhance comprehensiveness, user trust, and address related user needs shown in the SERP.
2.  **Specificity:** Provide concrete topics, questions, or phrases. Avoid generic advice like "write high-quality content".
3.  **Justification:** Link every recommendation back to specific evidence within the provided SERP data sections.
4.  **Data Source:** Base your analysis *strictly* on the provided input data. Do not use external knowledge.
5.  **Format:** Respond *only* with the Markdown bulleted list as described. Do not add introductions, summaries, or other text.

Respond ONLY with the markdown bulleted list.

---
CRITICAL OUTPUT INSTRUCTIONS:
- Each bullet point should be concise.
- Justifications must be brief and directly reference the input data source (e.g., "PAA", "Top description", "Related query").
- Avoid verbose explanations.
---
`;

export const getBetterHaveRecommendationPrompt = async (
  markdownAnalysisText: string,
  keyword: string
) =>
  `You are an expert SEO analyst reviewing a "Better Have In Article" analysis report (in Markdown bullet list format) for the keyword "[${keyword}]". Based *only* on the provided report, generate a concise, actionable 1-2 sentence summary recommendation for the user.

**CRITICAL INSTRUCTIONS:**
1.  **Input:** Analyze the provided Markdown bullet list report.
2.  **Task:** Summarize the most important themes or types of recommendations emerging from the list (e.g., addressing PAA, competitor features, related topics).
3.  **Output Format:** Respond *only* with a 1-2 sentence recommendation focusing on the key takeaways.
    *   Example: 建議文章中應重點處理 People Also Ask 的問題，並涵蓋 SERP 中常見的比較性內容，以建立信任感。 (Suggest the article should focus on addressing People Also Ask questions and cover comparative content common in the SERP to build trust.)
4.  **Behavior:**
    *   Do NOT simply repeat the bullet points. Synthesize the main ideas.
    *   Do NOT add introductory text, concluding remarks, or explanations beyond the 1-2 sentences.
    *   Do NOT refer to yourself or the process.
    *   Base the recommendation solely on the input Markdown.

**Input Markdown Report:**
\`\`\`markdown
${markdownAnalysisText}
\`\`\`

Respond ONLY with the 1-2 sentence recommendation summary.

---
CRITICAL OUTPUT INSTRUCTIONS:
- Synthesize the core themes into 1, or at most 2, brief sentences.
- Be EXTREMELY concise and actionable.
- Do NOT list individual points from the input.
- Output ONLY the 1-2 sentences and nothing else.
---
`;

export async function submitCreateSerp({
  query,
  region,
  language,
}: {
  query: string;
  region: string;
  language: string;
}): Promise<{
  success: boolean;
  error?: string;
  id?: string;
  originalKeyword?: string;
}> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  try {
    // 1. Try to find existing data using the read function
    // findSerpResultObjects now returns FirebaseSerpResultObject | null
    const existingData = await findSerpResultObjects({
      query,
      region,
      language,
    });
    if (existingData) {
      console.log(
        `[Action: Create/Fetch] Found existing SERP data in DB: ${existingData.id}`
      );
      if (
        !existingData.id ||
        typeof existingData.originalKeyword !== "string"
      ) {
        console.error(
          "[Action: Create/Fetch] Existing data is missing ID or originalKeyword",
          existingData
        );
        return {
          success: false,
          error:
            "Found existing SERP data but it is missing required fields (id or originalKeyword).",
        };
      }
      return {
        success: true,
        id: existingData.id,
        originalKeyword: existingData.originalKeyword,
      };
    }

    // 2. Not found, fetch from external service
    console.log(
      `[Action: Create/Fetch] Fetching from SERP service for ${query} (R: ${region}, L: ${language})...`
    );
    let fetchedData;
    try {
      fetchedData = await fetchSerpByKeyword({ query, region, language });
    } catch (fetchError) {
      console.error(
        `[Action: Create/Fetch] Error fetching from SERP service for ${query}:`,
        fetchError
      );
      throw new Error(
        `Failed to fetch data from SERP service: ${
          fetchError instanceof Error ? fetchError.message : String(fetchError)
        }`
      ); // Re-throw to be caught by outer catch
    }

    if (!fetchedData) {
      // This case handles if fetchSerpByKeyword resolves successfully but returns null/undefined
      console.error(
        `[Action: Create/Fetch] SERP service returned no data for ${query}.`
      );
      throw new Error("SERP service returned no data.");
    }
    console.log(
      `[Action: Create/Fetch] Successfully fetched data from SERP service for ${query}.`
    );

    // 3. Prepare data for saving
    // Target type is FirebaseSerpResultObject, but without id/timestamps initially
    const dataToSave: Omit<
      FirebaseSerpResultObject,
      "id" | "createdAt" | "updatedAt"
    > = {
      // Spread fetched data (matches schema closely now)
      ...fetchedData,
      // Explicitly set required fields
      originalKeyword: query,
      normalizedKeyword: query, // Keep normalized for potential future use
      region: region,
      language: language,
      // Overwrite/Map specific fields if needed (e.g., ensure arrays)
      relatedQueries: fetchedData.relatedQueries?.filter((q) => q) ?? [], // Keep filter
      paidResults: fetchedData.paidResults ?? [],
      paidProducts: fetchedData.paidProducts ?? [],
      peopleAlsoAsk: fetchedData.peopleAlsoAsk?.filter((paa) => paa) ?? [], // Keep filter
      // Keep mapping for organic results for stricter validation/structure
      organicResults:
        fetchedData.organicResults
          ?.filter(
            (org) =>
              org &&
              org.position != null &&
              org.title != null &&
              org.url != null
          )
          .map((org) => ({
            position: org!.position!,
            title: org!.title!,
            url: org!.url!,
            description: org!.description ?? undefined,
            displayedUrl: org!.displayedUrl ?? undefined,
            emphasizedKeywords: org!.emphasizedKeywords ?? [],
            siteLinks:
              org!.siteLinks?.map((link) => ({
                title: link.title ?? null,
                url: link.url ?? null,
                description: link.description ?? null,
              })) ?? [],
            productInfo: org!.productInfo ?? null,
            type: org!.type ?? null,
            date: org!.date ?? null,
            views: org!.views ?? null,
            lastUpdated: org!.lastUpdated ?? null,
            commentsAmount: org!.commentsAmount ?? null,
            followersAmount: org!.followersAmount ?? null,
            likes: org!.likes ?? null,
            channelName: org!.channelName ?? null,
          })) ?? [],
      contentTypeAnalysisText: null,
      userIntentAnalysisText: null,
      titleAnalysisText: null,
      betterHaveAnalysisText: null,
      contentTypeRecommendationText: null,
      userIntentRecommendationText: null,
      titleRecommendationText: null,
      betterHaveRecommendationText: null,
      urlOutline: null,
    };

    // 4. Save directly using db access (no converter)
    console.log(
      `[Action: Create/Fetch] Preparing to save data for ${query} to Firestore...`
    );
    const collectionRef = db.collection(COLLECTIONS.SERP_RESULT);
    const dataWithTimestamp = {
      ...dataToSave,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let newDocRef;
    try {
      newDocRef = await collectionRef.add(dataWithTimestamp);
    } catch (saveError) {
      console.error(
        `[Action: Create/Fetch] Error saving data to Firestore for ${query}:`,
        saveError
      );
      throw new Error(
        `Failed to save data to Firestore: ${
          saveError instanceof Error ? saveError.message : String(saveError)
        }`
      ); // Re-throw
    }

    const newDocId = newDocRef.id;
    console.log(
      `[Action: Create/Fetch] Successfully saved new SERP data for ${query} with ID: ${newDocId}`
    );

    // 5. Revalidate cache
    revalidateTag(SERP_DATA_LIST_TAG);

    // 6. Return success with new ID and the original query used
    console.log(
      `[Action: Create/Fetch] Returning success for newly created doc ID: ${newDocId}, Keyword: ${query}.`
    );
    return { success: true, id: newDocId, originalKeyword: query };
  } catch (error) {
    // Log the specific error message generated within the try block
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Action: Create/Fetch] Final Catch Block - Failure for ${query} (R: ${region}, L: ${language}): ${errorMessage}`,
      error // Log the full error object as well for stack trace etc.
    );
    // Return the specific error message
    return {
      success: false,
      error: `Create/Fetch failed: ${errorMessage}`, // Prepend context to the specific error
    };
  }
}

/**
 * Action: Perform Content Type Analysis (Generates Text & JSON, returns recommendation).
 */
export async function submitAiAnalysisSerpContentType({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  console.log(`[Action] submitAiAnalysisSerpContentType for docId: ${docId}`);

  const serpData = await getSerpResultById(docId);

  if (!serpData) {
    console.error(`[Action Error] Document not found for docId: ${docId}`);
    return { success: false, error: "Document not found" };
  }
  if (!serpData.originalKeyword) {
    console.error(`[Action Error] Keyword missing for docId: ${docId}`);
    return { success: false, error: "Keyword missing in document" };
  }
  if (!serpData.organicResults || serpData.organicResults.length === 0) {
    console.error(`[Action Error] Organic results missing for docId: ${docId}`);
    return { success: false, error: "Organic results missing or empty" };
  }

  // --- MODIFIED CHECK ---
  // Check if analysis data exists AND if the 'contentTypes' array has items
  if ((serpData as any)?.analysisContentType?.contentTypes?.length > 0) {
    console.log(
      `[Action Skip] Content type analysis already exists for docId: ${docId}`
    );
    return { success: true, id: docId }; // Analysis already done
  }

  // Mark as processing
  const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
  await docRef.update({
    statusAnalysisContentType: "processing",
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    // Extract keyword after confirming serpData is not null
    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Content Type] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`,
      };
    }

    // Construct required strings using the validated serpData
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (
          r: {
            title?: string | null | undefined;
            url?: string | null | undefined;
            description?: string | null | undefined;
          },
          index: number
        ) =>
          `${index + 1}. ${r.title ?? ""} (${r.url ?? ""})${
            r.description ? "\\n   " + r.description : ""
          }`
      )
      .join("\\n\\n");

    // 1. Generate Text Analysis
    console.log(
      `[Action: Analyze Content Type] Calling AI for Text Analysis...`
    );
    const textPrompt = await getContentTypeAnalysisPrompt(keyword, serpString);
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.BASE,
      prompt: textPrompt,
    });
    console.log(`[Action: Analyze Content Type] Text Analysis successful.`);

    // 2. Generate JSON Analysis from Text -> CHANGED to Generate Text
    console.log(
      `[Action: Analyze Content Type] Calling AI for Text Conversion...`
    );

    // 3. Generate Recommendation from Text
    console.log(
      `[Action: Analyze Content Type] Calling AI for Recommendation...`
    );
    const recommendationPrompt =
      await getContentTypeRecommendationPrompt(rawAnalysisText);
    const { text: rawRecommendationText } = await generateText({
      model: AI_MODELS.FAST,
      prompt: recommendationPrompt,
    });
    console.log(`[Action: Analyze Content Type] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(
      `[Action: Analyze Content Type] Updating Firestore directly...`
    );
    await docRef.update({
      contentTypeRecommendationText: rawRecommendationText,
      contentTypeAnalysisText: rawAnalysisText,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: Analyze Content Type] Firestore updated.`);

    // 6. Return success
    return {
      success: true,
      id: docId,
    };
  } catch (error) {
    console.error(
      `[Action: Analyze Content Type] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `Content Type Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Action: Perform User Intent Analysis (Generates Text & JSON, returns recommendation).
 */
export async function submitAiAnalysisSerpUserIntent({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  console.log(`[Action: Analyze User Intent] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(
      `[Action: Analyze User Intent] Fetching data for Doc ID: ${docId}`
    );
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze User Intent] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze User Intent] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze User Intent] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`,
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? "\\n   " + r.description : ""
          }`
      )
      .join("\\n\\n");
    const relatedKeywordsRaw = (serpData.relatedQueries ?? []).join(", ");

    // 1. Generate Text Analysis
    console.log(
      `[Action: Analyze User Intent] Calling AI for Text Analysis...`
    );
    const textPrompt = await getUserIntentAnalysisPrompt({
      query: keyword,
      serpResults: serpString,
      relatedKeywordsRaw,
    });
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.BASE,
      prompt: textPrompt,
    });
    console.log(`[Action: Analyze User Intent] Text Analysis successful.`);

    // 2. Generate Recommendation from Text
    console.log(
      `[Action: Analyze User Intent] Calling AI for Recommendation...`
    );
    const recommendationPrompt = await getUserIntentRecommendationPrompt(
      rawAnalysisText,
      keyword
    );
    const { text: rawRecommendationText } = await generateText({
      model: AI_MODELS.FAST,
      prompt: recommendationPrompt,
    });
    console.log(`[Action: Analyze User Intent] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(`[Action: Analyze User Intent] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      userIntentRecommendationText: rawRecommendationText,
      userIntentAnalysisText: rawAnalysisText,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: Analyze User Intent] Firestore updated.`);

    // 5. Revalidate Cache

    // 6. Return success
    return {
      success: true,
      id: docId,
    };
  } catch (error) {
    console.error(
      `[Action: Analyze User Intent] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `User Intent Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Action: Perform Title Analysis (Generates JSON, returns JSON and recommendation).
 */
export async function submitAiAnalysisSerpTitle({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  console.log(`[Action: Analyze Title] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(`[Action: Analyze Title] Fetching data for Doc ID: ${docId}`);
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze Title] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze Title] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Title] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`,
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? "\n   " + r.description : ""
          }`
      )
      .join("\n\n");

    // 1. Generate JSON Analysis directly -> CHANGED to Generate Text
    console.log(`[Action: Analyze Title] Calling AI for Text Analysis...`);
    const analysisPrompt = await getSerpTitleAnalysisPrompt(
      keyword,
      serpString
    );
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.FAST,
      prompt: analysisPrompt,
    });
    console.log(`[Action: Analyze Title] Text Analysis successful.`);

    // 2. Generate Recommendation from JSON -> CHANGED to generate from Text
    console.log(`[Action: Analyze Title] Calling AI for Recommendation...`);
    const titleRecommendationPrompt =
      await getTitleRecommendationPrompt(rawAnalysisText);
    const { text: rawRecommendationText } = await generateText({
      model: AI_MODELS.FAST,
      prompt: titleRecommendationPrompt,
    });
    console.log(`[Action: Analyze Title] Recommendation generated.`);

    // 3. Update Firestore directly
    console.log(`[Action: Analyze Title] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      titleAnalysisText: rawAnalysisText, // Store raw analysis text
      titleRecommendationText: rawRecommendationText, // Need to add this field to schema if required
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: Analyze Title] Firestore updated.`);

    // 5. Return success
    return {
      success: true,
      id: docId,
    };
  } catch (error) {
    console.error(`[Action: Analyze Title] Failed for Doc ID ${docId}:`, error);
    return {
      success: false,
      error: `Title Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Action: Perform Better Have Analysis (Generates Text & JSON, returns JSON and recommendation).
 */
export async function submitAiAnalysisSerpBetterHave({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: "Database not initialized" };
  }

  console.log(`[Action: Analyze Better Have] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch SERP data directly
    console.log(
      `[Action: Analyze Better Have] Fetching data for Doc ID: ${docId}`
    );
    const serpData = await getSerpResultById(docId);
    if (!serpData) {
      console.error(
        `[Action: Analyze Better Have] SERP data not found for Doc ID: ${docId}`
      );
      return { success: false, error: `SERP data not found for ID: ${docId}` };
    }
    console.log(`[Action: Analyze Better Have] Successfully fetched data.`);

    const keyword = serpData.originalKeyword;
    if (!keyword) {
      console.error(
        `[Action: Analyze Better Have] Original keyword missing for Doc ID: ${docId}`
      );
      return {
        success: false,
        error: `Original keyword missing for ID: ${docId}`,
      };
    }

    // Construct required strings
    const serpString = (serpData.organicResults ?? [])
      .slice(0, SERP_ANALYSIS_ORGANIC_RESULTS_LIMIT)
      .map(
        (r, index) =>
          `${index + 1}. ${r.title} (${r.url})${
            r.description ? "\n   " + r.description : ""
          }`
      )
      .join("\n\n");
    const paaString = (serpData.peopleAlsoAsk ?? [])
      .map((q) => `- ${q}`)
      .join("\n");
    const relatedQueriesString = (serpData.relatedQueries ?? []).join(", ");
    // Handle aiOverview potentially being an object
    const aiOverviewContent =
      typeof serpData.aiOverview === "object" && serpData.aiOverview !== null
        ? serpData.aiOverview.content
        : null;
    const aiOverviewString = aiOverviewContent ?? "";

    // 1. Generate Text Analysis (Markdown bullet list)
    console.log(
      `[Action: Analyze Better Have] Calling AI for Text Analysis...`
    );
    const textPrompt = await getBetterHaveInArticlePrompt(
      keyword,
      serpString,
      paaString,
      relatedQueriesString,
      aiOverviewString
    );
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.BASE,
      prompt: textPrompt,
    });
    console.log(`[Action: Analyze Better Have] Text Analysis successful.`);

    // 2. Generate Recommendation from Text
    console.log(
      `[Action: Analyze Better Have] Calling AI for Recommendation...`
    );
    const betterHaveRecommendationPrompt =
      await getBetterHaveRecommendationPrompt(rawAnalysisText, keyword);
    const { text: rawRecommendationText } = await generateText({
      model: AI_MODELS.FAST,
      prompt: betterHaveRecommendationPrompt,
    });
    console.log(`[Action: Analyze Better Have] Recommendation generated.`);

    // 4. Update Firestore directly
    console.log(`[Action: Analyze Better Have] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.SERP_RESULT).doc(docId);
    await docRef.update({
      betterHaveRecommendationText: rawRecommendationText,
      betterHaveAnalysisText: rawAnalysisText,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[Action: Analyze Better Have] Firestore updated.`);

    // 5. Revalidate Cache

    // 6. Return success
    return {
      success: true,
      id: docId,
    };
  } catch (error) {
    console.error(
      `[Action: Analyze Better Have] Failed for Doc ID ${docId}:`,
      error
    );
    return {
      success: false,
      error: `Better Have Analysis failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

// --- NEW SERVER ACTION TO FETCH SERP DATA BY ID ---
export async function getSerpDataAction(
  docId: string
): Promise<FirebaseSerpResultObject | null> {
  if (!docId) {
    console.error("[Action: Get SERP Data] Received empty docId.");
    return null;
  }
  console.log(`[Action: Get SERP Data] Fetching SERP data for ID: ${docId}`);
  try {
    // Directly call the database function
    const serpData = await getSerpResultById(docId);

    if (!serpData) {
      console.warn(
        `[Action: Get SERP Data] No SERP data found for ID: ${docId}`
      );
      return null; // Return null if not found
    }
    console.log(
      `[Action: Get SERP Data] SERP data fetched successfully for ID: ${docId}`
    );
    return serpData; // Return the fetched object
  } catch (error) {
    console.error(
      `[Action: Get SERP Data] Error fetching SERP data for ID ${docId}:`,
      error
    );
    // Optionally, throw or return null
    return null; // Returning null to prevent crashing the client
  }
}
// --- END SERVER ACTION ---
