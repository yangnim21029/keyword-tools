export interface Prompt {
  id: string;
  name: string;
  description: string;
  text: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  action: (input: any) => Promise<any>;
}

// Semantic Clustering Prompt
export const semanticClusteringPrompt = `你是一個專業的關鍵字分群專家。請根據以下關鍵字進行語意分群，將相關的關鍵字歸類到合適的主題中。

語意辨識的方法是根據能否放到同一篇文章作為列表文章(listicle)的依據，不是以 SEO 為主。避免使用"基本知識"這種過於概括的詞分群。

關鍵字列表：
{keywords}

請將關鍵字分群並返回一個 JSON 對象，格式如下：
{
  "clusters": {
    "主題名稱1": ["關鍵字1", "關鍵字2", ...],
    "主題名稱2": ["關鍵字3", "關鍵字4", ...]
  }
}

注意事項：
1. 每個主題名稱應該簡潔明確
2. 每個分群至少包含 2 個關鍵字
3. 確保返回的是有效的 JSON 格式
4. 不要添加任何額外的說明文字，只返回 JSON 對象`;

// SERP Analysis Prompt
export const serpAnalysisPrompt = `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

Please type the text "SEO Report: Analyze SERP Titles for [{keyword}]" in h2 heading

Please type "What this report does: The Analyze SERP Titles report looks at the top webpages ranking in Google on the first page for the search query and tries to find patterns in them. It explains what it finds and gives recommendations for the title and also suggests a title for your content". 

Please type "When to use this report: The Analyze SERP Titles report should be used before you start writing content, by creating the page title. Read the recommendations and feel free to ask for more suggested page titles.".

You are an SEO expert who is very good at understanding and analyzing SERPs.

I have obtained data for the websites ranking for the first page of a top search engine for the search query "{keyword}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze the titles and find what is common among all of them. Finally, also create a new title that has the best of everything that is common.

The positions, titles, descriptions and URLs are given below:

{serpResults}

When you mention any position, display the link of the URL and use the number of the position as the anchor text.

Respond with a JSON object with the following structure:
{
  "title": "Your suggested optimized title",
  "analysis": "Your detailed analysis of the SERP titles",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

Do not include any text outside of this JSON structure. Return valid JSON only.`;

// User Persona Prompt
export const userPersonaPrompt = `你是一位市場分析專家和用戶研究員。請根據以下提供的 **單一** 關鍵字分群主題及其包含的關鍵字，分析並描述這些搜索背後可能的用戶畫像。

分群主題: {clusterName}
關鍵字: {keywordString}

請提供一個簡潔（約 100-150 字）的用戶畫像描述，涵蓋以下幾點：
1.  **主要意圖**: 搜索該主題關鍵字的用戶可能想達成什麼目標？
2.  **知識水平**: 他們對該特定主題的了解程度大概如何？
3.  **潛在需求/痛點**: 與該主題相關，他們可能有什麼需求或痛點？
4.  **可能的背景**: 簡單推測用戶可能的職業、興趣或身份。

請直接返回用戶畫像的描述文字，不要包含任何前綴、標題或額外說明。`;

// SEO Report - User Intent Analysis Prompt
export const userIntentAnalysisPrompt = `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

Please type "## SEO Report: User Intent Analysis for [{query}]"

Please type "What this report does: The User Intent Analysis report looks at the top webpages ranking in Google on the first page and tries to figure out the user intent that each satisfies. It then presents this data categorized in a table. It also gives you keywords relevant to each of the user intents it has found.".

Please type "When to use this report: The User Intent Analysis report should be used when you want to double check what the intent of the user is for the search query. Before you start creating content for this search query, you need to decide which user intent(s) you want your content to satisfy.".

You are an SEO expert who is very good at understanding user intents from a search result. You know that there are four types of search intent - Navigational, Informational, Commercial & Transactional. You are able to figure out the exact search intent and then categorize it into one of the four types of search intent.

Please type "Below are the different types of user intents found by analyzing the SERPs"

Please type "#### User Intent"

Please create a markdown table with three columns "Search Intent Category" "Actual Intent" and "Pages".

I have obtained data for the websites ranking for the first page of a top search engine for the search query "{query}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze them and figure out the user intent that each page is written for. Once done, please collate all the user intents together.

I want you to ouput the user intents, the type of user intent it is, and the number of the pages that have that user intent in the "Search Intent" column. In the "Pages" column I want you to display links to the URLs of those pages. Then Anchor text of the links should be the position number - e.g. 1 or 2 or 3.

Please type "Ideally your content should target one of the above user intents. However, it's fine to target one or more of them."

The positions, titles, descriptions and URLs are given below:

{serpData}

I am listing down all the related keywords and their search volume relevant to this search query below. The keyword and search volume is separated by a comma. If the volume does not have a comma before it, then note that it is part of the keyword. All volumes will have a comma in front of the number. If there are no commas then assume that the volume is 0. Please remove the commas before you show the search volume.

{keywordData}

If there were no keywords in the list above, then please type "No keywords with search volume were found". Link the text to https://keywordseverywhere.com/seo-reports.html#faq.

If there were keywords found in the list above, then please type "Once you've chosen the user intent, remember to add relevant keywords from the list below to your content."

If there were keywords found in the list above, then please type "#### User Intent Keywords"

If there were keywords found in the list above, match the relevant keywords given to you to each of the user intents you have come up with. Then for each of the user intents, create a markdown table with two columns "Keywords" and "Search Volume". The "Keywords" column contains the keyword and the "Search Volume" column contains the search volume. If there is no search volume, please do not hallucinate a number, Please instead put the text "?" in it's place and link only the "?" to https://keywordseverywhere.com/seo-reports.html#faq. The table header should be the user intent along with the type of user intent it is.

Create a new table with one column.`;

