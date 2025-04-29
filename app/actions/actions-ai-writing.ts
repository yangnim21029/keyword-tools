'use server';

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai'; // Removed generateObject for now
import { MEDIASITE_DATA } from '../global-config';
import { AI_MODELS } from '../global-config';
// Import fine-tune data
import { z } from 'zod';
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA
} from '../prompt/fine-tune';

// Import the necessary type

import { getKeywordVolumeList } from '../services/firebase';
import { KeywordVolumeListItem } from '../services/firebase/schema';
import { generateContentSuggestionsAction } from './use-content-ai';

function getFineTuneDataStrings(names?: string[]): string {
  if (!names || names.length === 0) return '';
  const allData = [
    ...THEME_FINE_TUNE_DATA,
    ...MEDIA_SITE_FINE_TUNE_DATA,
    ...LANGUAGE_FINE_TUNE_DATA
  ];
  const filteredData = allData.filter(item => names.includes(item.name));
  if (filteredData.length === 0) return '';
  const formattedStrings = filteredData.map(item => {
    const description = item.data_set_description || 'No description provided';
    const dataString = JSON.stringify(item.data, null, 2);
    return `===\n${description}\n${dataString}\n===`;
  });
  return `\n\n---
檢查文章，不要犯以下錯誤\n===\n${formattedStrings.join('\n\n')}`;
}

function formatKeywordReportForPrompt(
  report: any,
  selectedClusterName?: string | null
): string {
  if (!report || typeof report !== 'object' || Object.keys(report).length === 0)
    return '';
  const formatNumber = (num: number | null | undefined): string =>
    typeof num === 'number' ? num.toLocaleString() : 'N/A';

  // Format and sort keywords with volume >= 100
  const formatKeywords = (keywords: any[] | undefined): string => {
    if (!keywords) return 'No specific keywords found.';
    const highVolumeKeywords = keywords.filter(
      k => k && typeof k.searchVolume === 'number' && k.searchVolume >= 100
    );
    highVolumeKeywords.sort(
      (a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0)
    );
    if (highVolumeKeywords.length === 0)
      return 'No specific keywords found (Volume >= 100).';
    // Add newline and indent for each keyword
    return `\n      - ${highVolumeKeywords
      .map(
        (k: any) =>
          `${k?.text || JSON.stringify(k)} (Vol: ${formatNumber(
            k?.searchVolume
          )})`
      )
      .join('\n      - ')}`;
  };

  // Collector for low-volume keyword OBJECTS
  const lowVolumeKeywordObjects: { text: string; searchVolume: number }[] = [];
  const collectLowVolume = (keywords: any[] | undefined) => {
    if (!keywords) return;
    keywords.forEach((k: any) => {
      if (
        k &&
        typeof k.searchVolume === 'number' &&
        k.searchVolume < 100 &&
        k.text
      ) {
        if (
          !lowVolumeKeywordObjects.some(existing => existing.text === k.text)
        ) {
          lowVolumeKeywordObjects.push({
            text: k.text,
            searchVolume: k.searchVolume
          });
        }
      }
    });
  };

  // Collect low volume keyword objects first
  if (report.clustersWithVolume && Array.isArray(report.clustersWithVolume)) {
    report.clustersWithVolume.forEach((cluster: any) => {
      collectLowVolume(cluster.keywords);
    });
  } else if (report.keywords && Array.isArray(report.keywords)) {
    collectLowVolume(report.keywords);
  }

  // Process and sort low volume keywords based on count
  let finalLowVolumeKeywords: { text: string; searchVolume: number }[] = [];
  const initialLowVolumeCount = lowVolumeKeywordObjects.length;

  if (initialLowVolumeCount > 60) {
    let filteredKeywords = lowVolumeKeywordObjects.filter(
      k => k.searchVolume !== 0
    );
    if (filteredKeywords.length > 100) {
      filteredKeywords = filteredKeywords.slice(0, 100);
    }
    finalLowVolumeKeywords = filteredKeywords;
  } else {
    finalLowVolumeKeywords = lowVolumeKeywordObjects;
  }

  // Sort final low volume list by searchVolume descending
  finalLowVolumeKeywords.sort((a, b) => b.searchVolume - a.searchVolume);

  // Build Output String
  let output = `\n- **使用以下關鍵字研究報告** (Keyword Research Report):\n`;
  output += `  - 主查詢 (Main Query): ${report.query || 'N/A'}\n`;
  output += `  - 語言 (Language): ${report.language || 'N/A'}\n`;
  output += `  - 地區 (Region): ${report.region || 'N/A'}\n`;

  if (
    report.clustersWithVolume &&
    Array.isArray(report.clustersWithVolume) &&
    report.clustersWithVolume.length > 0
  ) {
    output += `  - **主題分群** (Clusters):\n`;
    const overallTotalVolume = report.clustersWithVolume.reduce(
      (sum: number, cluster: any) => sum + (cluster.totalVolume || 0),
      0
    );
    output += `  - 總搜尋量 (Total Volume from Clusters): ${formatNumber(
      overallTotalVolume
    )}\n`;
    report.clustersWithVolume.forEach((cluster: any, index: number) => {
      const clusterName = cluster.clusterName || `Cluster ${index + 1}`;
      const marker =
        selectedClusterName && clusterName === selectedClusterName
          ? ' [TARGET CLUSTER]'
          : '';
      const clusterVol = formatNumber(cluster.totalVolume);
      output += `    - **分群 ${
        index + 1
      }: ${clusterName}**${marker} (Volume: ${clusterVol})\n`;
      output += `      - 關鍵字 (Keywords): ${formatKeywords(
        cluster.keywords
      )}\n`; // Uses filtered & sorted (>=100) keywords
    });
  } else if (
    report.keywords &&
    Array.isArray(report.keywords) &&
    report.keywords.length > 0
  ) {
    const totalVolumeFromKeywords = report.keywords.reduce(
      (sum: number, kw: any) => sum + (kw.searchVolume || 0),
      0
    );
    output += `  - 總搜尋量 (Total Volume from Keywords): ${formatNumber(
      totalVolumeFromKeywords
    )}\n`;
    output += `  - **關鍵字** (Keywords - No specific clusters):\n`;
    output += `    - ${formatKeywords(report.keywords)}\n`; // Uses filtered & sorted (>=100) keywords
  } else {
    output += `  - 關鍵字 (Keywords): No specific keyword data available.\n`;
  }

  // Append the (potentially filtered/limited and now sorted) Low Volume Section
  if (finalLowVolumeKeywords.length > 0) {
    output += `\n- **低搜尋量相關主題 (Low Volume Related Topics - < 100):**\n`;
    output += `  - 以下是搜尋量較低 (< 100) 但可能與特定受眾相關的主題。考慮將部分主題作為文章中的小段落或補充內容來擴充文章豐富度 (These are related topics with lower search volume (< 100) that might be relevant to specific audiences. Consider incorporating some of these topics as small paragraphs or supplementary sections to enrich the article content):
`;
    // Add newline and indent for each topic reference
    output += `  - 主題參考 (Topic References):\n  - ${finalLowVolumeKeywords
      .map(k => k.text)
      .join('\n  - ')}\n`;
  }

  output += `\n  - 報告更新時間 (Report Updated): ${
    report.updatedAt ? new Date(report.updatedAt).toLocaleString() : 'N/A'
  }\n`;
  return output + '\n';
}
// --- END: Helper Functions ---

