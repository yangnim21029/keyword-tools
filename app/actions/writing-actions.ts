import { openai } from '@ai-sdk/openai';
import { fetchSerpByKeyword } from '../services/serp.service';
import { getContentTypeAnalysisPrompt, getUserIntentAnalysisPrompt } from '../prompt/serp-prompt-design';
import { generateText } from 'ai';
import { z } from 'zod';
import { MEDIASITE_DATA } from '../config/constants';
// Import fine-tune data
import { THEME_FINE_TUNE_DATA, MEDIA_SITE_FINE_TUNE_DATA, LANGUAGE_FINE_TUNE_DATA } from '../prompt/fine-tune';

  
const contentAngleReference = ''; // Corresponds to I4


// Define the prompt template as a constant string with proper formatting
async function getActionPlanPrompt(keyword: string, mediaSiteDataString: string, serp: string,serpTitleReport: string, serpContentReport: string, serpSearchIntentReport: string) {
    return `
don't search web, don't use canvas
, \n You are an SEO Project Manager with knowledge in consumer behavior theory, traditional marketing theory, and digital marketing theory. You will execute the following tasks:

1. **Keyword Theme Identification**: Identify the theme and subthemes of a user-provided keyword.
2. **Content Type Suggestion**: If a URL is provided by the user, use it solely for reference. Otherwise, search for related articles to determine the content type suggested by the keyword, described precisely in three English words using the ""A + B"" format.
3. **Action Plan Creation**: Craft a specific action plan for each subtheme, ensuring the content is bilingual (Chinese and English) with smooth language transition, using the provided example structure.

# Steps

1. **Identify Theme and Subthemes**:
    - Analyze the keyword to discern the main theme and potential subthemes.
2. **Determine Content Type**:
    - Rely on the provided URL if available, or conduct a search to propose content types.
3. **Create Action Plan**:
    - Formulate a detailed, bilingual action plan per subtheme.
    - Follow the provided sentence structure examples for coherence.

# Output Format

- Deliver a structured response with these sections:
    - **Keyword Theme and Subthemes**: Concise explanation of the themes and subthemes.
    - **Content Type Suggestion**: Suggestions in ""A + B"" format.
    - **Action Plan**:
        - Three variations tailored to different user interests:
            - **Subtheme**: Ethical production
            - **ActionPlan:**
Create in-depth recipes for each soup, highlighting traditional preparation methods.
為每種湯品創建深入的食譜，突顯傳統的製作方法。
    
    Develop content around the health benefits of key ingredients (e.g., 淮山, 茨實, 花膠).
    圍繞主要成分的健康益處開發內容（例如，淮山、茨實、花膠）。
    
    Produce video tutorials for complex recipes like 淮山茨實鱷魚肉湯, showcasing proper techniques.
    製作複雜食譜的視頻教程，如淮山茨實鱷魚肉湯，展示正確的技術。
    
    Write articles on the cultural significance of these soups in Hong Kong cuisine.
    撰寫有關這些湯品在香港料理中文化意義的文章。
            - **Version 2**: Version 2 of the action plan.
            - **Version 3**: Version 3 of the action plan.

# **Versions**

給我包含以下單個版本，針對此網站的用戶想知道的訊息，進行 action plan 的調整，每一個都要不一樣。
action plan 要用中英文撰寫，但是你不應該給出中英文撰寫的指令，我們沒有雙語寫手，也沒有影音圖片製作

Version:
${mediaSiteDataString}

"# Notes

- Ensure all outputs are detailed and aligned with user expectations.
- People won't consider location to choose anything if they are not in travel context.
- If Website won't mention the keyword, add notice to that version
- we don't produce video and image

---

- Keyword: ${keyword}
- Keyword Research Report: ${serpTitleReport} ${serpContentReport} ${serpSearchIntentReport}
- SERP (title / metadescription): ${serp}

---

write h2 Keyword Theme and Subthemes for ${keyword}
h3 Main Theme: xxx
h3 Subthemes
h3 Content Type Suggestion 
h4 Suitable content type
h2 SEO
h3 user intent
h3 keyword mapping suggestion
h2 Action Plan
h3 [version] {website full title}
h4 Subtheme:
h4 Suggest Title:
h4 other actions to make to match top3 content type(..) in Specific detail:
h4 List of keywords:
`;
}


