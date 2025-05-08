import { z } from "zod";
import {
  GscKeywordMetricsSchema,
  type GscKeywordMetrics,
} from "./firebase/schema"; // Adjusted path

const GSC_API_URL =
  "https://gsc-weekly-analyzer-241331030537.asia-east2.run.app/analyze/keywords_for_url";

interface FetchGscKeywordsError {
  error: string;
  details?: unknown;
}

export async function fetchGscKeywordsForUrl(
  targetUrl: string,
  minImpressions: number = 0
): Promise<GscKeywordMetrics[] | FetchGscKeywordsError> {
  try {
    const response = await fetch(GSC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        target_url: targetUrl,
        min_impressions: minImpressions,
      }),
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch (e) {
        errorDetails = await response.text();
      }
      console.error(
        `GSC API request failed for URL: ${targetUrl} with status: ${response.status}`,
        errorDetails
      );
      return {
        error: `GSC API request failed with status ${response.status}`,
        details: errorDetails,
      };
    }

    const data = await response.json();

    const validationResult = z.array(GscKeywordMetricsSchema).safeParse(data);

    if (!validationResult.success) {
      console.error(
        `GSC API response validation failed for URL: ${targetUrl}`,
        validationResult.error.issues
      );
      return {
        error: "GSC API response validation failed.",
        details: validationResult.error.format(),
      };
    }

    return validationResult.data;
  } catch (error) {
    console.error(`Error fetching GSC keywords for URL ${targetUrl}:`, error);
    return {
      error: "An unexpected error occurred while fetching GSC keywords.",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatGscKeywordsForDisplay(
  keywords: GscKeywordMetrics[],
  limit: number = 5 // Option to limit how many keywords are in the summary
): string {
  if (!keywords || keywords.length === 0) {
    return "No GSC keyword data available.";
  }

  const topKeywords = keywords.slice(0, limit);

  let summary = "GSC Keywords (Top 5 +/-):";
  if (keywords.length === 0) summary = "GSC Keywords: (None found)";

  for (const kw of topKeywords) {
    summary += `\n- "${kw.keyword}" (Pos: ${kw.mean_position.toFixed(
      1
    )}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks}, CTR: ${kw.overall_ctr.toFixed(1)}%)`;
  }
  if (keywords.length > limit) {
    summary += `\n... and ${keywords.length - limit} more.`;
  }
  return summary;
}