// === Step 6: Generate Action Plan ===
const generateActionPlanStepInputSchema = z.object({
  keyword: z.string().min(1),
  mediaSiteName: z.string().min(1), // Need site name to get data string
  contentTypeReportText: z.string().optional().nullable(), // Make optional/nullable
  userIntentReportText: z.string().optional().nullable(), // Make optional/nullable
  titleRecommendationText: z.string().optional().nullable(), // Make optional/nullable
  betterHaveRecommendationText: z.string().optional().nullable(), // Make optional/nullable
  keywordReport: z.any().optional().nullable(), // Add keywordReport
  selectedClusterName: z.string().optional().nullable() // Add selectedClusterName
});
type GenerateActionPlanStepInput = z.infer<
  typeof generateActionPlanStepInputSchema
>;

async function generateActionPlanInternal(
  input: GenerateActionPlanStepInput
): Promise<string> {
  console.log('[generateActionPlanInternal] Generating action plan...');
  // Note: contentTypeReportText and userIntentReportText now contain the *recommendation* text
  const {
    keyword,
    mediaSiteName,
    contentTypeReportText,
    userIntentReportText,
    titleRecommendationText,
    betterHaveRecommendationText,
    keywordReport,
    selectedClusterName
  } = input;

  const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
  if (!mediaSite) throw new Error(`Media site not found: ${mediaSiteName}`);
  const mediaSiteDataString = JSON.stringify(mediaSite);

  // Format keyword report if available (pass selectedClusterName for highlighting)
  const keywordReportString = formatKeywordReportForPrompt(
    keywordReport,
    selectedClusterName
  );

  // Restore original full prompt text here
  // The prompt placeholders ${contentTypeReportText} and ${userIntentReportText} will use the recommendation text.
  const prompt = `
You are an SEO Project Manager with knowledge in consumer behavior theory, traditional marketing theory, and digital marketing theory. You will execute the following tasks:

1. **Keyword Theme Identification**: Identify the theme of a user-provided keyword.
2. **Action Plan Creation**: Craft a specific action plan for the keyword, ensuring action plan format is bilingual (Chinese and English) with smooth language transition, using the provided example structure.

# Steps

1. **Accroding and Read the SEO Analysis Results to write a detailed SEO action plan**:
    - Include Key Topics/Trust Factors ('Better Have'): ${
      betterHaveRecommendationText ?? 'N/A'
    }
    - choose Content Type Analysis: ${contentTypeReportText ?? 'N/A'} 
    - choose User Intent Analysis: ${userIntentReportText ?? 'N/A'}
    - choose Title Analysis: ${titleRecommendationText ?? 'N/A'}
2. **Identify Theme**:
    - Analyze the keyword to discern the main theme
3. **Create Action Plan**:
    - Formulate a detailed, bilingual action plan.
    - Follow the provided sentence structure examples for coherence.

# Output Format

- Deliver a structured response with these sections:
    - **Keyword Theme**: Concise explanation of the theme.
    - **Action Plan**:
        - Three variations tailored to different user interests:
            - **ActionPlan:**
Create in-depth recipes for each soup, highlighting traditional preparation methods.
為每種湯品創建深入的食譜，突顯傳統的製作方法。

    Develop content around the health benefits of key ingredients (e.g., 淮山, 茨實, 花膠).
    圍繞主要成分的健康益處開發內容（例如，淮山、茨實、花膠）。

    Produce video tutorials for complex recipes like 淮山茨實鱷魚肉湯, showcasing proper techniques.
    製作複雜食譜的視頻教程，如淮山茨實鱷魚肉湯，展示正確的技術。

    Write articles on the cultural significance of these soups in Hong Kong cuisine.
    撰寫有關這些湯品在香港料理中文化意義的文章。

# Version (Action Plan Target, Just give me one to have 3-5 points):
${mediaSiteDataString}

---
Output in the format:
h2 Keyword Theme for ${keywordReportString ? keywordReportString : keyword}
h2 Action Plan
h2 Keyword need to cover in article
`;

  const { text: actionPlanText } = await generateText({
    model: AI_MODELS.BASE,
    prompt: prompt
  });
  console.log('[generateActionPlanInternal] Generated Action Plan.');
  return actionPlanText;
}

