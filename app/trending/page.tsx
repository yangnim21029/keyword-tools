import { submitCheckKeywordTrend } from "@/app/actions/actions-trending";
import { Suspense } from "react";
import { TrendAnalysisForm, ClientTrendResult } from "./trend-form-display"; // Import the new client component and its types

// Main Page Server Component
interface TrendingPageProps {
  searchParams: Promise<{
    keyword?: string;
    region?: string;
    language?: string;
  }>;
}

export default async function TrendingPage({
  searchParams,
}: TrendingPageProps) {
  let initialAnalysisResultServer: ClientTrendResult | null = null;
  const { keyword, region, language } = await searchParams;

  if (keyword && region && language) {
    try {
      // Call the server action directly for initial server-side rendering
      const serverActionResponse = await submitCheckKeywordTrend({
        keyword: keyword,
        region: region,
        language: language,
      });
      // The serverActionResponse should already be compatible with ClientTrendResult
      initialAnalysisResultServer = serverActionResponse;

      // If the action failed, log it but still pass the error structure to the form
      if (!serverActionResponse.success) {
        console.error(
          "Initial trend analysis via action failed:",
          serverActionResponse.error
        );
      }
    } catch (e) {
      // This catch block might be redundant if submitCheckKeywordTrend handles its own errors gracefully,
      // but kept for safety for direct errors during the action call itself (e.g. if action throws before returning structured error)
      console.error("Error invoking submitCheckKeywordTrend on server:", e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Unknown server error during initial trend action call";
      initialAnalysisResultServer = {
        success: false,
        message: `Error fetching initial data: ${errorMessage}`,
        error: errorMessage,
        isTrending: false,
        isDeclining: false,
        isStable: true,
        confidence: "Error",
        slope: 0,
        pValue: 1,
        monthlyData: [],
        averageVolume: null,
        medianVolume: null,
        minVolume: null,
        maxVolume: null,
        stdDeviation: null,
        processedDataPoints: 0,
      };
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Keyword Trend Analysis
        </h1>
        <p className="text-muted-foreground">
          Enter a keyword, select a region and language, then click "Check
          Trend" to see its search volume trend over the last 12 months.
        </p>
      </header>

      <TrendAnalysisForm
        initialKeyword={keyword}
        initialRegion={region}
        initialLanguage={language}
        initialResult={initialAnalysisResultServer} // Pass the result from the action
      />

      {/* 
        Suspense might be useful if TrendAnalysisForm itself was loading data 
        or if there were other async server components on this page.
        For this setup, the primary loading state is handled within TrendAnalysisForm.
      */}
      <Suspense
        fallback={<div className="mt-6">Loading supporting components...</div>}
      ></Suspense>
    </div>
  );
}
