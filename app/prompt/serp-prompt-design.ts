export const getContentTypeAnalysisPrompt = (
  keyword: string,
  serpResults: string
) =>
  `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in Content Type analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided keyword and SERP results (including titles, descriptions, and URLs). Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* in the format of a Markdown table as requested later in the prompt.\n4.  **Behavior:**\n    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.\n    *   Do NOT engage in conversation or ask clarifying questions.\n    *   Do NOT use markdown formatting (like \`\`\`.\`) around the final table output.\n    *   Adhere strictly to the 8 content types defined below.\n    *   **Crucially, consider both the TITLE and the DESCRIPTION of each result when determining its content type.**\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: Content Type Analysis for [${keyword}]\n\n**What this report does:** The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type.\n\n**When to use this report:** The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.\n\nYou know that there are eight types of content as mentioned below\n\n1. How to guides\n2. Step by step tutorials\n3. List posts\n4. Opinion editorials\n5. Videos\n6. Product pages\n7. Category pages\n8. Landing pages for a service\n\nPlease create a markdown table with two columns "Content Type" and "Pages".\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".\n\nI am listing below the positions, titles, **descriptions** and URLs of the top pages. Can you analyze **both their titles and descriptions** and categorize them based on the 8 content types mentioned earlier? Once done, please collate all the content types together.\n\nI want you to ouput the content types, and the number of the pages that are categorized in that content type in the "Content Type" column. In the "Pages" column I want you to display links to the URLs of those pages. Then Anchor text of the links should be the position number - e.g. 1 or 2 or 3.\n\nThe positions, titles, descriptions and URLs are given below\n\n${serpResults}\n\nRespond ONLY with the markdown table. Do not include any other text, explanations, or formatting like \`\`\`.\n`;

export const getUserIntentAnalysisPrompt = (
  keyword: string,
  serpResults: string,
  relatedKeywordsRaw: string // Raw string with keywords and volumes
) => {
  // Process related keywords for potential inclusion in the prompt (AI will handle final formatting)
  const keywordLines = relatedKeywordsRaw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.includes(','));

  const keywordsData = keywordLines.map(line => {
    const parts = line.split(',');
    const keywordName = parts.slice(0, -1).join(',').trim(); // Handle keywords with commas
    const volumeStr = parts[parts.length - 1].trim();
    const volume = parseInt(volumeStr, 10);
    return {
      keyword: keywordName,
      volume: isNaN(volume) ? '?' : volume // Use '?' if volume is not a number
    };
  });

  // Simplified instructions for related keywords - AI should create the tables.
  const keywordSectionInstructions =
    keywordsData.length > 0
      ? `

#### Related Keywords

Below is a list of related keywords and their search volume. Please analyze these keywords and group them under the most relevant user intent category identified from the SERP analysis. For each intent category, create a markdown table with two columns: "Keywords" and "Search Volume". If the search volume is unknown, use '?' and link it to https://keywordseverywhere.com/seo-reports.html#faq.

**Provided Keywords Data:**
${relatedKeywordsRaw}
` // Provide raw data directly to AI
      : `
[No keywords with search volume were found](https://keywordseverywhere.com/seo-reports.html#faq).
`;

  return `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in User Intent analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided keyword, SERP results, and related keywords data. Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* as Markdown content (User Intent table followed by Related Keyword tables, if applicable) as requested later.\n4.  **Behavior:**\n    *   Do NOT add any introductory text, concluding remarks, summaries, explanations, or self-references.\n    *   Do NOT engage in conversation or ask clarifying questions.\n    *   Do NOT use markdown formatting (like \`\`\`.\`) around the final output blocks.\n    *   Adhere strictly to the 4 user intent types defined below.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: User Intent Analysis for [${keyword}]\n\n**What this report does:** The User Intent Analysis report looks at the top webpages ranking in Google on the first page and tries to figure out the user intent that each satisfies. It then presents this data categorized in a table. It also gives you keywords relevant to each of the user intents it has found.\n\n**When to use this report:** The User Intent Analysis report should be used when you want to double check what the intent of the user is for the search query. Before you start creating content for this search query, you need to decide which user intent(s) you want your content to satisfy.\n\nYou know that there are four types of search intent - Navigational, Informational, Commercial & Transactional. You are able to figure out the exact search intent and then categorize it into one of the four types of search intent.\n\n#### User Intent Analysis\n\nPlease create a markdown table with three columns "Search Intent Category", "Actual Intent", and "Pages".\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".\n\nI am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze them and figure out the user intent that each page is written for? Collate the results by intent.\n\nIn the "Search Intent Category" column, list the type (Navigational, Informational, Commercial, Transactional). In the "Actual Intent" column, describe the specific intent and include the count of pages matching this intent. In the "Pages" column, display links to the URLs of those pages, using the position number as the anchor text (e.g., [1](URL), [2](URL)).\n\nThe positions, titles, descriptions and URLs are given below:\n\n${serpResults}\n\nIdeally your content should target one of the above user intents. However, it's fine to target one or more of them.\n\n${keywordSectionInstructions}\n\n| Warning                                                                                                                                                           |\n| :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Please ensure that your Keywords Everywhere Settings for [Credit Usages for Widgets] are all enabled. If not, then LLM will hallucinate the search volume data in this report. |\n\nRespond ONLY with the markdown content described above (User Intent table followed by Related Keyword tables). Do not include any other text, explanations, or formatting like \`\`\`.\n`;
};