export async function generateActionPlanStep(
  input: GenerateActionPlanStepInput
): Promise<{ actionPlanText: string }> {
  const validation = generateActionPlanStepInputSchema.safeParse(input);
  if (!validation.success)
    throw new Error(
      `Invalid input for generateActionPlanStep: ${validation.error.format()}`
    );

  const validatedInput = validation.data; // Use validated data
  console.log(
    `[Action Step 6] Generating Action Plan for Keyword: ${validatedInput.keyword}`
  );
  // Pass the keywordReport from the validated input to the internal function
  const actionPlanText = await generateActionPlanInternal(validatedInput);
  console.log(`[Action Step 6] Action Plan generation complete.`);
  return { actionPlanText };
}

// === Step 7: Generate Final Prompt ===
const generateFinalPromptStepInputSchema = z.object({
  keyword: z.string().min(1),
  actionPlan: z.string(),
  mediaSiteName: z.string().min(1), // Needed for site data string
  contentTypeReportText: z.string(), // Now receives recommendationText from analyzeContentTypeStep
  userIntentReportText: z.string(), // Now receives recommendationText from analyzeUserIntentStep
  betterHaveRecommendationText: z.string().optional().nullable(),
  keywordReport: z.any().optional().nullable(), // Keep as any or define schema
  selectedClusterName: z.string().optional().nullable(),
  outlineRefName: z.string().optional().default(''),
  fineTuneNames: z.array(z.string()).optional()
});
type GenerateFinalPromptStepInput = z.infer<
  typeof generateFinalPromptStepInputSchema
>;

