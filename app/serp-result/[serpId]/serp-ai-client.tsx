"use client";

import {
  AnalyzeBetterHaveButton,
  AnalyzeContentTypeButton,
  AnalyzeTitleButton,
  AnalyzeUserIntentButton,
} from "@/app/actions/actions-buttons"; // Import action buttons
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FirebaseSerpResultObject } from "@/app/services/firebase/schema";

// --- Define a minimal client-safe type for AI Overview ---
type ClientAiOverview = {
  content?: string | null;
  // Include other fields like type or sources if needed by the client
};

// --- Client-safe SERP data type (Matches definition in use-serp-ai.tsx) ---
type ClientSafeSerpData = {
  id: string;
  originalKeyword: string;
  region?: string | null;
  language?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  organicResults?: FirebaseSerpResultObject["organicResults"];
  relatedQueries?: any[] | null;
  peopleAlsoAsk?: FirebaseSerpResultObject["peopleAlsoAsk"];
  aiOverview?: ClientAiOverview | null;
  contentTypeAnalysisText?: string | null;
  userIntentAnalysisText?: string | null;
  betterHaveAnalysisText?: string | null;
  // Add other fields from FirebaseSerpResultObject if needed client-side

  // Recommendation texts
  contentTypeRecommendationText?: string | null;
  userIntentRecommendationText?: string | null;
  // titleRecommendationText is accessed via titleAnalysis.recommendationText
  betterHaveRecommendationText?: string | null;
  titleAnalysisText?: string | null;
  titleRecommendationText?: string | null;
};

// --- Helper Functions (Copied from use-serp-ai.tsx) ---

function formatSerpResults(organicResults: any[] | undefined | null): string {
  if (!Array.isArray(organicResults) || organicResults.length === 0) {
    return "No organic results found.";
  }
  return organicResults
    .map(
      (result, index) =>
        `Position ${result.position || index + 1}:\nTitle: ${
          result.title
        }\nDescription: ${result.description}\nURL: ${result.url}\n---`,
    )
    .join("\n\n");
}

function formatRelatedKeywords(
  relatedQueries: any[] | undefined | null,
): string {
  if (!Array.isArray(relatedQueries) || relatedQueries.length === 0) {
    return "No related keywords found.";
  }
  return relatedQueries
    .map((q) => `${q.query || q.title}, ?`) // Use title if query is missing (API schema difference)
    .join("\n");
}

function formatPAA(peopleAlsoAsk: any[] | undefined | null): string {
  if (!Array.isArray(peopleAlsoAsk) || peopleAlsoAsk.length === 0) {
    return "No People Also Ask data found.";
  }
  return peopleAlsoAsk
    .map(
      (paa) =>
        `- ${paa.question}${
          paa.answer
            ? `\n  Answer Snippet: ${paa.answer.substring(0, 100)}...`
            : ""
        }`,
    )
    .join("\n");
}

function formatAIOverview(
  aiOverview: ClientAiOverview | undefined | null,
): string {
  const content = aiOverview?.content;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return "No AI Overview data found.";
  }
  return content.substring(0, 1000) + (content.length > 1000 ? "..." : "");
}

// --- Component Props ---
interface SerpAiDisplayProps {
  initialSerpData: ClientSafeSerpData | null;
  serpId: string;
}