async function generateActionPlan(keyword: string, serpTitleReport: string, serpContentReport: string, serpSearchIntentReport: string, serp: string, mediaSiteDataString: string) {
    const prompt = await getActionPlanPrompt(keyword, mediaSiteDataString, serp, serpTitleReport, serpContentReport, serpSearchIntentReport);
    const { text: actionPlanText } = await generateText({
        model: openai('gpt-4.1-mini'),
        prompt: prompt,
    });
    console.log('[Research Action - Step 2] Generated Action Plan.');
    return actionPlanText;
}

// Helper function to get fine-tune data as string
function getFineTuneDataStrings(names?: string[]): string {
    if (!names || names.length === 0) {
        return "";
    }

    const allData = [
        ...THEME_FINE_TUNE_DATA,
        ...MEDIA_SITE_FINE_TUNE_DATA,
        ...LANGUAGE_FINE_TUNE_DATA
    ];

    const filteredData = allData.filter(item => names.includes(item.name));

    if (filteredData.length === 0) {
        return "";
    }

    // Format the output string
    const formattedStrings = filteredData.map(item => {
        // Ensure data exists and has a description, though schema should guarantee description
        const description = item.data_set_description || 'No description provided';
        const dataString = JSON.stringify(item.data, null, 2); // Stringify only the data array
        return `===\n${description}\n${dataString}\n===`;
    });

    // Join the formatted strings, separated by double newlines for clarity
    return `\n\n--- Fine-Tune Data ---\n${formattedStrings.join('\n\n')}`;
}

// Helper function to format KeywordResearchItem for the prompt
function formatKeywordReportForPrompt(report: any, selectedClusterName?: string | null): string {
    if (!report || typeof report !== 'object' || Object.keys(report).length === 0) {
        return "";
    }

    const formatNumber = (num: number | null | undefined): string => {
        return typeof num === 'number' ? num.toLocaleString() : 'N/A';
    };

    const formatKeywords = (keywords: any[] | undefined): string => {
        if (!keywords || keywords.length === 0) {
            return "No specific keywords found.";
        }
        // Make sure keyword object has a 'text' property before accessing
        return keywords.map((k: any) => {
            const text = k?.text || JSON.stringify(k); // Handle cases where text might be missing
            const vol = formatNumber(k?.search_volume); // Use optional chaining
            return `${text} (Vol: ${vol})`;
        }).join(', ');
    };

    let output = `\n- **相關關鍵字研究報告** (Keyword Research Report):\n`;
    output += `  - 主查詢 (Main Query): ${report.query || 'N/A'}\n`;
    output += `  - 總搜尋量 (Total Volume): ${formatNumber(report.totalVolume)}\n`;
    output += `  - 語言 (Language): ${report.language || 'N/A'}\n`;
    output += `  - 地區 (Region): ${report.region || 'N/A'}\n`;

    if (report.clusters && Array.isArray(report.clusters) && report.clusters.length > 0) {
        output += `  - **主題分群** (Clusters):
`;
        report.clusters.forEach((cluster: any, index: number) => {
            const clusterName = cluster.clusterName || `Cluster ${index + 1}`;
            // Add a marker if this cluster is the selected one
            const marker = selectedClusterName && clusterName === selectedClusterName ? ' [TARGET CLUSTER]' : '';
            output += `    - **分群 ${index + 1}: ${clusterName}**${marker} (Volume: ${formatNumber(cluster.totalVolume)})\n`;
            output += `      - 關鍵字 (Keywords): ${formatKeywords(cluster.keywords)}\n`;
        });
    } else if (report.keywords && Array.isArray(report.keywords) && report.keywords.length > 0) {
        output += `  - **關鍵字** (Keywords - No specific clusters):\n`;
        output += `    - ${formatKeywords(report.keywords)}\n`;
    } else {
        output += `  - 關鍵字 (Keywords): No specific keyword data available.\n`;
    }

    output += `  - 報告更新時間 (Report Updated): ${report.updatedAt ? new Date(report.updatedAt).toLocaleString() : 'N/A'}\n`;
    return output + "\n";
}


