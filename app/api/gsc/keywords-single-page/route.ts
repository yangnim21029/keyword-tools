// 後續來做 api
// input url
// output keywords

import { NextRequest, NextResponse } from "next/server";
import {
  fetchGscKeywordsForUrl,
  formatGscKeywordsForDisplay,
} from "@/app/services/gsc-keywords.service"; // Corrected path
import { GscKeywordMetrics } from "@/app/services/firebase/schema"; // For typing

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const gscKeywordsResult = await fetchGscKeywordsForUrl(url, 0); // Assuming min_impressions = 0

    if ("error" in gscKeywordsResult) {
      console.error(
        `Error fetching GSC keywords via API route for ${url}: ${gscKeywordsResult.error}`,
        gscKeywordsResult.details
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch GSC keywords.",
          details: gscKeywordsResult.error,
          url,
        },
        { status: 500 }
      );
    }

    // Successfully fetched
    const rawKeywords: GscKeywordMetrics[] = gscKeywordsResult;
    const formattedSummary = formatGscKeywordsForDisplay(rawKeywords);

    return NextResponse.json({
      success: true,
      data: {
        url,
        keywords: rawKeywords, // Return raw keyword data
        keywordsSummary: formattedSummary, // Return formatted summary
      },
    });
  } catch (error) {
    console.error(
      `Unexpected error in GSC keywords API route for ${url}:`,
      error
    );
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred.",
        url,
      },
      { status: 500 }
    );
  }
}