export const getSerpTitleAnalysisPrompt = (
  keyword: string,
  serpResults: string
) => `You are a highly specialized AI assistant acting as an expert SEO analyst. Your sole task is to meticulously analyze the provided input data based *only* on the instructions that follow and generate output in the *exact* format specified.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Assume the persona of an SEO expert specializing in SERP Title analysis.\n2.  **Input Data:** Base your entire analysis strictly on the provided keyword and SERP results. Do NOT use external knowledge or assumptions.\n3.  **Output Format:** Generate your response *exclusively* as a valid JSON object matching the structure specified later.\n4.  **Behavior:**\n    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object itself.\n    *   Do NOT engage in conversation or ask clarifying questions.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.\n\n## SEO Report: Analyze SERP Titles for [${keyword}]\n\n**What this report does:** The Analyze SERP Titles report looks at the top webpages ranking in Google on the first page for the search query and tries to find patterns in them. It explains what it finds and gives recommendations for the title and also suggests a title for your content.\n\n**When to use this report:** The Analyze SERP Titles report should be used before you start writing content, by creating the page title. Read the recommendations and feel free to ask for more suggested page titles.\n\nYou know that there are four types of search intent - Navigational, Informational, Commercial & Transactional. You are able to figure out the exact search intent and then categorize it into one of the four types of search intent.\n\nI have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".\n\nI am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze the titles and find what is common among all of them. Finally, also create a new title that has the best of everything that is common.\n\nThe positions, titles, descriptions and URLs are given below:\n\n${serpResults}\n\nWhen you mention any position, display the link of the URL and use the number of the position as the anchor text.\n\nRespond with a JSON object with the following structure:\n{
  "title": "Your suggested optimized title",
  "analysis": "Your detailed analysis of the SERP titles",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}\n\nDo not include any text outside of this JSON structure. Return valid JSON only.\n`;

// --- NEW: Prompts for Text-to-JSON Conversion ---

