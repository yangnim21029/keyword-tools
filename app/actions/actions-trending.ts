"use server";

import {
  fetchKeywordIdeasWithRetry,
  getRelatedKeywordIdeas,
  LANGUAGE_CODES,
  LOCATION_CODES,
  DEVELOPER_TOKEN,
  CLIENT_ID,
} from "@/app/services/keyword-idea-api.service";

// Interface for the parameters received by the action
interface CheckKeywordTrendParams {
  keyword: string;
  region: string;
  language: string;
}

// This interface defines the comprehensive result of a trend analysis.
// It's used internally by analyzeMonthlyTrend and as the core data part of ActionTrendAnalysisResult.
interface TrendAnalysisData {
  isTrending: boolean;
  isDeclining: boolean;
  isStable: boolean;
  confidence: string;
  slope: number;
  pValue: number | string; // pValue from analyzeMonthlyTrend can be number or string like "<0.01"
  message: string;
  monthlyData: { month: string; year: string; volume: number | null }[];
  averageVolume: number | null;
  medianVolume: number | null;
  minVolume: number | null;
  maxVolume: number | null;
  stdDeviation: number | null;
  processedDataPoints: number;
}

// Interface for the result returned by this server action.
// It should align with what getKeywordTrendAnalysis returns, plus success/error fields.
// This should also match ClientTrendResult in trend-form-display.tsx for consistency.
interface ActionTrendAnalysisResult extends TrendAnalysisData {
  success: boolean;
  error?: string;
}

/**
 * Performs simple linear regression and significance testing.
 * (Moved from keyword-idea-api.service.ts)
 */