// --- Client Component ---
export default function SerpAiDisplay({
  initialSerpData,
  serpId,
}: SerpAiDisplayProps) {
  // Initialize router
  const router = useRouter();

  // SERP Data State - Initialized directly from props
  const [serpData, setSerpData] = useState<ClientSafeSerpData | null>(
    initialSerpData,
  );
  // Pre-formatted strings for display/prompts - Initialized directly from props
  const [serpString, setSerpString] = useState<string>(
    formatSerpResults(initialSerpData?.organicResults?.slice(0, 15)),
  );
  const [relatedKeywordsRaw, setRelatedKeywordsRaw] = useState<string>(
    formatRelatedKeywords(initialSerpData?.relatedQueries),
  );
  const [paaString, setPaaString] = useState<string>(
    formatPAA(initialSerpData?.peopleAlsoAsk),
  );
  const [aiOverviewString, setAiOverviewString] = useState<string>(
    formatAIOverview(initialSerpData?.aiOverview),
  );

  // Effect to update state if initialSerpData changes (e.g., after parent refresh)
  useEffect(() => {
    setSerpData(initialSerpData);
    setSerpString(
      formatSerpResults(initialSerpData?.organicResults?.slice(0, 15)),
    );
    setRelatedKeywordsRaw(
      formatRelatedKeywords(initialSerpData?.relatedQueries),
    );
    setPaaString(formatPAA(initialSerpData?.peopleAlsoAsk));
    setAiOverviewString(formatAIOverview(initialSerpData?.aiOverview));
  }, [initialSerpData]);

  // --- Render ---

  // Determine if analysis buttons should be disabled
  const isAnalysisDisabled = !serpData || !serpData.id;

  return (
    <div className="space-y-6">
      {/* Display SERP Data */}
      {serpData && (
        <Card>
          <CardHeader>
            <CardTitle>SERP Data</CardTitle>
            <CardDescription>ID: {serpData.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Raw SERP Data */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Raw Data (Client):</h3>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                {JSON.stringify(serpData, null, 2)}
              </pre>
            </div>
            {/* Formatted Organic Results */}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Formatted Organic Results (Top 15 for Prompts):
              </h3>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                {serpString}
              </pre>
            </div>
            {/* Formatted Related Keywords */}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Formatted Related Keywords (for Prompts):
              </h3>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                {relatedKeywordsRaw}
              </pre>
            </div>
            {/* Formatted PAA */}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Formatted PAA (for Prompts):
              </h3>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                {paaString}
              </pre>
            </div>
            {/* Formatted AI Overview */}
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Formatted AI Overview (for Prompts):
              </h3>
              <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-60">
                {aiOverviewString}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Triggers */}
      {serpData && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Actions</CardTitle>
            <CardDescription>
              Trigger analysis actions for the fetched SERP data (ID:{" "}
              {serpData.id}). Results and status will be shown via
              notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {/* Use Action Buttons here */}
              <AnalyzeContentTypeButton
                docId={serpData.id}
                disabled={isAnalysisDisabled}
                variant="default"
              />
              <AnalyzeUserIntentButton
                docId={serpData.id}
                disabled={isAnalysisDisabled}
                variant="default"
              />
              <AnalyzeTitleButton
                docId={serpData.id}
                disabled={isAnalysisDisabled}
                variant="default"
              />
              <AnalyzeBetterHaveButton
                docId={serpData.id}
                disabled={isAnalysisDisabled}
                variant="default"
              />
            </div>
            {/* Displaying analysis results directly might require more complex state
                or reading data refreshed by page revalidation.
                Keeping it simple for now by relying on toasts from action buttons. */}
          </CardContent>
        </Card>
      )}

      {/* Analysis Results Display */}
      {serpData && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
            <CardDescription>
              Generated analysis for the SERP data (ID: {serpData.id}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Content Type Analysis */}
            {serpData.contentTypeAnalysisText ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Content Type Analysis
                </h3>
                <pre className="text-sm p-3 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap">
                  {serpData.contentTypeAnalysisText}
                </pre>
                {/* Display Recommendation */}
                {serpData.contentTypeRecommendationText && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-md font-semibold mb-1">
                      Recommendation:
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {serpData.contentTypeRecommendationText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Content Type Analysis
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analysis not available yet.
                </p>
              </div>
            )}

            {/* User Intent Analysis */}
            {serpData.userIntentAnalysisText ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  User Intent Analysis
                </h3>
                <pre className="text-sm p-3 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap">
                  {serpData.userIntentAnalysisText}
                </pre>
                {/* Display Recommendation */}
                {serpData.userIntentRecommendationText && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-md font-semibold mb-1">
                      Recommendation:
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {serpData.userIntentRecommendationText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  User Intent Analysis
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analysis not available yet.
                </p>
              </div>
            )}

            {/* Title Analysis */}
            {serpData.titleAnalysisText ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">Title Analysis</h3>
                {/* Display formatted title suggestions or raw JSON */}
                <pre className="text-xs p-3 bg-muted rounded-md overflow-x-auto max-h-96">
                  {serpData.titleAnalysisText}
                </pre>
                {/* Display Recommendation from the separate top-level field */}
                {serpData.titleRecommendationText && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-md font-semibold mb-1">
                      Recommendation:
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {serpData.titleRecommendationText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">Title Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Analysis not available yet.
                </p>
              </div>
            )}

            {/* Better Have Analysis */}
            {serpData.betterHaveAnalysisText ? (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Better Have Analysis
                </h3>
                {/* Display text or formatted JSON */}
                <pre className="text-sm p-3 bg-muted rounded-md overflow-x-auto whitespace-pre-wrap">
                  {serpData.betterHaveAnalysisText}
                </pre>
                {/* Display Recommendation */}
                {serpData.betterHaveRecommendationText && (
                  <div className="mt-3 pt-3 border-t">
                    <h4 className="text-md font-semibold mb-1">
                      Recommendation:
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {serpData.betterHaveRecommendationText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Better Have Analysis
                </h3>
                <p className="text-sm text-muted-foreground">
                  Analysis not available yet.
                </p>
              </div>
            )}

            {/* Message if no analysis data is present at all */}
            {!serpData.contentTypeAnalysisText &&
              !serpData.userIntentAnalysisText &&
              !serpData.titleAnalysisText &&
              !serpData.betterHaveAnalysisText && (
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>No Analysis Found</AlertTitle>
                  <AlertDescription>
                    No analysis results are currently available for this SERP.
                    Use the buttons in the 'Analysis Actions' section to
                    generate them.
                  </AlertDescription>
                </Alert>
              )}
          </CardContent>
        </Card>
      )}

      {/* Display message if no SERP data exists */}
      {!serpData && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>No SERP Data</AlertTitle>
          <AlertDescription>
            Initial SERP data could not be loaded for ID: {serpId}. Please check
            the ID or try fetching data using the form above (once implemented
            in the parent component).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