// SEO Report - Traffic Optimization Analysis Prompt
export const trafficOptimizationPrompt = `不看數據，網站流量來源分析，如麥肯錫重新驗證推論假設，分析網站流量來源，驗證 persona 動機與需求特性，根據數據，提出優化建議，最後檢查來源銜接頁面數量，多字但頁面數越低越好（主題涵蓋高又集中=文章成本維護成本低=好）

回應的描述方式融入日常

不提網站速率

不提社群媒體

每一句都需要包含關鍵字

優化提及總體市場，潛在市場，佔有市場的流量來源特徵

優化指的是流量來源佈局優化，網站整體架構配置與第一印象洗腦，不提內容的反應，不提頁面配置

0 是數字中最小的

你的回應採用 ahref PSA 框架

[問題與動機] - 包含關鍵字

[表格支持] - 包含排名（排名數字小，展示次數大，排名與展示次數為反比關係）

[建立回答論述] - 多次換行

數據為佔有市場，非總體市場

回應的尾部要包含關鍵字

最後增加一段，向用戶提議兩個方向，類似，要不要試試...

---
{keywordData}`;

// SEO Report - Content Type Analysis Prompt
export const contentTypeAnalysisPrompt = `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

Please type the text "## SEO Report: Content Type Analysis for [{query}]"

Please type "What this report does: The Content Type Analysis report looks at the top webpages ranking in Google on the first page and tries to classify the content based on type. It then presents this data categorized in a table.".

Please type "When to use this report: The Content Type Analysis report should be used when you want to figure out the type of content that is shown by Google to satisfy the search query. If Google always shows a particular type of content for this query, then you may want to create content of the same type.".

You are an SEO expert who is very good at analyzing the SERPS and figuring out what are the different content types shown in the top organic results. You know that there are eight types of content as mentioned below:

1. How to guides
2. Step by step tutorials
3. List posts
4. Opinion editorials
5. Videos
6. Product pages
7. Category pages
8. Landing pages for a service

Please create a markdown table with two columns "Content Type" and "Pages".

I have obtained data for the websites ranking for the first page of a top search engine for the search query "{query}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze them and categorize them based on the 8 content types mentioned earlier. Ensure that each SERP result is assigned to only one content type. Once done, please collate all the content types together.

I want you to ouput the content types, and the number of the pages that are categorized in that content type in the "Content Type" column. In the "Pages" column I want you to display links with URLs of those pages. Then Anchor text of the links should be the position number - e.g. 1 or 2 or 3.

The positions, titles, descriptions and URLs are given below, it may contain ad and rich-snippet result:

{serpData}`;

// SEO Report - Theme and Action Plan Prompt
export const themeActionPlanPrompt = `Don't search web, don't use canvas.

You are an SEO Project Manager with knowledge in consumer behavior theory, traditional marketing theory, and digital marketing theory. You will execute the following tasks:

1. **Keyword Theme Identification**: Identify the theme and subthemes of a user-provided keyword.
2. **Content Type Suggestion**: If a URL is provided by the user, use it solely for reference. Otherwise, search for related articles to determine the content type suggested by the keyword, described precisely in three English words using the "A + B" format.
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
    - **Content Type Suggestion**: Suggestions in "A + B" format.
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

給我包含以下多個版本，針對不同網站的用戶想知道的訊息，進行 action plan 的調整，每一個都要不一樣。

[Version]
HolidaySmart 假期日常 | 香港最強食買玩旅遊資訊精明消費雜誌|「HolidaySmart 
假期日常」為讀者蒐羅高質素的本地及旅遊美食、必買、好去處資訊之外，亦會分享每日優惠情報、報告各類限時折扣優惠等，令大家一齊成為至 Smart 
精明消費者。

[Version]
MamiDaily 親子日常 | 媽媽專屬的育兒心得交流平台|一個專門為母親或準媽媽分享和獲得有關懷孕、育兒、升學和嬰兒服裝等資訊的平台。

[Version]
UrbanLife Health 健康新態度 | 新一代都市人都關心的 · 健康生活新態度|提供最新最深入的醫療健康資訊，搜羅專科醫生專業意見，帶大家認識癌症、深入了解皮膚濕疹、鼻敏感、胃痛、心口痛等常見病。介紹食物營養、湯水食譜，盡在 
UrbanLife Health 健康新態度。

# Notes

- Ensure all outputs are detailed and aligned with user expectations.
- People won't consider location to choose anything if they are not in travel context.
- If Website won't mention the keyword, add notice to that version
- we don't produce video and image

---

- Keyword: "{keyword}"
- Keyword Research Report: "{userIntentReport}&{trafficReport}&{serpTitleReport}&{contentTypeReport}"
- SERP (title / metadescription): "{serpData}"

---

write h2 Keyword Theme and Subthemes for "{query}"
h3 Main Theme: xxx
h3 Subthemes
h3 Content Type Suggestion 
h4 top3
h2 SEO
h3 user intent
h3 keyword mapping suggestion
h2 Action Plan
h3 [version] {{website full title}}
h4 Subtheme:
h4 Suggest Title:
h4 Tricks to match top3 content type(..):
h4 List`;

