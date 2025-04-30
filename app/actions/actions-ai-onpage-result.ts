'use server';

import { COLLECTIONS, db } from '@/app/services/firebase/db-config';
import { AI_MODELS } from '@/app/global-config';
import { getOnPageResultById, FirebaseOnPageResultObject } from '@/app/services/firebase/data-onpage-result'; // Assuming this exists
import { generateText } from 'ai';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Prompt for generating a content summary and extracting keywords as PLAIN TEXT.
 */
export const getOnPageContentSummaryPrompt = async (textContent: string): Promise<string> => {
  // Construct prompt for plain text output
  const promptLines = [
    `You are an expert SEO analyst specializing in content summarization and keyword identification.`,
    `Analyze the following TEXT CONTENT extracted from a webpage.`,
    ``,
    `**TASK:**`,
    `1.  **Summarize:** Generate a concise (2-3 sentences) summary of the main topics covered in the text.`,
    `2.  **Keywords:** Identify and list the top 5-10 most relevant keywords or key phrases from the text. Focus on terms that represent the core subject matter.`,
    `3.  **Format:** Return the response as PLAIN TEXT. Use Markdown headers to clearly separate the sections:`, // Updated format instruction
    `    ## Summary`,
    `    [Your 2-3 sentence summary here]`,
    ``,
    `    ## Keywords`,
    `    * Keyword 1`, // Example list format
    `    * Keyword 2`,
    `    * Key phrase 3`,
    `    * ...`,
    ``,
    `**CRITICAL INSTRUCTIONS:**`,
    `*   Base your analysis *only* on the provided TEXT CONTENT. Do not use external knowledge.`,
    `*   Adhere strictly to the requested PLAIN TEXT format with Markdown headers.`, // Emphasize plain text
    `*   Do NOT output JSON or any code formatting.`,
    `*   Keep the summary brief and focused.`,
    `*   Select keywords that are central to the text's meaning.`,
    ``,
    `**TEXT CONTENT:**`,
    `---`,
    `${textContent.substring(0, 15000)}`,
    `---`,
    ``,
    `Respond ONLY with the formatted plain text.` // Final instruction
  ];
  return promptLines.join('\n');
}


/**
 * Action: Perform On-Page Content Summary and Keyword Extraction Analysis (Plain Text Output).
 */
export async function submitAiAnalysisOnPageSummary({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: OnPage Summary TXT] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch OnPage data directly
    const onPageData: FirebaseOnPageResultObject | null = await getOnPageResultById(docId);
    if (!onPageData) {
      console.error(`[Action: OnPage Summary TXT] OnPage data not found for Doc ID: ${docId}`);
      return { success: false, error: `OnPage data not found for ID: ${docId}` };
    }

    // Check if textContent exists
    if (!onPageData.textContent || onPageData.textContent.trim().length === 0) {
      console.error(`[Action: OnPage Summary TXT] textContent missing or empty for Doc ID: ${docId}`);
      return { success: false, error: 'Text content is missing or empty in the document.' };
    }

    // 1. Generate Text Analysis
    console.log(`[Action: OnPage Summary TXT] Calling AI for Text Analysis...`);
    const analysisPrompt = await getOnPageContentSummaryPrompt(onPageData.textContent);
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.BASE,
      prompt: analysisPrompt,
    });
    console.log(`[Action: OnPage Summary TXT] Text Analysis successful.`);

    // 2. Update Firestore directly (Save raw text)
    console.log(`[Action: OnPage Summary TXT] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
    await docRef.update({
      onPageContentAnalysisText: rawAnalysisText, // Store the raw analysis text
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: OnPage Summary TXT] Firestore updated.`);

    // 3. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(`[Action: OnPage Summary TXT] Failed for Doc ID ${docId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     try {
         const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
         await docRef.update({
             updatedAt: FieldValue.serverTimestamp()
         });
     } catch (updateError) {
         console.error(`[Action: OnPage Summary TXT] Failed to update status for Doc ID ${docId}:`, updateError);
     }
    return {
      success: false,
      error: `On-Page Content Summary Analysis failed: ${errorMessage}`
    };
  }
}

// ==========================================================================
// == On-Page Ranking Factor Analysis V2 (Qualitative Assessment)
// ==========================================================================