function analyzeMonthlyTrendInternal(
  monthlySearchData: (number | null)[]
): Omit<TrendAnalysisData, "monthlyData" | "message"> {
  // monthlyData and message are context-dependent
  const Y_numeric = monthlySearchData
    .map((vol) => (vol === null || isNaN(Number(vol)) ? NaN : Number(vol)))
    .filter((vol) => !isNaN(vol));

  const N_processed = Y_numeric.length;
  let averageVolume: number | null = null,
    medianVolume: number | null = null;
  let minVolume: number | null = null,
    maxVolume: number | null = null,
    stdDeviation: number | null = null;

  if (N_processed > 0) {
    Y_numeric.sort((a, b) => a - b);
    minVolume = Y_numeric[0];
    maxVolume = Y_numeric[N_processed - 1];
    averageVolume = Y_numeric.reduce((sum, val) => sum + val, 0) / N_processed;
    const mid = Math.floor(N_processed / 2);
    medianVolume =
      N_processed % 2 !== 0
        ? Y_numeric[mid]
        : (Y_numeric[mid - 1] + Y_numeric[mid]) / 2;
    const variance =
      Y_numeric.reduce(
        (sumSqDiff, val) =>
          sumSqDiff + Math.pow(val - (averageVolume as number), 2),
        0
      ) / N_processed;
    stdDeviation = Math.sqrt(variance);
  }

  const Y_for_regression = monthlySearchData
    .map((vol, index) => ({ x: index, y: vol === null ? NaN : Number(vol) }))
    .filter((point) => !isNaN(point.y));
  const N_regression = Y_for_regression.length;

  if (N_regression < 3) {
    return {
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "N/A (Insufficient data for trend)",
      slope: 0,
      pValue: 1,
      averageVolume,
      medianVolume,
      minVolume,
      maxVolume,
      stdDeviation,
      processedDataPoints: N_processed,
    };
  }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (const point of Y_for_regression) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const denominator = N_regression * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    return {
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "N/A (Denominator zero in regression)",
      slope: 0,
      pValue: 1,
      averageVolume,
      medianVolume,
      minVolume,
      maxVolume,
      stdDeviation,
      processedDataPoints: N_processed,
    };
  }
  const slope = (N_regression * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / N_regression;
  let ssRes = 0;
  for (const point of Y_for_regression) {
    ssRes += Math.pow(point.y - (slope * point.x + intercept), 2);
  }
  const dfResidual = N_regression - 2;
  if (dfResidual <= 0) {
    return {
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "N/A (Not enough DF for trend)",
      slope,
      pValue: 1,
      averageVolume,
      medianVolume,
      minVolume,
      maxVolume,
      stdDeviation,
      processedDataPoints: N_processed,
    };
  }
  const mse = ssRes / dfResidual;
  const sVarX = sumX2 - (sumX * sumX) / N_regression;
  if (Math.abs(sVarX) < 1e-9) {
    return {
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "N/A (sVarX zero in regression)",
      slope,
      pValue: 1,
      averageVolume,
      medianVolume,
      minVolume,
      maxVolume,
      stdDeviation,
      processedDataPoints: N_processed,
    };
  }
  const seSlope = Math.sqrt(mse / sVarX);
  if (Math.abs(seSlope) < 1e-9) {
    const pVal = Math.abs(slope) > 1e-9 ? 0 : 1;
    return {
      isTrending: slope > 1e-9 && pVal < 0.01,
      isDeclining: slope < -1e-9 && pVal < 0.01,
      isStable: Math.abs(slope) <= 1e-9 || pVal >= 0.01,
      confidence: pVal < 0.01 ? "99% confident" : "Not significant at 99%",
      slope,
      pValue: pVal,
      averageVolume,
      medianVolume,
      minVolume,
      maxVolume,
      stdDeviation,
      processedDataPoints: N_processed,
    };
  }
  const tStatistic = slope / seSlope;
  let criticalT = 3.169; // N=12 (df=10)
  // Simplified critical T lookup
  if (N_regression === 3) criticalT = 63.657;
  else if (N_regression === 4) criticalT = 9.925;
  else if (N_regression === 5) criticalT = 5.841;
  else if (N_regression === 6) criticalT = 4.604;
  else if (N_regression === 7) criticalT = 4.032;
  else if (N_regression === 8) criticalT = 3.707;
  else if (N_regression === 9) criticalT = 3.499;
  else if (N_regression === 10) criticalT = 3.355;
  else if (N_regression === 11) criticalT = 3.25;
  const pValueSimulated = Math.abs(tStatistic) > criticalT ? 0.005 : 0.5;
  const significant = pValueSimulated < 0.01;
  return {
    isTrending: significant && slope > 0,
    isDeclining: significant && slope < 0,
    isStable: !significant || Math.abs(slope) < 1e-6,
    confidence: significant ? "99% confident" : "Not significant at 99%",
    slope,
    pValue: pValueSimulated,
    averageVolume,
    medianVolume,
    minVolume,
    maxVolume,
    stdDeviation,
    processedDataPoints: N_processed,
  };
}

