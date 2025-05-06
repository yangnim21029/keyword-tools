"use server";

import { getSerpResultById } from "@/app/services/firebase/data-serp-result";
import { NextPageProps } from "@/app/types";
import { notFound } from "next/navigation";
import SerpAiDisplay from "./serp-ai-client"; // Import the new client component

// Helper function to safely stringify/parse to convert complex server objects (like Timestamps) to client-safe JSON
// Adjust this based on the actual structure of FirebaseSerpResultObject and ClientSafeSerpData
function makeSerpDataClientSafe(serverData: any): any {
  if (!serverData) return null;
  try {
    // Convert specific fields if necessary (e.g., Timestamps to ISO strings)
    const data = { ...serverData };
    if (data.createdAt && typeof data.createdAt.toDate === "function") {
      data.createdAt = data.createdAt.toDate().toISOString();
    }
    if (data.updatedAt && typeof data.updatedAt.toDate === "function") {
      data.updatedAt = data.updatedAt.toDate().toISOString();
    }
    // Add any other necessary conversions here
    // Ensure the structure matches ClientSafeSerpData defined in serp-ai-client.tsx

    // Include text fields if they exist
    if (data.contentTypeRecommendationText) {
      data.contentTypeRecommendationText = data.contentTypeRecommendationText;
    }
    if (data.contentTypeAnalysisText) {
      data.contentTypeAnalysisText = data.contentTypeAnalysisText;
    }
    if (data.userIntentRecommendationText) {
      data.userIntentRecommendationText = data.userIntentRecommendationText;
    }
    if (data.userIntentAnalysisText) {
      data.userIntentAnalysisText = data.userIntentAnalysisText;
    }
    if (data.betterHaveRecommendationText) {
      data.betterHaveRecommendationText = data.betterHaveRecommendationText;
    }
    if (data.betterHaveAnalysisText) {
      data.betterHaveAnalysisText = data.betterHaveAnalysisText;
    }
    if (data.titleAnalysisText) {
      data.titleAnalysisText = data.titleAnalysisText;
    }
    if (data.titleRecommendationText) {
      data.titleRecommendationText = data.titleRecommendationText;
    }

    return JSON.parse(JSON.stringify(data)); // Simple deep clone for safety
  } catch (error) {
    console.error("Error making SERP data client-safe:", error);
    return null; // Return null if conversion fails
  }
}

export default async function SerpResultPage({ params }: NextPageProps) {
  // Safely access serpId from params
  const serpId = (await params)?.serpId;

  if (!serpId) {
    notFound();
  }

  // Fetch initial data on the server
  const serpDataResult = await getSerpResultById(serpId);
  // TODO: Implement and use getTotalAnalyzedSerpsCount() when available

  // Prepare data for the client component
  const initialClientSerpData = makeSerpDataClientSafe(serpDataResult);

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">
        SERP Analysis:{" "}
        {initialClientSerpData?.originalKeyword
          ? `"${initialClientSerpData.originalKeyword}"`
          : `ID ${serpId}`}
      </h1>

      {/* Render the client component with initial data */}
      <SerpAiDisplay
        initialSerpData={initialClientSerpData}
        serpId={serpId} // Pass the validated string ID
      />
    </div>
  );
}
