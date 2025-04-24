'use client';

import { useState } from 'react';
import {
  getOrFetchSerpDataAction,
  performContentTypeAnalysis,
  performUserIntentAnalysis,
  generateAnalysisJsonFromText,
  performSerpTitleAnalysis,
  performBetterHaveInArticleAnalysis,
} from '@/app/actions/serp-action'; // Adjust path if needed
import type {
  // Import original types for reference if needed, but don't use directly for state
  FirebaseSerpDataDoc as OriginalFirebaseSerpDataDoc,
  ContentTypeAnalysisJson,
  UserIntentAnalysisJson,
  TitleAnalysisJson,
  BetterHaveAnalysisJson // Import the new JSON type
} from '@/app/services/firebase/schema'; // Adjust path if needed

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from 'lucide-react'; // For alert icon

// Define a client-safe version of the SERP data type expected from the action
// This should match the structure returned by getOrFetchSerpDataAction after serialization
type ClientSafeSerpData = Omit<OriginalFirebaseSerpDataDoc, 'createdAt' | 'updatedAt' | 'betterHaveAnalysisText' | 'betterHaveAnalysisJson'> & {
    id: string;
    createdAt: string | null; // Expecting ISO string or null
    updatedAt: string | null; // Expecting ISO string or null
    // Add the new fields if needed for display (optional)
    betterHaveAnalysisText?: string | null;
    betterHaveAnalysisJson?: BetterHaveAnalysisJson | null;
};

// Helper function to format organic results into a string for prompts
function formatSerpResults(organicResults: any[] | undefined | null): string {
  if (!Array.isArray(organicResults) || organicResults.length === 0) {
    return 'No organic results found.';
  }
  return organicResults
    .map(
      (result, index) =>
        `Position ${result.position || index + 1}:\nTitle: ${result.title}\nDescription: ${result.description}\nURL: ${result.url}\n---`
    )
    .join('\n\n');
}

// Helper function to format related queries into a raw string for prompts
// Note: The User Intent prompt currently expects keyword,volume format.
// We only have query and URL in relatedQueries, so we adapt.
// The AI prompt might need adjustment if volume is strictly required.
function formatRelatedKeywords(relatedQueries: any[] | undefined | null): string {
    if (!Array.isArray(relatedQueries) || relatedQueries.length === 0) {
        return 'No related keywords found.';
    }
    // Return just the query, mimicking the expected format as best as possible
    // without volume data. The prompt's description mentions AI handling formatting.
    return relatedQueries
        .map(q => `${q.query}, ?`) // Adding ', ?' to mimic format for AI
        .join('\n');
}

// --- NEW Helper Functions for Better Have prompt ---

function formatPAA(peopleAlsoAsk: any[] | undefined | null): string {
     if (!Array.isArray(peopleAlsoAsk) || peopleAlsoAsk.length === 0) {
        return 'No People Also Ask data found.';
    }
    return peopleAlsoAsk
        .map(paa => `- ${paa.question}${paa.answer ? `\n  Answer Snippet: ${paa.answer.substring(0, 100)}...` : ''}`)
        .join('\n');
}

function formatAIOverview(aiOverview: string | undefined | null): string {
    if (!aiOverview || typeof aiOverview !== 'string' || aiOverview.trim().length === 0) {
        return 'No AI Overview data found.';
    }
    // Limit length if necessary for the prompt
    return aiOverview.substring(0, 1000) + (aiOverview.length > 1000 ? '...' : '');
}