async function generateFinalPromptInternal(
  input: GenerateFinalPromptStepInput
): Promise<string> {
  console.log('[generateFinalPromptInternal] Generating final prompt...');
  const {
    keyword,
    actionPlan,
    mediaSiteName,
    contentTypeReportText,
    userIntentReportText,
    betterHaveRecommendationText,
    keywordReport,
    selectedClusterName,
    outlineRefName,
    fineTuneNames
  } = input;

  const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
  if (!mediaSite) throw new Error(`Media site not found: ${mediaSiteName}`);
  const mediaSiteDataString = JSON.stringify(mediaSite);

  const keywordReportString = selectedClusterName
    ? '<!-- Keyword report details were incorporated into the Action Plan -->'
    : formatKeywordReportForPrompt(keywordReport, selectedClusterName);

  const fineTuneDataString = getFineTuneDataStrings(fineTuneNames);

  const serpTextAnalysisPoints = betterHaveRecommendationText || 'N/A';

  const contentTemplate = getOutlineFromReference(outlineRefName);

  console.log(
    '[generateFinalPromptInternal] Fetching content suggestions string...'
  );
  const suggestionsString = await generateContentSuggestionsAction({ keyword });
  console.log(
    '[generateFinalPromptInternal] Content suggestions string fetched.'
  );

  const systemPrompt = `
You will be tasked to create new content for a given keyword.(從頭撰寫一篇全新文章)

    Your thinking should be thorough and so it's fine if it's very long. You can think step by step before and after each action you decide to take.

    You MUST iterate and keep going until the content is perfectly optimized.

    You already have everything you need to create this content in the /resources folder, even without internet connection. I want you to fully optimize this autonomously before coming back to me.

    Only terminate your turn when you are sure that the content is fully optimized. Go through the optimization step by step, and make sure to verify that your adjustments are correct. NEVER end your turn without having fully optimized the content, and when you say you are going to make a tool call, make sure you ACTUALLY make the tool call, instead of ending your turn.

    THE CONTENT CAN DEFINITELY BE OPTIMIZED WITHOUT THE INTERNET.

    Take your time and think through every step - remember to check your content rigorously and watch out for keyword usage, readability, and SEO best practices, especially with the adjustments you made. 

Your content must be perfect. If not, continue working on it. 

At the end, you must test your content rigorously using the tools provided, and do it many times, to catch all optimization opportunities. 

If it is not perfectly optimized, iterate more and make it perfect. 

Failing to test your content sufficiently rigorously is the NUMBER ONE failure mode on these types of tasks; make sure you handle all readability, keyword usage, and structure requirements, and run existing SEO checks if they are provided.


    You MUST plan extensively before each adjustment, and reflect extensively on the outcomes of previous adjustments. DO NOT do this entire process by making content adjustments only, as this can impair your ability to optimize the content and think insightfully.

If you are not sure about file content or codebase structure pertaining to the user's request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.

You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.

寫一篇 SEO 文章，2000 字 - 3000 字
    `;

  const basePrompt = `
${systemPrompt}

${actionPlan}

related topics: none;

focus on keyword: ${keyword}

${keywordReportString}

Write using this style: ${mediaSiteDataString}

Use this Content Type Recommendation: ${contentTypeReportText}

Use this better have to enhance the article: 
${serpTextAnalysisPoints}

Match this User Intent Recommendation: 
${userIntentReportText} 

Follow this outline structure and order:
${contentTemplate.reference}

don't prefer: 
do not write keyword insight into article
do not use 中英雙語
remove sentence about seo or marketing
Output only the article content. 
Do not include analysis processes, internal links, or source references within the article body. 
Place any references or URLs at the very end of the article, separate from the main content, and do not include them in the word count. 

Must include these keywords/phrases (Derived from 'Better Have' Analysis):
 - ${serpTextAnalysisPoints}

Group similar keywords (e.g., '潤肺', '止咳', '化痰') naturally in sentences.
**Every keyword/phrase** from the list above must appear at least once in the article.

Analyze competitor content. Create unique and differentiated content.
Cover topics competitors discuss but lack depth. Add unique insights to provide more value.

Formatting and Readability:
- Use lists, data, and examples to improve readability.
- Break up long paragraphs to enhance readability.

--- 
Content Suggestions:
${suggestionsString}
`;

  const finalPrompt: string = basePrompt + fineTuneDataString;
  console.log(
    '[generateFinalPromptInternal] Final prompt generation complete.'
  );
  return finalPrompt;
}

export async function generateFinalPromptStep(
  input: GenerateFinalPromptStepInput
): Promise<{ finalPrompt: string }> {
  const validation = generateFinalPromptStepInputSchema.safeParse(input);
  if (!validation.success)
    throw new Error(
      `Invalid input for generateFinalPromptStep: ${validation.error.format()}`
    );

  console.log(
    `[Action Step 7] Generating Final Prompt for Keyword: ${input.keyword}`
  );
  const finalPrompt = await generateFinalPromptInternal(input);
  console.log(`[Action Step 7] Final Prompt generation complete.`);
  return { finalPrompt };
}

const outlineReference = {
  recipe: {
    name: 'recipe',
    reference: `
     ## xx食材介紹與功效引言
     ## 食譜
     ## FAQ
     ## 連結
     `
  }
};

function getOutlineFromReference(refName: string) {
  const reference = outlineReference[refName as keyof typeof outlineReference];
  // If refName is empty or not found, provide a default/empty structure
  if (!reference) {
    console.warn(
      `Outline reference '${refName}' not found. Using default empty outline.`
    );
    return {
      name: 'default',
      reference: '<!-- No specific outline requested -->'
    };
  }
  return reference; // Return the object { name: '...', reference: '...' }
}

export async function submitGetKeywordVolumeList({
  limit,
  offset
}: {
  limit: number;
  offset: number;
}): Promise<KeywordVolumeListItem[]> {
  const keywordVolumeList = await getKeywordVolumeList({ limit, offset });
  return keywordVolumeList || [];
}