export async function submitCheckKeywordTrend(
  params: CheckKeywordTrendParams
): Promise<ActionTrendAnalysisResult> {
  const { keyword, region, language } = params;
  console.log(
    `[ActionTrending] submitCheckKeywordTrend called with: ${JSON.stringify(params)}`
  );

  // Parameter Validation (moved from service's getKeywordTrendAnalysis)
  const apiLanguageCode = language.replace("-", "_");
  const languageId = LANGUAGE_CODES[apiLanguageCode];
  if (!languageId) throw new Error(`Invalid language code: ${language}`);

  const regionCode = region.toUpperCase();
  const locationId = LOCATION_CODES[regionCode];
  if (!locationId) throw new Error(`Invalid region code: ${region}.`);

  // Basic check for API credentials presence (can be enhanced)
  if (!DEVELOPER_TOKEN || !CLIENT_ID) {
    console.error(
      "[ActionTrending] Missing Google Ads API credentials configuration."
    );
    throw new Error("Missing Google Ads API credentials.");
  }

  try {
    // Fetch data using the service function
    const response = await fetchKeywordIdeasWithRetry({
      batchKeywords: [keyword],
      locationId,
      languageId,
      fetchHistoricalMetrics: true,
    });

    const idea = response.results && response.results[0];
    const historicalMetrics = idea?.keywordIdeaMetrics?.monthlySearchVolumes;

    const defaultErrorResultForAction = (
      msg: string,
      data: any[] = [],
      pDP: number = 0
    ): TrendAnalysisData => ({
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "N/A",
      slope: 0,
      pValue: 1,
      message: msg,
      monthlyData: data,
      averageVolume: null,
      medianVolume: null,
      minVolume: null,
      maxVolume: null,
      stdDeviation: null,
      processedDataPoints: pDP,
    });

    if (!historicalMetrics || historicalMetrics.length === 0) {
      const resultData = defaultErrorResultForAction(
        "No historical search volume data found for this keyword."
      );
      return { success: true, ...resultData }; // Still success: true, but with a message
    }

    const sortedMetrics = [...historicalMetrics].sort((a, b) => {
      if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
      return a.month - b.month;
    });
    const last12Metrics = sortedMetrics.slice(-12);
    const monthlyVolumes: (number | null)[] = last12Metrics.map((m) => {
      if (m.monthlySearches === null || m.monthlySearches === undefined)
        return null;
      const vol = Number(m.monthlySearches);
      return isNaN(vol) ? null : vol;
    });
    const formattedMonthlyData = last12Metrics.map((m, index) => ({
      year: m.year,
      month: m.month.toString(),
      volume: monthlyVolumes[index],
    }));

    // Use the internal trend analysis function
    const trendStats = analyzeMonthlyTrendInternal(monthlyVolumes);
    const {
      processedDataPoints,
      stdDeviation: volStdDev,
      averageVolume: volAvg,
    } = trendStats;

    if (processedDataPoints < 3) {
      const resultData = defaultErrorResultForAction(
        `Insufficient valid historical data points (found ${processedDataPoints}, need at least 3) for trend analysis.`,
        formattedMonthlyData,
        processedDataPoints
      );
      return { success: true, ...resultData }; // Still success: true, with message
    }

    let message = `Trend analysis for "${keyword}": `;
    const slopeDesc = `Slope: ${trendStats.slope.toFixed(2)}`;
    const pValueDisplay =
      typeof trendStats.pValue === "number" && trendStats.pValue === 0.005
        ? "<0.01"
        : typeof trendStats.pValue === "number"
          ? trendStats.pValue.toFixed(3)
          : trendStats.pValue;
    const pValueDesc = `P-value equivalent: ${pValueDisplay}`;
    const confidenceDesc = trendStats.confidence;
    if (trendStats.isTrending) message += `Trending upwards significantly.`;
    else if (trendStats.isDeclining) message += `Declining significantly.`;
    else
      message += `Overall linear trend is stable or not statistically significant at 99% confidence.`;
    message += ` (${slopeDesc}, ${pValueDesc}, ${confidenceDesc}).`;
    if (volStdDev !== null && volAvg !== null && volAvg > 0) {
      const coefficientOfVariation = (volStdDev / volAvg) * 100;
      message += ` Monthly search volume shows ${coefficientOfVariation > 30 ? "high" : coefficientOfVariation > 15 ? "moderate" : "low"} volatility (CV: ${coefficientOfVariation.toFixed(1)}%).`;
    } else if (volStdDev !== null) {
      message += ` Standard deviation of volumes: ${volStdDev.toFixed(1)}.`;
    }

    return {
      success: true,
      ...trendStats,
      message,
      monthlyData: formattedMonthlyData,
    };
  } catch (error: unknown) {
    console.error("[ActionTrending] Error in submitCheckKeywordTrend:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to analyze keyword trend: ${errorMessage}`,
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

// --- New Server Action for Getting Related Keyword Strings ---

interface GetRelatedKeywordsParams {
  seedKeyword: string;
  region: string;
  language: string;
  maxResults?: number;
}

interface RelatedKeywordsResult {
  success: boolean;
  relatedKeywords?: string[];
  error?: string;
  message?: string;
}

export async function submitGetRelatedKeywords(
  params: GetRelatedKeywordsParams
): Promise<RelatedKeywordsResult> {
  console.log(
    `[ActionTrending] submitGetRelatedKeywords called with: ${JSON.stringify(
      params
    )}`
  );
  try {
    const relatedIdeas = await getRelatedKeywordIdeas({
      seedKeywords: [params.seedKeyword],
      region: params.region,
      language: params.language,
      maxResults: params.maxResults || 20, // Default to 20 related keywords
    });

    // Extract just the text from the KeywordVolumeItem[]
    const relatedKeywordStrings = relatedIdeas
      .map((idea) => idea.text)
      .filter(
        (text): text is string =>
          typeof text === "string" &&
          text.trim() !== "" &&
          text.trim().toLowerCase() !== params.seedKeyword.toLowerCase()
      );

    if (relatedKeywordStrings.length === 0) {
      return {
        success: true, // Success, but no distinct related keywords found
        relatedKeywords: [],
        message: "No distinct related keywords found for this seed.",
      };
    }

    return {
      success: true,
      relatedKeywords: [...new Set(relatedKeywordStrings)], // Ensure uniqueness
    };
  } catch (error: unknown) {
    console.error("[ActionTrending] Error in submitGetRelatedKeywords:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to get related keywords: ${errorMessage}`,
      message: `Failed to get related keywords: ${errorMessage}`,
    };
  }
}

// --- New Server Action for Getting a Focused Trend Judgement (for API route use) ---

// Interface for the focused result this new action will return
interface TrendJudgementResult {
  success: boolean;
  keyword?: string;
  isTrending?: boolean;
  isDeclining?: boolean;
  isStable?: boolean;
  confidence?: string;
  slope?: number;
  message?: string; // The summary message from the analysis
  error?: string;
  averageVolume?: number | null;
  stdDeviation?: number | null;
  coefficientOfVariation?: number | null;
}

export async function getTrendJudgement(
  params: CheckKeywordTrendParams // Uses the same input params as submitCheckKeywordTrend
): Promise<TrendJudgementResult> {
  const { keyword } = params; // Destructure for use in error responses
  try {
    // submitCheckKeywordTrend already does the full analysis and includes error handling
    const fullTrendAnalysis = await submitCheckKeywordTrend(params);

    if (!fullTrendAnalysis.success) {
      return {
        success: false,
        keyword,
        error: fullTrendAnalysis.error || "Trend analysis action failed",
        message:
          fullTrendAnalysis.message ||
          "Trend analysis action produced an error.",
      };
    }

    let cv: number | null = null;
    if (
      fullTrendAnalysis.stdDeviation !== null &&
      fullTrendAnalysis.averageVolume !== null &&
      fullTrendAnalysis.averageVolume > 0
    ) {
      cv =
        (fullTrendAnalysis.stdDeviation / fullTrendAnalysis.averageVolume) *
        100;
    }

    // Construct the focused response based on the full analysis
    return {
      success: true,
      keyword,
      isTrending: fullTrendAnalysis.isTrending,
      isDeclining: fullTrendAnalysis.isDeclining,
      isStable: fullTrendAnalysis.isStable,
      confidence: fullTrendAnalysis.confidence,
      slope: fullTrendAnalysis.slope,
      message: fullTrendAnalysis.message, // Pass the rich message
      averageVolume: fullTrendAnalysis.averageVolume,
      stdDeviation: fullTrendAnalysis.stdDeviation,
      coefficientOfVariation: cv,
    };
  } catch (error) {
    // This catch is for unexpected errors if submitCheckKeywordTrend itself throws
    // though submitCheckKeywordTrend is designed to return a structured error.
    console.error(
      "[ActionTrending] Error in getTrendJudgement wrapper:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Internal server error in getTrendJudgement";
    return {
      success: false,
      keyword,
      error: errorMessage,
      message: `Failed to get trend judgement: ${errorMessage}`,
      // Provide default structure for other fields
      isTrending: false,
      isDeclining: false,
      isStable: true,
      confidence: "Error",
      slope: 0,
      averageVolume: null,
      stdDeviation: null,
      coefficientOfVariation: null,
    };
  }
}

// --- New Server Action for Assessing AI Influence on Keyword Trend ---

interface KeywordAiInfluenceResult {
  success: boolean;
  isLikelyAiAffected: boolean;
  judgmentConfidence?: "high" | "medium" | "low" | "none";
  reasoning?: string;
  trendAnalysis?: TrendAnalysisData; // Includes the detailed data from submitCheckKeywordTrend
  error?: string;
  keyword?: string;
}

export async function assessKeywordAiInfluence(
  params: CheckKeywordTrendParams
): Promise<KeywordAiInfluenceResult> {
  const { keyword } = params;
  try {
    const fullTrendAnalysis = await submitCheckKeywordTrend(params);

    if (!fullTrendAnalysis.success) {
      return {
        success: false,
        isLikelyAiAffected: false,
        error: fullTrendAnalysis.error || "Underlying trend analysis failed.",
        reasoning: "Could not assess AI impact due to trend analysis error.",
        keyword,
      };
    }

    // Heuristics for AI influence
    let isLikelyAiAffected = false;
    let judgmentConfidence: KeywordAiInfluenceResult["judgmentConfidence"] =
      "none";
    let reasoning = "Standard trend observed.";

    const {
      isTrending,
      slope,
      stdDeviation,
      averageVolume,
      monthlyData,
      pValue,
    } = fullTrendAnalysis;
    let cv: number | null = null;
    if (stdDeviation !== null && averageVolume !== null && averageVolume > 0) {
      cv = (stdDeviation / averageVolume) * 100;
    }

    const significantTrend =
      pValue === "<0.01" || (typeof pValue === "number" && pValue < 0.01);

    // Criteria for potential AI influence:
    // 1. Significant upward trend with very high slope and high volatility.
    // 2. Significant upward trend with high volatility.
    // 3. Even a stable trend but with extremely high volatility might suggest erratic, AI-driven interest spikes.

    if (isTrending && significantTrend) {
      if (cv !== null && cv > 70 && slope > (averageVolume || 0) * 0.5) {
        // Slope is >50% of avg volume & very high CV
        isLikelyAiAffected = true;
        judgmentConfidence = "high";
        reasoning =
          "Significant upward trend with very high slope and extreme volatility, suggesting strong AI-related influence.";
      } else if (cv !== null && cv > 50) {
        // High CV
        isLikelyAiAffected = true;
        judgmentConfidence = "medium";
        reasoning =
          "Significant upward trend with high volatility, potentially AI-influenced.";
      } else if (slope > (averageVolume || 0) * 0.3) {
        // Moderate to high slope even without extreme CV
        isLikelyAiAffected = true;
        judgmentConfidence = "medium";
        reasoning =
          "Significant upward trend with a strong growth rate, possibly AI-influenced.";
      }
    } else if (fullTrendAnalysis.isStable && cv !== null && cv > 80) {
      // Stable but extremely volatile
      isLikelyAiAffected = true;
      judgmentConfidence = "low";
      reasoning =
        "Overall stable trend but with extreme monthly volatility, which might indicate sporadic AI-driven interest.";
    }

    // If no specific AI-like pattern identified, but it IS trending up significantly, give a low confidence hint.
    if (isTrending && significantTrend && !isLikelyAiAffected) {
      isLikelyAiAffected = true; // Looser criteria if simply trending up strongly
      judgmentConfidence = "low";
      reasoning =
        "Keyword is trending upwards significantly, which could have some AI-related drivers.";
    }

    return {
      success: true,
      isLikelyAiAffected,
      judgmentConfidence,
      reasoning,
      trendAnalysis: fullTrendAnalysis, // Return the full analysis data
      keyword,
    };
  } catch (error) {
    console.error(
      "[ActionTrending] Error in assessKeywordAiInfluence wrapper:",
      error
    );
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Internal server error in assessKeywordAiInfluence";
    return {
      success: false,
      isLikelyAiAffected: false,
      error: errorMessage,
      reasoning: `Failed to assess AI influence: ${errorMessage}`,
      keyword,
    };
  }
}