// Updated to accept keywordReport and selectedClusterName
export function getResearchPrompt(
    keyword: string,
    actionPlan: string,
    mediaSiteDataString: string,
    serp: string,
    contentTypeReportText: string,
    userIntentReportText: string,
    keywordReport?: any,
    selectedClusterName?: string | null // Added selectedClusterName parameter
) {
    // Convert keywordReport to a readable string format for the prompt
    // Pass selectedClusterName to the formatter
    const keywordReportString = formatKeywordReportForPrompt(keywordReport, selectedClusterName);

    // Base prompt string
    const systemPrompt = `
        You will be tasked to create SEO-optimized content for a given keyword.(從頭撰寫一篇全新文章)

        Your thinking should be thorough and so it's fine if it's very long. You can think step by step before and after each action you decide to take.

        You MUST iterate and keep going until the content is perfectly optimized.

        You already have everything you need to create this content in the /resources folder, even without internet connection. I want you to fully optimize this autonomously before coming back to me.

        Only terminate your turn when you are sure that the content is fully optimized. Go through the optimization step by step, and make sure to verify that your adjustments are correct. NEVER end your turn without having fully optimized the content, and when you say you are going to make a tool call, make sure you ACTUALLY make the tool call, instead of ending your turn.

        THE CONTENT CAN DEFINITELY BE OPTIMIZED WITHOUT THE INTERNET.

        Take your time and think through every step - remember to check your content rigorously and watch out for keyword usage, readability, and SEO best practices, especially with the adjustments you made. Your content must be perfect. If not, continue working on it. At the end, you must test your content rigorously using the tools provided, and do it many times, to catch all optimization opportunities. If it is not perfectly optimized, iterate more and make it perfect. Failing to test your content sufficiently rigorously is the NUMBER ONE failure mode on these types of tasks; make sure you handle all readability, keyword usage, and structure requirements, and run existing SEO checks if they are provided.

        You MUST plan extensively before each adjustment, and reflect extensively on the outcomes of previous adjustments. DO NOT do this entire process by making content adjustments only, as this can impair your ability to optimize the content and think insightfully.

    If you are not sure about file content or codebase structure pertaining to the user's request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.
    You MUST plan extensively before each function call, and reflect extensively on the outcomes of the previous function calls. DO NOT do this entire process by making function calls only, as this can impair your ability to solve the problem and think insightfully.

    `
    // Updated base prompt including keywordReportString
    const basePrompt = `
    ${systemPrompt}
    ----
**重點項目：**

- 文章類型需求與規則：${actionPlan}

- **目標關鍵字**（必填）：${keyword}
${keywordReportString}

- **寫作風格**：${mediaSiteDataString}

- **內容類型分析**：${contentTypeReportText}

- 搜尋結果頁面：${serp}

Length: 1500-3000 words.

--------
1. **搜尋意圖分析：**
- 請依據目標關鍵字判定主要搜尋意圖，並確保文章符合此搜尋意圖。
- 自動分析 Google SERP 頁面，確保文章內容完整符合使用者需求。
${userIntentReportText}
2. **競爭對手內容分析：**
- 在本文中包含競爭者提及，但缺乏的議題、獨特觀點或深入資訊，確保產出內容更具價值與競爭力。
3. Google Helpful Content Guidelines: Adhere to Google's helpful content guidelines to ensure the article is user-focused and avoids manipulative SEO tactics.
4. Output only the article content. Do not include outlines, analysis processes, internal links, or source references within the article body. Place any references or URLs at the very end of the article, separate from the main content, and do not include them in the word count. 

1. **排版與可讀性：**
- 使用清晰易讀的短段落（50-100字內）。
- 必要時以列表（Bullet Points）、數據、案例研究輔助提高可讀性。
- 文章長段落內文，自動根據可讀性，易讀性，進行思考，並判斷是否需要換行或再次分段
- do not include () （） in the content
- do not include ： or : in the content, use <br> instead

1. 格式要求：
FAQ 段，do 1~3 questions, add link text only if it's relevant to the question in this section, do not add link in other sections
- do only 50~100 words for each question, which is relevant to the keyword and search intent
- instead put links in the article, do place link at bottom of the article

## Workflow

High-Level SEO Optimization Strategy

Understand the keyword and target audience deeply. Carefully read the keyword brief and think critically about what is required.

Investigate existing resources. Explore relevant documents, analyze keyword usage, and gather context.

Develop a clear, step-by-step plan. Break down the optimization into manageable, incremental steps.

Implement optimizations incrementally. Make small, testable content changes.

Adjust and refine as needed. Use editing techniques to enhance readability, keyword density, and relevance.

Test frequently. Run SEO checks after each change to verify correctness.

Iterate until the content is fully optimized and all checks pass.

Reflect and validate comprehensively. After checks pass, think about the original intent, perform additional SEO tests to ensure thoroughness, and remember there are hidden evaluation criteria that must also pass before the optimization is truly complete.

Refer to the detailed sections below for more information on each step.

1. Deeply Understand the Keyword

Carefully read the keyword brief and think hard about a plan to optimize before editing.

2. Resource Investigation

Explore relevant documents and guidelines.

Analyze current keyword usage, readability, and SEO structure.

Read and understand relevant content snippets.

Identify areas needing optimization.

Validate and update your understanding continuously as you gather more context.

3. Develop a Detailed Plan

Outline a specific, simple, and verifiable sequence of steps to optimize the content.

Break down the optimization into small, incremental changes.

4. Making Content Changes

Before editing, always read the relevant content sections to ensure complete context.

If an optimization is not applied correctly, attempt to reapply it.

Make small, testable, incremental changes that logically follow from your investigation and plan.

5. Adjusting and Refining

Make content changes only if you have high confidence they can enhance SEO performance.

When adjusting, try to improve overall readability and keyword relevance rather than addressing superficial metrics only.

Refine content for as long as needed to achieve optimal SEO results.

Use readability checks, keyword density analysis, or temporary content tests to inspect and improve content state.

Revisit your assumptions if unexpected results occur.

6. Final Verification

Confirm the content is optimized for the keyword.

Review your solution for readability, relevance, and robustness.

Iterate until you are extremely confident the content is fully optimized and all checks pass.



`;
    return basePrompt; // Fine-tune data will be appended in generateReaseachPrompt step 3
}