export default function TestSerpActionPage() {
  // Input State
  const [query, setQuery] = useState<string>('best seo tools');
  const [region, setRegion] = useState<string>('us');
  const [language, setLanguage] = useState<string>('en');

  // SERP Data State
  // Use the client-safe type
  const [serpData, setSerpData] = useState<ClientSafeSerpData | null>(null);
  const [serpString, setSerpString] = useState<string>('');
  const [relatedKeywordsRaw, setRelatedKeywordsRaw] = useState<string>('');
  const [paaString, setPaaString] = useState<string>('');
  const [aiOverviewString, setAiOverviewString] = useState<string>('');
  const [isLoadingSerp, setIsLoadingSerp] = useState<boolean>(false);
  const [serpError, setSerpError] = useState<string | null>(null);

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<{
      analysisText?: string | null;
      analysisJson?: ContentTypeAnalysisJson | UserIntentAnalysisJson | TitleAnalysisJson | BetterHaveAnalysisJson | null;
      recommendationText?: string | null;
      type: 'ContentType' | 'UserIntent' | 'Title' | 'BetterHave' | null;
  }>({ type: null });
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisExecutionTime, setAnalysisExecutionTime] = useState<number | null>(null);
  const [currentAnalysisType, setCurrentAnalysisType] = useState<'ContentType' | 'UserIntent' | 'Title' | 'BetterHave' | null>(null);

  // --- Handlers ---

  const handleFetchSerp = async () => {
    setIsLoadingSerp(true);
    setSerpError(null);
    setSerpData(null);
    setSerpString('');
    setRelatedKeywordsRaw('');
    setPaaString('');
    setAiOverviewString('');
    setAnalysisResult({ type: null });
    setAnalysisError(null);
    setAnalysisExecutionTime(null);
    setCurrentAnalysisType(null);

    try {
      // The action now returns the ClientSafeSerpDataDoc type
      const result: ClientSafeSerpData | null = await getOrFetchSerpDataAction({ query, region, language });
      if (result) {
        setSerpData(result);
        // --- Slice organicResults before formatting ---
        const top15Results = result.organicResults?.slice(0, 15); // Get top 15 or fewer
        setSerpString(formatSerpResults(top15Results)); // Format only the top 15
        // --- Keep formatting related keywords as before ---
        setRelatedKeywordsRaw(formatRelatedKeywords(result.relatedQueries));
        setPaaString(formatPAA(result.peopleAlsoAsk));
        setAiOverviewString(formatAIOverview(result.aiOverview));
      } else {
        setSerpError('Failed to fetch or retrieve SERP data.');
      }
    } catch (err: any) {
      setSerpError(err.message || 'An unknown error occurred during SERP fetch.');
    } finally {
      setIsLoadingSerp(false);
    }
  };

  const handleAnalysis = async (type: 'ContentType' | 'UserIntent' | 'Title' | 'BetterHave') => {
      if (!serpData || !serpData.id || !serpString) {
          setAnalysisError("SERP data not available or missing required fields (id, serpString). Fetch SERP data first.");
          return;
      }

      setIsLoadingAnalysis(true);
      setCurrentAnalysisType(type);
      setAnalysisError(null);
      setAnalysisResult({ type: null });
      setAnalysisExecutionTime(null);
      const startTime = performance.now();

      try {
          let result: any;

          const baseParams = {
              docId: serpData.id,
              keyword: serpData.query,
              serpString: serpString,
          };

          if (type === 'ContentType') {
              console.log("Step 1: Generating Content Type Text Analysis...");
              const textAnalysis = await performContentTypeAnalysis(baseParams);
              console.log("Step 2: Converting Text to JSON and Generating Recommendation...");
              result = await generateAnalysisJsonFromText({
                  ...baseParams,
                  analysisType: 'contentType',
                  analysisText: textAnalysis.analysisText,
              });
          } else if (type === 'UserIntent') {
               if (!relatedKeywordsRaw) {
                  throw new Error("Related keywords string is missing for User Intent analysis.");
              }
              console.log("Step 1: Generating User Intent Text Analysis...");
               const textAnalysis = await performUserIntentAnalysis({
                  ...baseParams,
                  relatedKeywordsRaw: relatedKeywordsRaw
              });
              console.log("Step 2: Converting Text to JSON and Generating Recommendation...");
              result = await generateAnalysisJsonFromText({
                  ...baseParams,
                  analysisType: 'userIntent',
                  analysisText: textAnalysis.analysisText,
              });
          } else if (type === 'Title') {
              console.log("Performing Title Analysis and Recommendation...");
              result = await performSerpTitleAnalysis(baseParams);
          } else if (type === 'BetterHave') {
                console.log("Performing 'Better Have In Article' Analysis...");
                result = await performBetterHaveInArticleAnalysis({
                    ...baseParams,
                    paaString: paaString,
                    relatedQueriesString: relatedKeywordsRaw,
                    aiOverviewString: aiOverviewString
                });
          }

          setAnalysisResult({ ...result, type });

      } catch (err: any) {
          setAnalysisError(err.message || `An unknown error occurred during ${type} analysis.`);
          setAnalysisResult({ type: type });
      } finally {
          const endTime = performance.now();
          setAnalysisExecutionTime(endTime - startTime);
          setIsLoadingAnalysis(false);
      }
  };


  // --- Render ---

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">SERP Action Tester</h1>

      {/* Inputs and Fetch */}
      <Card>
        <CardHeader>
          <CardTitle>1. Fetch SERP Data</CardTitle>
          <CardDescription>Enter query parameters and fetch the corresponding SERP data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="query">Query:</Label>
                <Input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g., best seo tools" disabled={isLoadingSerp} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region (e.g., us):</Label>
                <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="us" disabled={isLoadingSerp} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language (e.g., en):</Label>
                <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="en" disabled={isLoadingSerp} />
              </div>
          </div>
          <Button onClick={handleFetchSerp} disabled={isLoadingSerp || isLoadingAnalysis}>
            {isLoadingSerp ? 'Fetching...' : 'Fetch SERP Data'}
          </Button>
          {serpError && (
             <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Fetch Error</AlertTitle>
                <AlertDescription>{serpError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

       {/* Display SERP Data Skeleton or Actual Data */}
       {isLoadingSerp && (
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-4 w-1/4 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        )}

      {serpData && !isLoadingSerp && (
        <Card>
          <CardHeader>
             <CardTitle>2. Fetched SERP Data</CardTitle>
             <CardDescription>ID: {serpData.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {/* Raw SERP Data */}
             <div>
                 <h3 className="text-lg font-semibold mb-2">Raw Data:</h3>
                 <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                    {JSON.stringify(serpData, null, 2)}
                 </pre>
             </div>
             {/* Formatted Organic Results */}
             <div>
                <h3 className="text-lg font-semibold mb-2">Formatted Organic Results (Top 15 for Prompts):</h3>
                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                    {serpString}
                </pre>
             </div>
              {/* Formatted Related Keywords */}
             <div>
                <h3 className="text-lg font-semibold mb-2">Formatted Related Keywords (for Prompts):</h3>
                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                    {relatedKeywordsRaw}
                </pre>
             </div>
             {/* --- NEW: Display PAA and AI Overview Strings --- */}
             <div>
                <h3 className="text-lg font-semibold mb-2">Formatted PAA (for Prompts):</h3>
                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                    {paaString}
                </pre>
             </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Formatted AI Overview (for Prompts):</h3>
                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                    {aiOverviewString}
                </pre>
             </div>
             {/* --- END NEW --- */}
          </CardContent>
        </Card>
      )}

      {/* Analysis Triggers and Results */}
      {serpData && !isLoadingSerp && (
         <Card>
            <CardHeader>
                <CardTitle>3. Perform Analysis</CardTitle>
                <CardDescription>Analyze the fetched SERP data (using top 15 results).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => handleAnalysis('ContentType')}
                        disabled={isLoadingAnalysis || isLoadingSerp}
                        variant={currentAnalysisType === 'ContentType' && isLoadingAnalysis ? "secondary" : "default"}
                    >
                        {isLoadingAnalysis && currentAnalysisType === 'ContentType' ? 'Analyzing...' : 'Analyze Content Type'}
                    </Button>
                    <Button
                        onClick={() => handleAnalysis('UserIntent')}
                        disabled={isLoadingAnalysis || isLoadingSerp}
                        variant={currentAnalysisType === 'UserIntent' && isLoadingAnalysis ? "secondary" : "default"}
                    >
                        {isLoadingAnalysis && currentAnalysisType === 'UserIntent' ? 'Analyzing...' : 'Analyze User Intent'}
                    </Button>
                    <Button
                        onClick={() => handleAnalysis('Title')}
                        disabled={isLoadingAnalysis || isLoadingSerp}
                        variant={currentAnalysisType === 'Title' && isLoadingAnalysis ? "secondary" : "default"}
                    >
                        {isLoadingAnalysis && currentAnalysisType === 'Title' ? 'Analyzing...' : 'Analyze Title'}
                    </Button>
                    <Button
                        onClick={() => handleAnalysis('BetterHave')}
                        disabled={isLoadingAnalysis || isLoadingSerp}
                        variant={currentAnalysisType === 'BetterHave' && isLoadingAnalysis ? "secondary" : "default"}
                    >
                        {isLoadingAnalysis && currentAnalysisType === 'BetterHave' ? 'Analyzing...' : 'Analyze Better Have'}
                    </Button>
                </div>

                {/* Loading state for analysis */}
                {isLoadingAnalysis && (
                     <div className="space-y-3 pt-4">
                         <Skeleton className="h-5 w-1/4" />
                         <Skeleton className="h-10 w-full" />
                         <Skeleton className="h-5 w-1/4" />
                         <Skeleton className="h-40 w-full" />
                     </div>
                )}

                {analysisExecutionTime !== null && !isLoadingAnalysis && (
                    <p className="text-sm text-muted-foreground pt-2">
                        Analysis completed in: {(analysisExecutionTime / 1000).toFixed(2)} seconds
                    </p>
                )}

                {analysisError && !isLoadingAnalysis &&(
                     <Alert variant="destructive" className="mt-4">
                        <Terminal className="h-4 w-4" />
                        <AlertTitle>Analysis Error ({analysisResult.type || currentAnalysisType})</AlertTitle>
                        <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                )}

                {analysisResult.type && !analysisError && !isLoadingAnalysis && (
                    <div className="pt-4 space-y-4">
                        <h3 className="text-xl font-semibold">{analysisResult.type} Analysis Result:</h3>

                        {/* Display Recommendation Text (Common for all types now) */}
                        {analysisResult.recommendationText && (
                            <div>
                                <h4 className="text-lg font-semibold mb-2">Recommendation:</h4>
                                <pre className={`text-sm p-3 border rounded-md overflow-x-auto ${analysisResult.type === 'BetterHave' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                    {analysisResult.recommendationText}
                                </pre>
                            </div>
                        )}

                        {/* Display JSON (Common for all types now) */}
                        {analysisResult.analysisJson && (
                             <div>
                                <h4 className="text-lg font-semibold mb-2">Analysis JSON:</h4>
                                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                                    {JSON.stringify(analysisResult.analysisJson, null, 2)}
                                </pre>
                             </div>
                        )}

                        {/* Optional: Display raw text if needed (e.g., for debugging BetterHave) */}
                        {/* {analysisResult.type === 'BetterHave' && analysisResult.analysisText && (
                            <div>
                                <h4 className="text-lg font-semibold mb-2">Raw Analysis Text:</h4>
                                <pre className="text-xs p-3 bg-gray-100 border rounded-md overflow-x-auto max-h-60">
                                    {analysisResult.analysisText}
                                </pre>
                            </div>
                        )} */}
                    </div>
                )}
            </CardContent>
         </Card>
      )}
    </div>
  );
}