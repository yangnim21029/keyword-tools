import { ExplainApi } from '../components/explain-api';

export default function ApiDocsPage() {

  // --- /api/writing/outline ---
  const outlineApiUrl = '/api/writing/outline';
  const outlineDescription = 'Accepts a keyword, language, and region via POST (optionally provide targetWebsites array) and returns a structured JSON object containing H2/H3 headings for a generated, localized article outline. If targetWebsites are provided, interests relevant to those sites are prioritized; otherwise, general SERP-based interests are identified.';
  const outlineCurlCommand = `curl -X POST ${outlineApiUrl} \
-H "Content-Type: application/json" \
-d '{
  "keyword": "your keyword and related context/URL here"
}'`;
  const outlineDefaultBody = { keyword: "四神湯 功效", language: "zh-TW", region: "tw", targetWebsites: [] };

  // --- /api/writing ---
  const writingApiUrl = '/api/writing';
  const writingDescription = 'Accepts a keyword and mediaSiteName via POST, runs the full 3-step research process (Analyze, Plan, Finalize), and returns the final prompt string as plain text.';
  const writingCurlCommand = `curl -X POST ${writingApiUrl} \
-H "Content-Type: application/json" \
-d '{
  "keyword": "your keyword",
  "mediaSiteName": "YourMediaSiteName" 
}'`;
  const writingDefaultBody = { keyword: "養生茶 推薦", mediaSiteName: "BF" }; // Example

  // --- /api/writing/steps/1-analyze ---
  const analyzeApiUrl = '/api/writing/steps/1-analyze';
  const analyzeDescription = 'Step 1: Accepts keyword, mediaSiteName, optional fineTuneNames, optional keywordReport, optional selectedClusterName via POST. Performs initial analysis (SERP fetch, content/intent reports) and returns intermediate JSON data for Step 2.';
  const analyzeCurlCommand = `curl -X POST ${analyzeApiUrl} \
-H "Content-Type: application/json" \
-d '{
  "keyword": "your keyword",
  "mediaSiteName": "YourMediaSiteName",
  "fineTuneNames": ["theme-example"],
  "keywordReport": { \"query\": \"...\" },
  "selectedClusterName": "Cluster Name Example"
}'`; // Note: keywordReport structure can be complex
  const analyzeDefaultBody = { keyword: "益生菌 推薦", mediaSiteName: "GirlStyle" };

  // --- /api/writing/steps/2-plan ---
  const planApiUrl = '/api/writing/steps/2-plan';
  const planDescription = 'Step 2: Accepts the full JSON output from Step 1 via POST. Generates the action plan based on the analysis and returns updated intermediate JSON data for Step 3.';
  const planCurlCommand = `curl -X POST ${planApiUrl} \
-H "Content-Type: application/json" \
-d '{ /* Full JSON output from Step 1 goes here */ }'`;
  const planDefaultBody = { 
    /* Example structure - In reality, use output from step 1 */
    keyword: "益生菌 推薦", 
    mediaSiteName: "GirlStyle",
    mediaSiteDataString: JSON.stringify({ name: "GirlStyle", region: "HK", language: "zh-HK", /* other site data */ }), // Example stringified object
    serpString: "Example SERP Title 1 - Example SERP Description 1\nExample SERP Title 2 - ...", // Example SERP string
    contentTypeReportText: "Example Content Type Report text...", // Example report text
    userIntentReportText: "Example User Intent Report text...", // Example report text
    fineTuneNames: [] as string[], // Ensure correct type
    keywordReport: null as any, // Explicitly null
    selectedClusterName: null as string | null // Explicitly null
  };

  // --- /api/writing/steps/3-finalize ---
  const finalizeApiUrl = '/api/writing/steps/3-finalize';
  const finalizeDescription = 'Step 3: Accepts the full JSON output from Step 2 via POST. Generates the final research prompt string based on the plan and analysis, returning it as plain text.';
  const finalizeCurlCommand = `curl -X POST ${finalizeApiUrl} \
-H "Content-Type: application/json" \
-d '{ /* Full JSON output from Step 2 goes here */ }'`;
    const finalizeDefaultBody = { 
    /* Example structure - In reality, use output from step 2 */
    ...planDefaultBody, // Use the updated representative structure from Step 2 default
    actionPlanText: "Generated action plan details..."
  };

  // --- /api/writing/seo-topic-search ---
  const seoTopicSearchApiUrl = '/api/writing/seo-topic-search';
  const seoTopicSearchDescription = 'Accepts keyword, language, region, and optional targetWebsites via POST. Uses web search to find relevant content, extracts H2 headings, and returns a plain text list structured with markdown `##` headings categorizing the H2s by content type (e.g., Problem Summary, Knowledge Points, Potential Crises).';
  const seoTopicSearchCurlCommand = `curl -X POST ${seoTopicSearchApiUrl} \
-H "Content-Type: application/json" \
-d '{
  "keyword": "your keyword",
  "language": "zh-TW",
  "region": "tw",
  "targetWebsites": ["optional-site.com"]
}'`;
  const seoTopicSearchDefaultBody = { keyword: "膠原蛋白 推薦", language: "zh-TW", region: "tw", targetWebsites: [] };

  // Combine all route definitions
  const apiRoutes = [
    {
      apiUrl: seoTopicSearchApiUrl,
      description: seoTopicSearchDescription,
      curlCommand: seoTopicSearchCurlCommand,
      defaultPostBody: seoTopicSearchDefaultBody,
      method: 'POST' as const,
    },
    {
      apiUrl: outlineApiUrl,
      description: outlineDescription,
      curlCommand: outlineCurlCommand,
      defaultPostBody: outlineDefaultBody,
      method: 'POST' as const,
    },
    {
      apiUrl: writingApiUrl,
      description: writingDescription,
      curlCommand: writingCurlCommand,
      defaultPostBody: writingDefaultBody,
      method: 'POST' as const,
    },
    {
      apiUrl: analyzeApiUrl,
      description: analyzeDescription,
      curlCommand: analyzeCurlCommand,
      defaultPostBody: analyzeDefaultBody,
      method: 'POST' as const,
    },
    {
      apiUrl: planApiUrl,
      description: planDescription,
      curlCommand: planCurlCommand,
      defaultPostBody: planDefaultBody,
      method: 'POST' as const,
    },
    {
      apiUrl: finalizeApiUrl,
      description: finalizeDescription,
      curlCommand: finalizeCurlCommand,
      defaultPostBody: finalizeDefaultBody,
      method: 'POST' as const,
    },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto' }}>
      <h1>API Documentation & Testing</h1>
      <p style={{fontSize: '1.05rem', color: '#555', marginBottom: '30px'}}>This page provides usage examples and allows interactive testing of the available writing API endpoints.</p>
      
      {apiRoutes.map((route, index) => (
        <ExplainApi 
          key={index} 
          apiUrl={route.apiUrl}
          description={route.description}
          curlCommand={route.curlCommand}
          defaultPostBody={route.defaultPostBody}
          method={route.method}
        />
      ))}
    </div>
  );
}