// Import server actions
import { performSemanticClustering } from '../actions/semantic-clustering';
import { performSerpAnalysis } from '../actions/serp-analysis';
import { generateUserPersonaFromClusters } from '../actions/generate-persona';
import { mockSeoAction } from '../actions/mock-seo';

// Define the list of prompts to display and test
export const Prompts: Prompt[] = [
  {
    id: 'semantic-clustering',
    name: 'Semantic Clustering',
    description: 'Groups related keywords into semantic clusters',
    text: semanticClusteringPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of keywords to cluster'
        },
        model: {
          type: 'string',
          enum: ['gpt-4o', 'gpt-4o-mini'],
          default: 'gpt-4o-mini',
          description: 'AI model to use for clustering'
        }
      },
      required: ['keywords']
    },
    action: performSemanticClustering
  },
  {
    id: 'serp-analysis',
    name: 'SERP Analysis',
    description: 'Analyzes search engine results to provide SEO insights',
    text: serpAnalysisPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to analyze SERP for'
        },
        model: {
          type: 'string',
          enum: ['gpt-4o', 'gpt-4o-mini'],
          default: 'gpt-4o-mini',
          description: 'AI model to use for analysis'
        }
      },
      required: ['keyword']
    },
    action: performSerpAnalysis
  },
  {
    id: 'user-persona',
    name: 'User Persona Generation',
    description: 'Creates user personas based on keyword clusters',
    text: userPersonaPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        clusterName: {
          type: 'string',
          description: 'Name of the keyword cluster'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords in the cluster'
        },
        model: {
          type: 'string',
          enum: ['gpt-4o', 'gpt-4o-mini'],
          default: 'gpt-4o-mini',
          description: 'AI model to use for persona generation'
        }
      },
      required: ['clusterName', 'keywords']
    },
    action: generateUserPersonaFromClusters
  },
  {
    id: 'user-intent-analysis',
    name: 'User Intent Analysis',
    description: 'Analyzes SERP data to identify user intent patterns',
    text: userIntentAnalysisPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to analyze'
        },
        serpData: {
          type: 'string',
          description: 'SERP data (positions, titles, URLs)'
        },
        keywordData: {
          type: 'string',
          description: 'Related keywords and search volumes'
        }
      },
      required: ['query', 'serpData']
    },
    action: mockSeoAction
  },
  {
    id: 'traffic-optimization',
    name: 'Traffic Optimization Analysis',
    description: 'Analyzes traffic sources and provides optimization suggestions',
    text: trafficOptimizationPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        keywordData: {
          type: 'string',
          description: 'Keyword data to analyze for traffic optimization'
        }
      },
      required: ['keywordData']
    },
    action: mockSeoAction
  },
  {
    id: 'content-type-analysis',
    name: 'Content Type Analysis',
    description: 'Analyzes SERP data to identify content type patterns',
    text: contentTypeAnalysisPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to analyze'
        },
        serpData: {
          type: 'string',
          description: 'SERP data (positions, titles, URLs)'
        }
      },
      required: ['query', 'serpData']
    },
    action: mockSeoAction
  },
  {
    id: 'theme-action-plan',
    name: 'Theme & Action Plan',
    description: 'Creates a comprehensive SEO action plan with different versions',
    text: themeActionPlanPrompt,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to analyze'
        },
        keyword: {
          type: 'string',
          description: 'Keyword data'
        },
        serpData: {
          type: 'string',
          description: 'SERP data (titles, descriptions)'
        },
        userIntentReport: {
          type: 'string',
          description: 'User intent analysis report'
        },
        trafficReport: {
          type: 'string',
          description: 'Traffic optimization report'
        },
        serpTitleReport: {
          type: 'string',
          description: 'SERP title analysis report'
        },
        contentTypeReport: {
          type: 'string',
          description: 'Content type analysis report'
        }
      },
      required: ['query', 'keyword', 'serpData']
    },
    action: mockSeoAction
  }
]; 