export const getContentTypeConversionPrompt = (
  markdownText: string,
  keyword: string // Include keyword for context if needed in JSON
) =>
  `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided Markdown text into the *exact* JSON format specified, using *only* the information present in the input Markdown.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Act as a data conversion bot.\n2.  **Input Data:** Use *only* the provided Markdown text and the keyword for context.\n3.  **Output Format:** Generate *only* a valid JSON object matching the structure specified below.\n4.  **Behavior:**\n    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.\n    *   Do NOT interpret or analyze the data beyond extracting it into the JSON structure.\n    *   Ensure all extracted data (URLs, positions) is valid according to the schema.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. You are a data conversion expert. Your task is to convert the provided Markdown text, which represents a Content Type Analysis report, into a structured JSON object.\n\nThe Markdown text contains a table listing content types and associated page links (with position numbers as anchor text).\n\nInput Markdown Text:\n\`\`\`markdown\n${markdownText}\n\`\`\`\n\nConvert this Markdown text into a JSON object with the following structure. Extract the content type, count (number of pages listed), and an array of page objects (position and URL) for each row in the table.\n\n{\n  "analysisTitle": "Content Type Analysis for [${keyword}]", // Generate title using the provided keyword\n  "reportDescription": "The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type.", // Standard description\n  "usageHint": "The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.", // Standard hint\n  "contentTypes": [\n    {\n      "type": "string (e.g., Product pages)", // Extracted from the first column\n      "count": number, // Calculated count of pages in the second column\n      "pages": [\n        { "position": number, "url": "string" }, // Extracted from links in the second column\n        ...\n      ]\n    },\n    ...\n  ]\n}\n\nRespond ONLY with the valid JSON object. Do not include explanations or markdown formatting. Ensure all URLs are valid and positions are positive integers.\n`;

export const getUserIntentConversionPrompt = (
  markdownText: string,
  keyword: string // Include keyword for context
) =>
  `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided Markdown text into the *exact* JSON format specified, using *only* the information present in the input Markdown.\n\n**CRITICAL INSTRUCTIONS:**\n1.  **Role:** Act as a data conversion bot.\n2.  **Input Data:** Use *only* the provided Markdown text and the keyword for context.\n3.  **Output Format:** Generate *only* a valid JSON object matching the structure specified below.\n4.  **Behavior:**\n    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.\n    *   Do NOT interpret or analyze the data beyond extracting it into the JSON structure.\n    *   Handle keyword search volume '?' as null in the JSON.\n    *   Ensure all extracted data (URLs, positions, categories) is valid according to the schema.\n\n--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n\nPlease ignore all previous instructions. You are a data conversion expert. Your task is to convert the provided Markdown text, which represents a User Intent Analysis report, into a structured JSON object.\n\nThe Markdown text contains:\n1. A table listing user intent categories, specific intents (including page counts), and associated page links (position as anchor text).\n2. Potentially following the first table, markdown tables for related keywords grouped by intent category.\n\nInput Markdown Text:\n\`\`\`markdown\n${markdownText}\n\`\`\`\n\nConvert this Markdown text into a JSON object with the following structure. Extract the intent category, specific intent description, page count, and page details from the first table. Extract related keywords and their search volumes (handle '?' as null) from the subsequent keyword tables.\n\n{\n  "analysisTitle": "User Intent Analysis for [${keyword}]", // Generate title\n  "reportDescription": "The User Intent Analysis report looks at the top webpages ranking in Google on the first page and tries to figure out the user intent that each satisfies. It then presents this data categorized.", // Standard description\n  "usageHint": "The User Intent Analysis report should be used when you want to double check what the intent of the user is for the search query. Before you start creating content for this search query, you need to decide which user intent(s) you want your content to satisfy.", // Standard hint\n  "intents": [\n    {\n      "category": "string (Navigational | Informational | Commercial | Transactional)", // Extracted from the first column\n      "specificIntent": "string (e.g., Find official website, Learn about X)", // Extracted from the second column (description part)\n      "count": number, // Extracted from the second column (count part)\n      "pages": [\n        { "position": number, "url": "string" }, // Extracted from links in the third column\n        ...\n      ]\n    },\n    ...\n  ],\n  "relatedKeywords": [\n      { "keyword": "string", "searchVolume": number | null }, // Extracted from keyword tables. '?' volume becomes null.\n      ...\n  ]\n}\n\nRespond ONLY with the valid JSON object. Do not include explanations or markdown formatting. Ensure categories match the four types, positions are positive integers, URLs are valid, and searchVolume is number or null.\n`;

// --- NEW: Prompts for Generating Recommendation Text from Markdown ---