// Update function signature to accept selectedClusterName
export async function generateReaseachPrompt(
    keyword: string,
    mediaSiteName: string,
    step: number = 1,
    intermediateData: any = null,
    fineTuneNames?: string[],
    keywordReport?: any, // Keep keywordReport optional
    selectedClusterName?: string | null // Added selectedClusterName parameter
): Promise<string | object> {

    let currentKeyword: string = keyword;
    let currentMediaSiteName: string = mediaSiteName;
    let currentFineTuneNames: string[] | undefined = fineTuneNames;
    let currentKeywordReport: any = keywordReport;
    let currentSelectedClusterName: string | null | undefined = selectedClusterName;

    // Variables needed across steps, ensure they have default values or are assigned before use
    let mediaSiteDataString: string = "";
    let serpString: string = "";
    let contentTypeReportText: string = "";
    let userIntentReportText: string = "";
    let actionPlanText: string = ""; // Only needed for step 3

    console.log(`[Research Action] Entering Step ${step} for keyword: ${currentKeyword}, site: ${currentMediaSiteName}, cluster: ${currentSelectedClusterName ?? 'none'}`);

    // Extract all potential fields from intermediateData if it exists
    if (intermediateData) {
        currentKeyword = intermediateData.keyword || currentKeyword;
        currentMediaSiteName = intermediateData.mediaSiteName || currentMediaSiteName;
        mediaSiteDataString = intermediateData.mediaSiteDataString || "";
        serpString = intermediateData.serpString || ""; 
        contentTypeReportText = intermediateData.contentTypeReportText || "";
        userIntentReportText = intermediateData.userIntentReportText || "";
        currentFineTuneNames = intermediateData.fineTuneNames || currentFineTuneNames;
        currentKeywordReport = intermediateData.keywordReport || currentKeywordReport; // Extract report
        currentSelectedClusterName = intermediateData.selectedClusterName !== undefined ? intermediateData.selectedClusterName : currentSelectedClusterName; // Extract cluster name
        actionPlanText = intermediateData.actionPlanText || ""; 
    }

    // --- Step 1: Fetch Site Data, SERP, and Initial Analysis ---
    if (step === 1) {
        const mediaSite = MEDIASITE_DATA.find(site => site.name === currentMediaSiteName);
        if (!mediaSite) {
            console.error(`[Research Action - Step 1] Media site not found for name: ${currentMediaSiteName}`);
            throw new Error(`Media site not found for name: ${currentMediaSiteName}`);
        }
        const region = mediaSite.region;
        const language = mediaSite.language;
        mediaSiteDataString = JSON.stringify(mediaSite); // Assign calculated value

        console.log(`[Research Action - Step 1] Found site data. Region: ${region}, Language: ${language}`);

        const serp = await fetchSerpByKeyword(currentKeyword, region, language);
        console.log('[Research Action - Step 1] Fetched SERP data.');

        if (!serp.organicResults) {
            console.error('[Research Action - Step 1] No organic results found for keyword:', currentKeyword);
            throw new Error('No organic results found');
        }
        serpString = serp.organicResults.slice(0, 10).map(result => `${result.title} - ${result.description}`).join('\n'); // Assign calculated value
        console.log(`[Research Action - Step 1] Processed SERP String.`);

        console.log(`[Research Action - Step 1] ==== Start AI Analysis ====`);
        const contentTypeReportPrompt = getContentTypeAnalysisPrompt(currentKeyword, serpString);
        const contentTypeReport = await generateText({ model: openai('gpt-4.1-mini'), prompt: contentTypeReportPrompt });
        contentTypeReportText = contentTypeReport.text; // Assign calculated value
        console.log('[Research Action - Step 1] Generated Content Type Report.');

        const userIntentReportPrompt = getUserIntentAnalysisPrompt(currentKeyword, serpString, '');
        const userIntentReport = await generateText({ model: openai('gpt-4.1-mini'), prompt: userIntentReportPrompt });
        userIntentReportText = userIntentReport.text; // Assign calculated value
        console.log('[Research Action - Step 1] Generated User Intent Report.');

        // Return intermediate data for the next step, including report and cluster name
        return {
            keyword: currentKeyword,
            mediaSiteName: currentMediaSiteName,
            mediaSiteDataString, 
            serpString,         
            contentTypeReportText, 
            userIntentReportText, 
            fineTuneNames: currentFineTuneNames,
            keywordReport: currentKeywordReport, // Include report
            selectedClusterName: currentSelectedClusterName // Include cluster name
        };
    }

    // --- Step 2: Generate Action Plan ---
    if (step === 2) {
        if (!intermediateData) {
            throw new Error("[Research Action - Step 2] Intermediate data from Step 1 is required.");
        }
        // Variables mediaSiteDataString, serpString, contentTypeReportText, userIntentReportText
        // are guaranteed to be assigned here either from intermediateData or Step 1's calculation (if step logic allowed falling through, which it doesn't)

        // Generate Action Plan using populated variables
        actionPlanText = await generateActionPlan(currentKeyword, contentTypeReportText, userIntentReportText, '', serpString, mediaSiteDataString); // Assign calculated value

        // Return combined data for the next step
        return {
            ...intermediateData, // Pass all previous data (including report and cluster name)
            actionPlanText // Add the newly generated action plan text
        };
    }

    // --- Step 3: Generate Final Prompt String ---
    if (step === 3) {
        if (!intermediateData) {
            throw new Error("[Research Action - Step 3] Intermediate data from Step 2 is required.");
        }
        // All necessary variables (actionPlanText, mediaSiteDataString, etc.) are assigned via the 'if (intermediateData)' block.

        // Generate base prompt string using populated variables
        const researchPromptBase = getResearchPrompt(
            currentKeyword,
            actionPlanText, // Assigned either in step 2 or extracted from intermediateData
            mediaSiteDataString,
            serpString,
            contentTypeReportText,
            userIntentReportText,
            currentKeywordReport, // Pass report
            currentSelectedClusterName // Pass cluster name
        );
        console.log('[Research Action - Step 3] Generated base Research Prompt including keyword report and selected cluster.');

        // Get fine-tune data string
        const fineTuneDataString = getFineTuneDataStrings(currentFineTuneNames);

        // Append fine-tune data to the base prompt
        const finalPrompt: string = researchPromptBase + fineTuneDataString;

        console.log('[Research Action - Step 3] Appended fine-tune data. Final prompt generated.');
        return finalPrompt; // Return the final string
    }

    // Should not reach here
    throw new Error(`[Research Action] Invalid step number provided: ${step}. Valid steps are 1, 2, or 3.`);
}