// Updated Checklist based on user feedback and text-assessability
const RANKING_FACTORS_CHECKLIST_V3 = `
**Content Quality & Relevance:**
- Quality Content (Overall Value, Informativeness, Relevance)
- Page Covers Topic In-Depth
- Content Provides Value and Unique Insights
- Useful Content
- Entity Match (Relevance to inferred user intent/entity - *Consider specific keyword context*)
- Page Category (Inferred topic)

**Keywords & Topic Focus:**
- Keyword in Title Tag (Inferred from H1/Text - *Consider specific keyword*)
- Keyword in Description Tag (Inferred from Summary/Text - *Consider specific keyword*)
- Keyword Appears in H1 Tag (Inferred from Structure - *Consider specific keyword*)
- Keyword Prominence (Keyword early in text - *Consider specific keyword*)
- Keyword in H2, H3 Tags (Inferred from Structure - *Consider specific keyword*)
- TF-IDF / Keyword Density (Natural usage vs. stuffing - *Consider specific keyword*)
- LSI Keywords in Content (Use of related terms/synonyms - *Related to specific keyword*)

**Structure & Readability:**
- Content Length (General assessment: comprehensive/superficial?)
- User-Friendly Layout / Formatting (Structure, lists, paragraphs for readability)
- Table of Contents (Mentioned or implied by structure)
- Grammar and Spelling
- Reading Level (Estimate grade level and detail)

**E-A-T & Credibility:**
- E-A-T (Expertise, Authoritativeness, Trustworthiness - Inferred from tone, depth, author, sources)
- Known Authorship (Author mentioned?)
- References and Sources (Citations mentioned?)

**Freshness & Updates:**
- Content Recency (Dates mentioned?)
- Magnitude of Content Updates (Mentions of significant updates?)
- Historical Page Updates (Mentions of update frequency?)

**Linking (Internal/External Mentions):**
- Outbound Link Quality (Mentions/context of external links)
- Outbound Link Theme (Relevance of mentioned external links)
- Number of Internal Links (Mentions of internal linking)
- Quality of Internal Links (Context of mentioned internal links)
- NAP Citations (Name, Address, Phone - Check for mentions/consistency)

**Other Content Elements:**
- Syndicated Content / Originality (Impression based on text)
- Helpful "Supplementary Content" (Mentions of tools, calculators, etc.)
- Multimedia (Mentions of images/videos)
- Affiliate Links (Mentions/context)
- Contact Us Page (Mentions of contact info)

*Factors NOT Assessable from Text Alone (Do Not Assess These):*
- Backlinks, Domain Factors (Age, History, TLD), Technical SEO (Speed, Mobile-friendliness, Crawlability, Schema, etc.), User Interaction Signals (CTR, Bounce Rate, Dwell Time), Brand Signals, Social Signals, Off-Page factors, Webspam factors.
`;

/**
 * Prompt for V2 analyzing text content against a list of on-page ranking factors.
 */