export const getContentTypeRecommendationPrompt = (
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

Respond ONLY with the single recommendation sentence.`;

export const getUserIntentRecommendationPrompt = (
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

Respond ONLY with the single recommendation sentence matching the template.`;

// --- NEW: Prompt for Title Recommendation ---

export const getTitleRecommendationPrompt = (
  suggestedTitle: string,
  analysisText: string // The 'analysis' field from the TitleAnalysisJson
) =>
  `You are an expert SEO analyst reviewing a generated title and its analysis. Based *only* on the provided title and analysis, generate a concise, actionable recommendation for the user.

**CRITICAL INSTRUCTIONS:**
1.  **Input:** The suggested title and the analysis explaining why it was suggested.
2.  **Task:** Formulate a recommendation using the provided title and analysis.
3.  **Output Format:** Respond *only* with a single sentence following this exact template: "建議使用的標題：${suggestedTitle} 因為：\${analysisSummary}"
    *   Replace \`\${suggestedTitle}\` with the provided suggested title.
    *   Replace \`\${analysisSummary}\` with a brief summary or the core reason derived *directly* from the provided analysis text. Keep it concise.
4.  **Behavior:**
    *   Do NOT add any introductory text, concluding remarks, or explanations beyond the single sentence.
    *   Do NOT refer to yourself or the process.
    *   Base the recommendation solely on the input title and analysis text.

**Suggested Title:**
${suggestedTitle}

**Analysis Text:**
${analysisText}

Respond ONLY with the single recommendation sentence matching the template.`;

// --- NEW: Prompt for "Better Have In Article" Analysis ---

export const getBetterHaveInArticlePrompt = (
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
Generate a Markdown bulleted list. Each bullet point should represent a distinct recommendation. For each recommendation, briefly explain *why* it's important based *only* on the provided SERP data (e.g., "Addresses a common PAA question", "Featured in multiple top-ranking descriptions", "Covers a related search query", "Key point from AI overview").

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

Respond ONLY with the markdown bulleted list.`;

// --- NEW: Prompt for Better Have JSON Conversion ---

export const getBetterHaveConversionPrompt = (
  markdownText: string,
  keyword: string // Include keyword for context if needed in JSON
) =>
  `You are a highly specialized AI assistant acting as a data conversion expert. Your sole task is to convert the provided Markdown bullet list text into the *exact* JSON format specified, using *only* the information present in the input Markdown.

**CRITICAL INSTRUCTIONS:**
1.  **Role:** Act as a data conversion bot.
2.  **Input Data:** Use *only* the provided Markdown text.
3.  **Output Format:** Generate *only* a valid JSON object matching the structure specified below.
4.  **Behavior:**
    *   Do NOT add any text, explanations, or markdown formatting (like \`\`\`json) outside the JSON object.
    *   Do NOT interpret or analyze the data beyond extracting it. Extract the main recommended point/topic/question and its justification for each bullet point.
    *   Attempt to infer the primary 'source' driving each recommendation (PAA, Organic Results, Related Queries, AI Overview, Multiple) based on the justification text, but it's okay if it's sometimes missing or inaccurate.

--- START OF TASK-SPECIFIC INSTRUCTIONS ---\n
Please ignore all previous instructions. You are a data conversion expert. Your task is to convert the provided Markdown bulleted list, representing a "Better Have In Article" analysis report for keyword "[${keyword}]", into a structured JSON object.

Input Markdown Text (Bulleted List):
\`\`\`markdown
${markdownText}
\`\`\`

Convert this Markdown text into a JSON object with the following structure. For each bullet point in the list, extract the core recommendation (the bolded part or main topic) into the 'point' field and the subsequent explanation into the 'justification' field. Attempt to categorize the 'source' based on keywords in the justification.

{
  "analysisTitle": "Better Have In Article Analysis for [${keyword}]",
  "recommendations": [
    {
      "point": "string (e.g., Include a section comparing X and Y)", // Extracted main recommendation from bullet
      "justification": "string (e.g., This comparison appears in several top descriptions and addresses a related query.)", // Extracted justification text
      "source": "string (PAA | Organic Results | Related Queries | AI Overview | Multiple) | null" // Inferred source based on justification, null if unclear
    },
    // ... more items for each bullet point
  ]
}

Respond ONLY with the valid JSON object. Do not include explanations or markdown formatting.
`;


// --- NEW: Prompt for Better Have Recommendation Text ---

export const getBetterHaveRecommendationPrompt = (
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

Respond ONLY with the 1-2 sentence recommendation summary.`;
