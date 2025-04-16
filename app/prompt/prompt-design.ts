export const getContentTypeAnalysisPrompt = (
  keyword: string,
  serpResults: string
) => `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

## SEO Report: Content Type Analysis for [${keyword}]

**What this report does:** The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type. It then presents this data categorized in a table.

**When to use this report:** The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.

You are an SEO expert who is very good at analyzing the SERPS and figuring out what are the different content types shown in the top organic results. You know that there are eight types of content as mentioned below

1. How to guides
2. Step by step tutorials
3. List posts
4. Opinion editorials
5. Videos
6. Product pages
7. Category pages
8. Landing pages for a service

Please create a markdown table with two columns "Content Type" and "Pages".

I have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze them and categorize them based on the 8 content types mentioned earlier. Once done, please collate all the content types together.

I want you to ouput the content types, and the number of the pages that are categorized in that content type in the "Content Type" column. In the "Pages" column I want you to display links to the URLs of those pages. Then Anchor text of the links should be the position number - e.g. 1 or 2 or 3.

The positions, titles, descriptions and URLs are given below

${serpResults}

Respond ONLY with the markdown table. Do not include any other text, explanations, or formatting like \`\`\`.\n`;

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

  return `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

## SEO Report: User Intent Analysis for [${keyword}]

**What this report does:** The User Intent Analysis report looks at the top webpages ranking in Google on the first page and tries to figure out the user intent that each satisfies. It then presents this data categorized in a table. It also gives you keywords relevant to each of the user intents it has found.

**When to use this report:** The User Intent Analysis report should be used when you want to double check what the intent of the user is for the search query. Before you start creating content for this search query, you need to decide which user intent(s) you want your content to satisfy.

You are an SEO expert who is very good at understanding user intents from a search result. You know that there are four types of search intent - Navigational, Informational, Commercial & Transactional. You are able to figure out the exact search intent and then categorize it into one of the four types of search intent.

#### User Intent Analysis

Please create a markdown table with three columns "Search Intent Category", "Actual Intent", and "Pages".

I have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze them and figure out the user intent that each page is written for? Collate the results by intent.

In the "Search Intent Category" column, list the type (Navigational, Informational, Commercial, Transactional). In the "Actual Intent" column, describe the specific intent and include the count of pages matching this intent. In the "Pages" column, display links to the URLs of those pages, using the position number as the anchor text (e.g., [1](URL), [2](URL)).

The positions, titles, descriptions and URLs are given below:

${serpResults}

Ideally your content should target one of the above user intents. However, it's fine to target one or more of them.

${keywordSectionInstructions}

| Warning                                                                                                                                                           |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Please ensure that your Keywords Everywhere Settings for [Credit Usages for Widgets] are all enabled. If not, then LLM will hallucinate the search volume data in this report. |

Respond ONLY with the markdown content described above (User Intent table followed by Related Keyword tables). Do not include any other text, explanations, or formatting like \`\`\`.\n`;
};

export const getSerpTitleAnalysisPrompt = (
  keyword: string,
  serpResults: string
) => `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

## SEO Report: Analyze SERP Titles for [${keyword}]

**What this report does:** The Analyze SERP Titles report looks at the top webpages ranking in Google on the first page for the search query and tries to find patterns in them. It explains what it finds and gives recommendations for the title and also suggests a title for your content.

**When to use this report:** The Analyze SERP Titles report should be used before you start writing content, by creating the page title. Read the recommendations and feel free to ask for more suggested page titles.

You are an SEO expert who is very good at understanding and analyzing SERPs.

I have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze the titles and find what is common among all of them. Finally, also create a new title that has the best of everything that is common.

The positions, titles, descriptions and URLs are given below:

${serpResults}

When you mention any position, display the link of the URL and use the number of the position as the anchor text.

Respond with a JSON object with the following structure:
{
  "title": "Your suggested optimized title",
  "analysis": "Your detailed analysis of the SERP titles",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

Do not include any text outside of this JSON structure. Return valid JSON only.
`;

// --- NEW: Prompts for Text-to-JSON Conversion ---

export const getContentTypeConversionPrompt = (
  markdownText: string,
  keyword: string // Include keyword for context if needed in JSON
) =>
  `Please ignore all previous instructions. You are a data conversion expert. Your task is to convert the provided Markdown text, which represents a Content Type Analysis report, into a structured JSON object.\n\nThe Markdown text contains a table listing content types and associated page links (with position numbers as anchor text).\n\nInput Markdown Text:\n\`\`\`markdown\n${markdownText}\n\`\`\`\n\nConvert this Markdown text into a JSON object with the following structure. Extract the content type, count (number of pages listed), and an array of page objects (position and URL) for each row in the table.\n\n{\n  \"analysisTitle\": \"Content Type Analysis for [${keyword}]\", // Generate title using the provided keyword\n  \"reportDescription\": \"The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type.\", // Standard description\n  \"usageHint\": \"The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.\", // Standard hint\n  \"contentTypes\": [\n    {\n      \"type\": \"string (e.g., Product pages)\", // Extracted from the first column\n      \"count\": number, // Calculated count of pages in the second column\n      \"pages\": [\n        { \"position\": number, \"url\": \"string\" }, // Extracted from links in the second column\n        ...\n      ]\n    },\n    ...\n  ]\n}\n\nRespond ONLY with the valid JSON object. Do not include explanations or markdown formatting. Ensure all URLs are valid and positions are positive integers.\n`;

export const getUserIntentConversionPrompt = (
  markdownText: string,
  keyword: string // Include keyword for context
) =>
  `Please ignore all previous instructions. You are a data conversion expert. Your task is to convert the provided Markdown text, which represents a User Intent Analysis report, into a structured JSON object.\n\nThe Markdown text contains:\n1. A table listing user intent categories, specific intents (including page counts), and associated page links (position as anchor text).\n2. Potentially following the first table, markdown tables for related keywords grouped by intent category.\n\nInput Markdown Text:\n\`\`\`markdown\n${markdownText}\n\`\`\`\n\nConvert this Markdown text into a JSON object with the following structure. Extract the intent category, specific intent description, page count, and page details from the first table. Extract related keywords and their search volumes (handle '?' as null) from the subsequent keyword tables.\n\n{\n  \"analysisTitle\": \"User Intent Analysis for [${keyword}]\", // Generate title\n  \"reportDescription\": \"The User Intent Analysis report looks at the top webpages ranking in Google on the first page and tries to figure out the user intent that each satisfies. It then presents this data categorized.\", // Standard description\n  \"usageHint\": \"The User Intent Analysis report should be used when you want to double check what the intent of the user is for the search query. Before you start creating content for this search query, you need to decide which user intent(s) you want your content to satisfy.\", // Standard hint\n  \"intents\": [\n    {\n      \"category\": \"string (Navigational | Informational | Commercial | Transactional)\", // Extracted from the first column\n      \"specificIntent\": \"string (e.g., Find official website, Learn about X)\", // Extracted from the second column (description part)\n      \"count\": number, // Extracted from the second column (count part)\n      \"pages\": [\n        { \"position\": number, \"url\": \"string\" }, // Extracted from links in the third column\n        ...\n      ]\n    },\n    ...\n  ],\n  \"relatedKeywords\": [\n      { \"keyword\": \"string\", \"searchVolume\": number | null }, // Extracted from keyword tables. '?' volume becomes null.\n      ...\n  ]\n}\n\nRespond ONLY with the valid JSON object. Do not include explanations or markdown formatting. Ensure categories match the four types, positions are positive integers, URLs are valid, and searchVolume is number or null.\n`;