export const getOnPageRankingFactorPromptV2 = async (textContent: string): Promise<string> => {
  const promptLines = [
    `You are an expert SEO analyst performing an in-depth review of a webpage's text content.`,
    `Your task is to meticulously analyze the PROVIDED TEXT CONTENT based *only* on the information present within it. Evaluate the content's likely **on-page SEO strengths and weaknesses** based on the relevant factors in the ON-PAGE RANKING FACTORS CHECKLIST below, as inferred *solely* from the text provided.`,
    ``,
    `**ON-PAGE RANKING FACTORS CHECKLIST (Assess ONLY from Text):**`,`${RANKING_FACTORS_CHECKLIST_V3}`, 
    ``, 
    // --- Few-Shot Examples --- 
    `**FEW-SHOT EXAMPLES OF DESIRED OUTPUT FORMAT & ANALYSIS:**`, 
    ``, 
    `*Example 1 (Hypothetical):*`, 
    `### Table of Contents`, 
    `State: The text appears lengthy and sectioned, but lacks clear hierarchical headings or mention of a table of contents, potentially hindering navigation.`, 
    `Evidence: The document structure relies on simple paragraph breaks rather than distinct H2/H3 sections for its length.`, 
    ``,
    `*Example 2 (Hypothetical - Entity/Keyword Nuance):*`, 
    `### Keyword Appears in H1 Tag`, 
    `State: The inferred H1 likely focuses on "Song Hye-kyo's Short Hairstyles", effectively integrating the main entity (Song Hye-kyo) with the specific ranking keyword concept (short hair).`,
    `Evidence: The initial paragraphs and subsequent headings (like "Boyish Short Hair X Suit") immediately address specific short hairstyles attributed to Song Hye-kyo.`, 
    ``,
    `*Example 3 (Hypothetical):*`, 
    `### E-A-T (Expertise, Authoritativeness, Trustworthiness)`, 
    `State: The content mentions the author, [Author Name], a recognized expert in the field, and cites several research papers, suggesting strong E-A-T signals within the text.`, 
    `Evidence: The text explicitly states "Authored by [Author Name]" and includes phrases like "according to a study published in [Journal Name]...".`,
    ``,
    `*Example 4 (Hypothetical):*`, 
    `### Keyword in H2, H3 Tags`, 
    `State: Cannot Assess from Text`, 
    `Evidence: Determining the specific keywords within HTML heading tags requires analysis of the full HTML structure, not just the extracted text content.`,
    ``, 
    // --- End Few-Shot Examples ---
    `**PROVIDED TEXT CONTENT:**`,`---`,`${textContent.substring(0, 20000)}`,`---`, 
    ``,
    `**ANALYSIS TASK:**`,
    // Add Guideline about Entity-Keyword Relationship
    `*   **Important Context:** Recognize that a page might be about a broader entity (e.g., a person) but rank well for a more specific keyword (e.g., a specific hairstyle). Your analysis should assess how well the text addresses the likely *specific keyword* context within the framework of the main entity.`,
    `For each factor listed in the ON-PAGE RANKING FACTORS CHECKLIST (excluding the 'NOT Assessable' list):`,
    `1.  **Describe State:** Write 1-2 sentences describing the observed state or characteristics of this factor *as inferred solely from the PROVIDED TEXT CONTENT*. Focus on describing *what is present* or *what seems implied* by the text, considering the likely specific keyword context.`,
    `    *   Example (Keyword in H1): Describe how effectively the inferred H1 likely incorporates the *specific keyword concept* alongside the main entity.`, 
    `    *   Example (Entity Match): Describe how well the page likely satisfies a user searching for the *specific keyword*, given the page's focus on the main entity.`,
    `2.  **Provide Evidence:** Write 1 sentence citing specific evidence or examples *from the text* (e.g., structure, phrasing, formatting, mentioned elements, keyword usage related to the *specific topic*) that supports your description.`,
    `    *   Special Guideline (Reading Level): When assessing Reading Level, estimate a specific grade level appropriateness (e.g., \"Suitable for 9th grade and above\") and comment on the detail level (e.g., \"comparable to standard journalistic writing\").`,
    `3.  **Handle Unassessable Factors:** If a factor cannot be assessed from the text, state this clearly. Example: "State: Cannot Assess from Text. Evidence: Analysis requires access to HTML meta tags not present in the text."`,
    ``,
    `**OUTPUT REQUIREMENTS:**`,
    `1.  **Format:** Respond *only* with PLAIN TEXT.`,
    `2.  **Structure:** For each factor, use a Markdown H3 heading (### Factor Name). On the next line, write "State: [Your descriptive sentence(s)]". On the following line, write "Evidence: [Your sentence citing textual evidence]". Add one blank line between factors.`,
    `    *Example:*`,
    `    ### Quality Content (Overall)`,
    `    State: The text provides detailed explanations, covers multiple facets of the topic with clarity, and uses appropriate terminology.`,
    `    Evidence: Examples include the in-depth discussion of [specific concept] and the use of specialized terms like [term1, term2].`,
    `    `,
    `    ### Table of Contents`,
    `    State: The text appears lengthy and sectioned, but lacks clear hierarchical headings or mention of a table of contents, potentially hindering navigation.`,
    `    Evidence: The document structure relies on simple paragraph breaks rather than distinct H2/H3 sections for its length.`,
    `    `,
    `    ### Keyword Appears in H1 Tag`,
    `    State: The initial paragraphs focus heavily on [topic X], suggesting the primary heading likely targets the main keyword effectively.`,
    `    Evidence: The first section immediately introduces [topic X] and related concepts.`,
    `    `,
    `    ### Reading Level`,
    `    State: Suitable for 10th grade and above; the language is accessible but uses some technical terms.`,
    `    Evidence: The text avoids overly complex sentence structures but incorporates terms like [term A, term B].`,
    `    ... (continue for all assessable factors)`,
    `3.  **Content:** Include *only* the analysis (State and Evidence) for each assessable factor.`,
    `4.  **Prohibitions:**`,
    `    *   Do *not* write any introductory or concluding text.`,
    `    *   Do *not* use qualitative judgment words like "Strong", "Weak", "Good", "Bad" unless directly quoting or describing user experience implications (e.g., "potentially hindering navigation"). Focus on description.`,
    `    *   Do *not* use JSON, code blocks, or any other formatting besides Markdown H3 headings.`,
    `    *   Do *not* repeat these instructions or the checklist provided above.`,
  ];
  return promptLines.join('\n');
}

/**
 * Action: Perform On-Page Ranking Factor Analysis V2 AND Generate Recommendation.
 */
export async function submitAiAnalysisOnPageRankingFactorV2({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: OnPage Factors V2] Starting for Doc ID: ${docId}`);

  try {
    const onPageData: FirebaseOnPageResultObject | null = await getOnPageResultById(docId);
    if (!onPageData) {
      console.error(`[Action: OnPage Factors V2] OnPage data not found for Doc ID: ${docId}`);
      return { success: false, error: `OnPage data not found for ID: ${docId}` };
    }

    if (!onPageData.textContent || onPageData.textContent.trim().length === 0) {
      console.error(`[Action: OnPage Factors V2] textContent missing or empty for Doc ID: ${docId}`);
      return { success: false, error: 'Text content is missing or empty for the document.' };
    }

    // --- 1. Generate V2 Analysis Text ONLY --- 
    console.log(`[Action: OnPage Factors V2] Calling AI for V2 Text Analysis...`);
    const analysisPrompt = await getOnPageRankingFactorPromptV2(onPageData.textContent);
    const { text: rawAnalysisText } = await generateText({
      model: AI_MODELS.BASE, 
      prompt: analysisPrompt,
    });
    console.log(`[Action: OnPage Factors V2] V2 Text Analysis successful.`);

    // --- Update Firestore with ONLY V2 Analysis --- 
    const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
    await docRef.update({
      onPageRankingFactorAnalysisV2Text: rawAnalysisText, 
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: OnPage Factors V2] Firestore updated with V2 Analysis.`);

    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(`[Action: OnPage Factors V2] Failed for Doc ID ${docId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Update timestamp on error
    try {
      const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
      await docRef.update({ updatedAt: FieldValue.serverTimestamp() });
    } catch (updateError) {
      console.error(`[Action: OnPage Factors V2] Failed to update timestamp on error for Doc ID ${docId}:`, updateError);
    }
    return {
      success: false,
      error: `On-Page Ranking Factor Analysis V2 failed: ${errorMessage}`
    };
  }
}

// ==========================================================================
// == On-Page Ranking Factor Recommendation V1 (Based on V2 Analysis)
// ==========================================================================

/**
 * Prompt for generating actionable SEO recommendations based on a V2 analysis text.
 */
export const getOnPageRankingFactorRecommendationPrompt = async (
  analysisV2Text: string,
  textContent: string // Added textContent parameter
): Promise<string> => {
  const promptLines = [
    `You are a pragmatic and highly skilled SEO Strategist tasked with providing actionable recommendations based on an analysis of a successful webpage.`,
    `You will be given two inputs:`,
    `1.  **ANALYSIS REPORT:** A detailed report (derived from the original text) analyzing the page's on-page SEO factors (strengths and weaknesses).`,
    `2.  **ORIGINAL TEXT:** The full text content of the webpage itself.`,
    ``,
    `**YOUR GOAL:**`,
    `Review the **ANALYSIS REPORT** to identify the key factors contributing to the page's success (the positive findings). Then, formulate specific, actionable recommendations for *other* pages aiming to achieve similar success, using the format "Because [Analysis Finding], you should [Action], Specifically [How]".`,
    `Use the **ORIGINAL TEXT** as context and reference to understand *how* the successful page implemented the strategies identified in the **ANALYSIS REPORT**. For example, if the report says 'Content Provides Value and Unique Insights', you can look at the original text to see *how* it provided that value (e.g., specific examples, data points, structure) and incorporate that specificity into your recommendation's '[How]' part.`,
    ``,
    `**ANALYSIS REPORT (Input 1):**`,
    `---`,
    `${analysisV2Text.substring(0, 15000)}`, // Keep truncation for analysis report
    `---`,
    ``,
    `**ORIGINAL TEXT (Input 2):**`,
    `---`,
    `${textContent.substring(0, 20000)}`, // Added original text input with truncation
    `---`,
    ``,
    `**TASK & OUTPUT FORMAT:**`,
    `Generate a list of actionable recommendations based *only* on the positive findings evident in the **ANALYSIS REPORT**, using the **ORIGINAL TEXT** for specific examples and context.`,
    `Format *each* recommendation exactly as follows:`,
    `"Because [Concise finding from ANALYSIS REPORT, e.g., 'the page covers the topic in-depth'], you should [Actionable SEO command, e.g., 'expand your content'], Specifically [Concrete example or method, referencing ORIGINAL TEXT context if helpful, e.g., 'by adding sections on related subtopics like X and Y, similar to how the original text detailed Z']."`,
    `Focus on the most impactful positive factors identified in the ANALYSIS REPORT. Aim for 5-10 high-quality recommendations.`,
    ``,
    `**CRITICAL INSTRUCTIONS:**`,
    `*   Base your recommendations directly on the positive findings and effective implementations described in the provided **ANALYSIS REPORT**.`,
    `*   Use the **ORIGINAL TEXT** only to add specificity and concrete examples to the '[How]' part of your recommendations. Do not base recommendations solely on the original text if the finding isn't in the analysis report.`,
    `*   Strictly adhere to the "Because [Finding], you should [Action], Specifically [How]." format for *every* recommendation.`,
    `*   Output *only* the recommendations, one per line.`,
    `*   Do NOT include introductory/concluding text, numbering, bullet points, or Markdown formatting.`,
    `*   Do NOT mention the ANALYSIS REPORT or ORIGINAL TEXT explicitly in your output recommendations.`,
  ];
  return promptLines.join('\n');
}

/**
 * Action: Perform On-Page Ranking Factor Recommendation Analysis (Based on V2).
 */
export async function submitAiAnalysisOnPageRankingFactorRecommendation({
  docId,
}: {
  docId: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!db) {
    return { success: false, error: 'Database not initialized' };
  }

  console.log(`[Action: OnPage Rec V1] Starting for Doc ID: ${docId}`);

  try {
    // 0. Fetch OnPage data directly
    const onPageData: FirebaseOnPageResultObject | null = await getOnPageResultById(docId);
    if (!onPageData) {
      console.error(`[Action: OnPage Rec V1] OnPage data not found for Doc ID: ${docId}`);
      return { success: false, error: `OnPage data not found for ID: ${docId}` };
    }

    // Check if V2 Analysis text exists
    if (!onPageData.onPageRankingFactorAnalysisV2Text || onPageData.onPageRankingFactorAnalysisV2Text.trim().length === 0) {
      console.error(`[Action: OnPage Rec V1] Prerequisite V2 Analysis text missing for Doc ID: ${docId}`);
      return { success: false, error: 'V2 Ranking Factor Analysis text is missing. Please run V2 analysis first.' };
    }

    // Check if original textContent exists (ADDED)
    if (!onPageData.textContent || onPageData.textContent.trim().length === 0) {
        console.error(`[Action: OnPage Rec V1] textContent missing or empty for Doc ID: ${docId}`);
        return { success: false, error: 'Original text content is missing or empty in the document.' };
    }

    // 1. Generate Recommendation Analysis
    console.log(`[Action: OnPage Rec V1] Calling AI for Recommendation Analysis...`);
    const recommendationPrompt = await getOnPageRankingFactorRecommendationPrompt(
        onPageData.onPageRankingFactorAnalysisV2Text,
        onPageData.textContent // Pass textContent here
    );
    const { text: recommendationText } = await generateText({
      model: AI_MODELS.FAST, // Use fast model for recommendations
      prompt: recommendationPrompt,
    });
    console.log(`[Action: OnPage Rec V1] Recommendation Analysis successful.`);

    // 2. Update Firestore directly
    console.log(`[Action: OnPage Rec V1] Updating Firestore directly...`);
    const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
    await docRef.update({
      onPageRankingFactorRecommendationText: recommendationText, // Save the generated recommendations
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log(`[Action: OnPage Rec V1] Firestore updated.`);

    // 3. Return success
    return {
      success: true,
      id: docId
    };
  } catch (error) {
    console.error(`[Action: OnPage Rec V1] Failed for Doc ID ${docId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     try {
         const docRef = db.collection(COLLECTIONS.ONPAGE_RESULT).doc(docId);
         await docRef.update({
             updatedAt: FieldValue.serverTimestamp()
         });
     } catch (updateError) {
         console.error(`[Action: OnPage Rec V1] Failed to update status for Doc ID ${docId}:`, updateError);
     }
    return {
      success: false,
      error: `On-Page Recommendation Generation failed: ${errorMessage}`
    };
  }
} 