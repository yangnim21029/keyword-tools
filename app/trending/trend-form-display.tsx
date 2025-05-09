"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  submitCheckKeywordTrend,
  submitGetRelatedKeywords,
} from "@/app/actions/actions-trending";
import {
  searchKeywordNewsAndEvents,
  NewsEventSnippet,
} from "@/app/actions/actions-ai-trending";
import {
  Loader2,
  TrendingUp,
  Search,
  Newspaper,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

// Type for the analysis result, used by both display and form
export interface TrendAnalysisResultData {
  isTrending: boolean;
  isDeclining: boolean;
  isStable: boolean;
  confidence: string;
  slope: number;
  pValue: number | string;
  message: string;
  monthlyData: { month: string; year: string; volume: number | null }[];
  averageVolume: number | null;
  medianVolume: number | null;
  minVolume: number | null;
  maxVolume: number | null;
  stdDeviation: number | null;
  processedDataPoints: number;
}

// Type for the state and props within the client component, including success/error flags
export interface ClientTrendResult extends TrendAnalysisResultData {
  success: boolean;
  error?: string;
}

// Define a consistent accent color (similar to opportunity page)
const accentColor = "indigo"; // e.g., blue, indigo

const TrendDisplay = ({
  analysisResult,
}: {
  analysisResult: TrendAnalysisResultData | null; // Expects just the data part
}) => {
  if (!analysisResult) {
    return (
      <p className="text-gray-500">
        Enter a keyword, region, and language above and click "Check Trend" to
        see results.
      </p>
    );
  }

  if (
    !analysisResult.message &&
    (!analysisResult.monthlyData || analysisResult.monthlyData.length === 0)
  ) {
    return (
      <p className="text-gray-500">
        No data returned. The API might not have historical data for this
        specific keyword, region, and language combination.
      </p>
    );
  }

  let trendBadgeVariant: "default" | "secondary" | "destructive" | "outline" =
    "secondary";
  let trendText = "Stable / Not Significant";
  let trendBadgeClasses = `bg-gray-100 text-gray-700`; // Default light theme badge

  // Calculate Coefficient of Variation (CV) if possible
  let coefficientOfVariation: number | null = null;
  if (
    analysisResult.stdDeviation !== null &&
    analysisResult.averageVolume !== null &&
    analysisResult.averageVolume > 0
  ) {
    coefficientOfVariation =
      (analysisResult.stdDeviation / analysisResult.averageVolume) * 100;
  }

  if (analysisResult.isTrending) {
    trendBadgeVariant = "default";
    trendText = "Trending Up";
    // Use classes similar to positive badges in opportunity page (e.g., blue or green based)
    trendBadgeClasses = `bg-blue-100 text-blue-700`;
  } else if (analysisResult.isDeclining) {
    trendBadgeVariant = "destructive";
    trendText = "Trending Down";
    trendBadgeClasses = `bg-red-100 text-red-700`;
  } else {
    if (coefficientOfVariation !== null && coefficientOfVariation > 35) {
      trendText = "Stable (High Volatility)";
      trendBadgeVariant = "outline"; // Or a yellow/orange based badge
      trendBadgeClasses = `border-orange-400 text-orange-600 border bg-orange-50`;
    } else {
      trendText = "Stable / Not Significant";
      trendBadgeVariant = "secondary";
      trendBadgeClasses = `bg-gray-100 text-gray-700`;
    }
  }

  const formatNumber = (num: number | null | undefined) =>
    num !== null && num !== undefined ? num.toFixed(0) : "N/A";
  const formatStat = (num: number | null | undefined, precision = 2) =>
    num !== null && num !== undefined ? num.toFixed(precision) : "N/A";

  // SVG Mini Chart Component
  const SvgMiniChart = ({
    data,
  }: {
    data: { month: string; year: string; volume: number | null }[];
  }) => {
    const validData = data.filter((d) => d.volume !== null) as {
      month: string;
      year: string;
      volume: number;
    }[];
    if (validData.length < 2)
      return (
        <p className="text-sm text-gray-500">Not enough data for chart.</p>
      );

    const chartWidth = 300;
    const chartHeight = 100;
    const padding = 20; // Padding for labels/axes

    // Helper to get month abbreviation (MOVED HERE - BEFORE USAGE)
    const getMonthAbbreviation = (monthNumStr: string, yearStr: string) => {
      const monthNum = parseInt(monthNumStr, 10);
      const date = new Date(parseInt(yearStr, 10), monthNum - 1);
      return date.toLocaleString("default", { month: "short" });
    };

    const maxVolume = Math.max(...validData.map((d) => d.volume), 0);
    const minVolume = Math.min(...validData.map((d) => d.volume));

    const getX = (index: number) =>
      padding + (index / (validData.length - 1)) * (chartWidth - 2 * padding);
    const getY = (volume: number) =>
      chartHeight -
      padding -
      ((volume - minVolume) /
        (maxVolume - minVolume === 0 ? 1 : maxVolume - minVolume)) *
        (chartHeight - 2 * padding);

    // Adjust Y for single point or flat line to prevent division by zero and ensure it's centered
    const getYAdjusted = (volume: number) => {
      if (maxVolume === minVolume) {
        return chartHeight / 2; // Center if all values are the same
      }
      return (
        chartHeight -
        padding -
        ((volume - minVolume) / (maxVolume - minVolume)) *
          (chartHeight - 2 * padding)
      );
    };

    const points = validData
      .map((d, i) => `${getX(i)},${getYAdjusted(d.volume)}`)
      .join(" ");

    const yAxisLabelsCount = 3;
    const yAxisValues = [];
    if (maxVolume > minVolume) {
      for (let i = 0; i <= yAxisLabelsCount; i++) {
        yAxisValues.push(
          minVolume + (i / yAxisLabelsCount) * (maxVolume - minVolume)
        );
      }
    } else {
      // Handle case where all volumes are the same or only one point
      yAxisValues.push(minVolume);
      if (maxVolume !== minVolume && validData.length > 1)
        yAxisValues.push(maxVolume); // Add max if different and more than one point
    }

    // X-axis labels - show first, middle, and last month if possible
    const xAxisLabels = [];
    if (validData.length > 0) {
      xAxisLabels.push({
        x: getX(0),
        label: getMonthAbbreviation(validData[0].month, validData[0].year),
      });
    }
    if (validData.length > 2) {
      const midIndex = Math.floor((validData.length - 1) / 2);
      if (midIndex > 0) {
        // ensure mid isn't same as first
        xAxisLabels.push({
          x: getX(midIndex),
          label: getMonthAbbreviation(
            validData[midIndex].month,
            validData[midIndex].year
          ),
        });
      }
    }
    if (validData.length > 1) {
      const lastIndex = validData.length - 1;
      // Ensure last isn't same as mid or first if only 2-3 points
      if (!xAxisLabels.find((l) => l.x === getX(lastIndex))) {
        xAxisLabels.push({
          x: getX(lastIndex),
          label: getMonthAbbreviation(
            validData[lastIndex].month,
            validData[lastIndex].year
          ),
        });
      }
    }

    return (
      <div className="my-4">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width={chartWidth}
          height={chartHeight}
          aria-label="Monthly search volume trend chart"
        >
          {/* Y-axis lines and labels */}
          {yAxisValues.map((val, i) => (
            <g key={`y-axis-${i}`}>
              <line
                x1={padding - 3}
                y1={getYAdjusted(val)}
                x2={chartWidth - padding}
                y2={getYAdjusted(val)}
                stroke="#e5e7eb" // Light gray line (gray-200)
                strokeDasharray="2,2"
              />
              <text
                x={padding - 7}
                y={getYAdjusted(val) + 4}
                fontSize="10"
                fill="#374151" // Darker gray text (gray-700 for better contrast)
                textAnchor="end"
              >
                {Math.round(val)}
              </text>
            </g>
          ))}

          {/* X-axis line (bottom) */}
          <line
            x1={padding}
            y1={chartHeight - padding}
            x2={chartWidth - padding}
            y2={chartHeight - padding}
            stroke="#9ca3af" // Darker gray line for axis (gray-400)
          />
          {/* X-axis labels */}
          {xAxisLabels.map((labelInfo, i) => (
            <text
              key={`x-axis-label-${i}`}
              x={labelInfo.x}
              y={chartHeight - padding + 12} // Position below X-axis line
              fontSize="10"
              fill="#374151" // Darker gray text (gray-700 for better contrast)
              textAnchor="middle"
            >
              {labelInfo.label}
            </text>
          ))}
          {/* Data line */}
          <polyline
            fill="none"
            stroke="#4f46e5" // Direct hex for indigo-600 (example)
            strokeWidth="1.5"
            points={points}
          />
          {/* Data points (circles) - REMOVING THESE TO EMPHASIZE THE LINE */}
          {/* {validData.map((d, i) => (
            <circle
              key={`dot-${i}`}
              cx={getX(i)}
              cy={getYAdjusted(d.volume)}
              r="2"
              fill={`rgb(var(--color-${accentColor}-600))`} // Using the new accentColor
            />
          ))} */}
        </svg>
      </div>
    );
  };

  return (
    <Card className="mt-6 bg-white border-gray-200 text-gray-800 shadow-sm">
      <CardHeader>
        <CardTitle
          className={`flex items-center justify-between text-${accentColor}-700`}
        >
          Trend Analysis Result
          <Badge variant={trendBadgeVariant} className={trendBadgeClasses}>
            {trendText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Integrate SVG Mini Chart */}
        {analysisResult.monthlyData &&
          analysisResult.monthlyData.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-md mb-1 text-gray-700">
                Volume Trend (Simple Chart):
              </h4>
              <SvgMiniChart data={analysisResult.monthlyData} />
            </div>
          )}

        <div className="mb-6 pt-4">
          <h4 className="font-semibold text-md mb-3 text-gray-700">
            Trend Summary Statistics:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-600">
            <div>
              <strong className="text-gray-800">Slope:</strong>{" "}
              {formatStat(analysisResult.slope, 4)}
            </div>
            <div>
              <strong className="text-gray-800">Confidence:</strong>{" "}
              {analysisResult.confidence}
            </div>
            <div>
              <strong className="text-gray-800">P-Value (equiv.):</strong>{" "}
              {analysisResult.pValue}
            </div>
            <div>
              <strong className="text-gray-800">Data Points:</strong>{" "}
              {analysisResult.processedDataPoints}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-md mb-3 text-gray-700">
            Volume Statistics (monthly):
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-600">
            <div>
              <strong className="text-gray-800">Avg. Volume:</strong>{" "}
              {formatNumber(analysisResult.averageVolume)}
            </div>
            <div>
              <strong className="text-gray-800">Median Volume:</strong>{" "}
              {formatNumber(analysisResult.medianVolume)}
            </div>
            <div>
              <strong className="text-gray-800">Min Volume:</strong>{" "}
              {formatNumber(analysisResult.minVolume)}
            </div>
            <div>
              <strong className="text-gray-800">Max Volume:</strong>{" "}
              {formatNumber(analysisResult.maxVolume)}
            </div>
            <div>
              <strong className="text-gray-800">Std. Deviation:</strong>{" "}
              {formatStat(analysisResult.stdDeviation)}
            </div>
          </div>
        </div>

        {analysisResult.monthlyData &&
          analysisResult.monthlyData.length > 0 && (
            <>
              <h4 className="font-semibold text-md mb-3 text-gray-700">
                Monthly Search Volume Data (Last 12 Months):
              </h4>
              <Table className="border-gray-200">
                <TableHeader className="bg-gray-50">
                  <TableRow className="border-gray-200">
                    <TableHead className="text-gray-600">Year</TableHead>
                    <TableHead className="text-gray-600">Month</TableHead>
                    <TableHead className="text-right text-gray-600">
                      Volume
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisResult.monthlyData.map((data, index) => (
                    <TableRow
                      key={index}
                      className="border-gray-200 hover:bg-gray-50"
                    >
                      <TableCell className="text-gray-700">
                        {data.year}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {data.month}
                      </TableCell>
                      <TableCell className="text-right text-gray-700">
                        {data.volume ?? "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-gray-500">
          Trend analysis is based on the last 12 months of available data. Slope
          indicates the rate of change. A P-Value &lt; 0.01 (for 99% confidence)
          suggests the trend is statistically significant. CV (Coefficient of
          Variation) in the message indicates volatility.
        </p>
      </CardFooter>
    </Card>
  );
};

const defaultRegionOptions: Array<{ value: string; label: string }> = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australia" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "IN", label: "India" },
  { value: "CN", label: "China" },
  { value: "TW", label: "Taiwan" },
  { value: "HK", label: "Hong Kong" },
  { value: "SG", label: "Singapore" },
  { value: "MY", label: "Malaysia" },
];

const defaultLanguageOptions: Array<{ value: string; label: string }> = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh_CN", label: "Simplified Chinese" },
  { value: "zh_TW", label: "Traditional Chinese" },
  { value: "ms", label: "Malay" },
];

export function TrendAnalysisForm({
  initialKeyword,
  initialRegion,
  initialLanguage,
  initialResult,
}: {
  initialKeyword?: string;
  initialRegion?: string;
  initialLanguage?: string;
  initialResult: ClientTrendResult | null;
}) {
  const [keyword, setKeyword] = useState(initialKeyword || "");
  const [region, setRegion] = useState(initialRegion || "US");
  const [language, setLanguage] = useState(initialLanguage || "en");
  const [isCheckingTrend, startTrendTransition] = useTransition();
  const [analysisResult, setAnalysisResult] =
    useState<ClientTrendResult | null>(initialResult);

  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [isFetchingRelated, startRelatedTransition] = useTransition();

  // State for news snippets
  const [newsSnippets, setNewsSnippets] = useState<NewsEventSnippet[]>([]);
  const [isLoadingNews, startNewsLoadingTransition] = useTransition();
  const [allFetchedNewsTitles, setAllFetchedNewsTitles] = useState<string[]>(
    []
  );
  const [newsSearchTarget, setNewsSearchTarget] = useState<{
    year: string;
    month: string;
    monthStr: string;
  } | null>(null);
  const newsScrollContainerRef = useRef<HTMLDivElement>(null);

  const regionOptions = defaultRegionOptions;
  const languageOptions = defaultLanguageOptions;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!keyword.trim() || !region || !language) {
      toast.warning(
        "Please fill in all fields: keyword, region, and language."
      );
      return;
    }

    startTrendTransition(async () => {
      toast.info(`Checking trend for keyword: "${keyword}"...`);
      setAnalysisResult(null);
      setRelatedKeywords([]);
      setNewsSnippets([]);
      setAllFetchedNewsTitles([]);
      setNewsSearchTarget(null);
      try {
        const result = await submitCheckKeywordTrend({
          keyword,
          region,
          language,
        });
        setAnalysisResult(result as ClientTrendResult);
        if (result.success) {
          toast.success(
            result.message || `Trend analysis complete for "${keyword}".`
          );
        } else {
          toast.error(
            result.message ||
              `Trend analysis failed for "${keyword}": ${result.error || "Unknown error"}`
          );
        }
      } catch (err) {
        console.error("[TrendAnalysisForm] Error calling action:", err);
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        toast.error(message);
        setAnalysisResult({
          success: false,
          error: message,
          message: message,
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
        });
      }
    });
  };

  const handleFetchRelatedKeywords = () => {
    if (!keyword.trim() || !region || !language) {
      toast.warning(
        "Cannot fetch related keywords without a main keyword, region, and language."
      );
      return;
    }
    startRelatedTransition(async () => {
      toast.info(`Fetching related keywords for "${keyword}"...`);
      setRelatedKeywords([]);
      try {
        const result = await submitGetRelatedKeywords({
          seedKeyword: keyword,
          region,
          language,
        });
        if (result.success && result.relatedKeywords) {
          setRelatedKeywords(result.relatedKeywords);
          if (result.relatedKeywords.length > 0) {
            toast.success(
              `Found ${result.relatedKeywords.length} related keywords.`
            );
          } else {
            toast.info(result.message || "No distinct related keywords found.");
          }
        } else {
          toast.error(result.message || "Failed to fetch related keywords.");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while fetching related keywords.";
        toast.error(message);
      }
    });
  };

  const handleRelatedKeywordClick = (relatedKw: string) => {
    setKeyword(relatedKw);
    setTimeout(() => {
      handleSubmit();
    }, 0);
  };

  // Effect to trigger news search when analysisResult is available
  useEffect(() => {
    if (
      analysisResult &&
      analysisResult.success &&
      analysisResult.monthlyData.length > 0
    ) {
      // Determine target month/year for news search - e.g., month with max volume
      let targetMonthData = analysisResult.monthlyData[0];
      let maxVol = -1;
      let potentialTargets: {
        year: string;
        month: string;
        monthStr: string;
        volume: number;
      }[] = [];

      analysisResult.monthlyData.forEach((d) => {
        if (d.volume !== null && d.volume > maxVol) {
          maxVol = d.volume;
        }
      });
      // Collect all months with volume > 70% of max volume or a decent absolute volume (e.g. > 100)
      // to find a month that has significant activity
      if (maxVol > 0) {
        potentialTargets = analysisResult.monthlyData
          .filter(
            (d) =>
              d.volume !== null && (d.volume > maxVol * 0.7 || d.volume > 100)
          )
          .map((d) => ({
            ...d,
            volume: d.volume as number,
            monthStr: getMonthName(parseInt(d.month, 10)),
          }));
      }

      // Prefer a more recent month among high-activity months if multiple exist
      if (potentialTargets.length > 0) {
        potentialTargets.sort((a, b) => {
          if (a.year !== b.year) return parseInt(b.year) - parseInt(a.year); // Sort by year descending
          return parseInt(b.month) - parseInt(a.month); // Then by month descending
        });
        targetMonthData = potentialTargets[0];
      } else if (
        analysisResult.monthlyData.some(
          (d) => d.volume !== null && d.volume > 0
        )
      ) {
        // Fallback: find first month with any volume if no high activity found
        const firstMonthWithVolume = analysisResult.monthlyData.find(
          (d) => d.volume !== null && d.volume > 0
        );
        if (firstMonthWithVolume) targetMonthData = firstMonthWithVolume;
      }
      // else targetMonthData remains the first month as a last resort if all volumes are null/zero

      const target = {
        year: targetMonthData.year,
        month: targetMonthData.month, // numeric month string e.g. "5"
        monthStr: getMonthName(parseInt(targetMonthData.month, 10)), // e.g. "May"
      };
      setNewsSearchTarget(target);
      fetchNewsForTargetMonth(target, true); // true for initial fetch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult]); // Dependency: analysisResult

  const getMonthName = (monthNumber: number): string => {
    const date = new Date();
    date.setMonth(monthNumber - 1);
    return date.toLocaleString("en-US", { month: "long" });
  };

  const fetchNewsForTargetMonth = (
    target: { year: string; month: string; monthStr: string } | null,
    initialFetch = false
  ) => {
    if (!target || !keyword) return;

    startNewsLoadingTransition(async () => {
      if (initialFetch) {
        setNewsSnippets([]);
        setAllFetchedNewsTitles([]);
      }
      toast.info(
        `Searching news for "${keyword}" around ${target.monthStr} ${target.year}...`
      );
      try {
        const currentSeenTitles = initialFetch ? [] : allFetchedNewsTitles;
        const newsResult = await searchKeywordNewsAndEvents({
          keyword,
          year: target.year,
          month: target.monthStr, // Pass month name string for better search context
          seenNewsTitles: currentSeenTitles,
          count: 3, // Fetch 3 at a time
        });

        if (
          newsResult.success &&
          newsResult.snippets &&
          Array.isArray(newsResult.snippets)
        ) {
          if (newsResult.snippets.length > 0) {
            const newTitles = newsResult.snippets.map((s) => s.title);
            setNewsSnippets((prev) =>
              initialFetch
                ? [...newsResult.snippets!]
                : [...prev, ...newsResult.snippets!]
            );
            setAllFetchedNewsTitles((prev) => [...prev, ...newTitles]);
            toast.success(`Found ${newsResult.snippets.length} news items.`);
          } else {
            toast.info(
              newsResult.message || "No more relevant news items found."
            );
          }
        } else if (newsResult.success) {
          toast.info(
            newsResult.message || "No news items returned in expected format."
          );
          setNewsSnippets((prev) => (initialFetch ? [] : prev));
        } else {
          toast.error(newsResult.message || "Failed to fetch news.");
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while fetching news.";
        toast.error(message);
      }
    });
  };

  const handleScrollNews = (direction: "left" | "right") => {
    if (newsScrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -320 : 320; // Scroll by width of one card + gap approx
      newsScrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 min-h-screen p-4 md:p-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 md:space-y-0 md:flex md:space-x-3 items-end mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200"
      >
        <div className="flex-grow">
          <label
            htmlFor="keyword-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Keyword
          </label>
          <Input
            id="keyword-input"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g., AI assistant"
            className="w-full bg-white border-gray-300 placeholder-gray-400 text-gray-900 focus:ring-offset-white focus:ring-${accentColor}-500 focus:border-${accentColor}-500"
          />
        </div>
        <div>
          <label
            htmlFor="region-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Region
          </label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger
              id="region-select"
              className={`w-full md:w-[180px] bg-white border-gray-300 text-gray-900 focus:ring-offset-white focus:ring-${accentColor}-500 data-[state=open]:border-${accentColor}-500`}
            >
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300 text-gray-900">
              {regionOptions.map((opt: { value: string; label: string }) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className={`focus:bg-gray-100 data-[state=checked]:bg-${accentColor}-600 data-[state=checked]:text-white`}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label
            htmlFor="language-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Language
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger
              id="language-select"
              className={`w-full md:w-[180px] bg-white border-gray-300 text-gray-900 focus:ring-offset-white focus:ring-${accentColor}-500 data-[state=open]:border-${accentColor}-500`}
            >
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300 text-gray-900">
              {languageOptions.map((opt: { value: string; label: string }) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className={`focus:bg-gray-100 data-[state=checked]:bg-${accentColor}-600 data-[state=checked]:text-white`}
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          disabled={isCheckingTrend || !keyword.trim()}
          variant="default"
          className={`w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold focus:ring-indigo-500 focus:ring-offset-2 focus:ring-2`}
        >
          {isCheckingTrend ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <TrendingUp className="h-4 w-4 mr-2" />
          )}
          Check Trend
        </Button>
      </form>

      {/* --- New Three-Card Structure START --- */}
      {/* Card 1: Keyword Trending Status Judgment */}
      {analysisResult && analysisResult.success && (
        <Card className={`my-6 bg-white border-gray-200 shadow-md`}>
          <CardHeader>
            <CardTitle
              className={`text-xl font-semibold text-${accentColor}-700`}
            >
              Keyword Trending Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analysisResult.isTrending && (
              <p className="text-lg text-green-600">
                This keyword shows a significant{" "}
                <span className="font-bold">upward trend</span>.
              </p>
            )}
            {analysisResult.isDeclining && (
              <p className="text-lg text-red-600">
                This keyword shows a significant{" "}
                <span className="font-bold">downward trend</span>.
              </p>
            )}
            {analysisResult.isStable && (
              <p className="text-lg text-gray-700">
                This keyword currently has a{" "}
                <span className="font-bold">stable trend</span> or is not
                showing a significant directional change.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 2: Trend Type & Details */}
      {analysisResult && analysisResult.success && (
        <Card className={`my-6 bg-white border-gray-200 shadow-md`}>
          <CardHeader>
            <CardTitle
              className={`text-xl font-semibold text-${accentColor}-700 mb-2`}
            >
              Trend Characteristics
            </CardTitle>
            {analysisResult.isTrending && (
              <CardDescription className="text-lg font-medium text-green-600">
                Type: Trending Up ({analysisResult.confidence})
              </CardDescription>
            )}
            {analysisResult.isDeclining && (
              <CardDescription className="text-lg font-medium text-red-600">
                Type: Trending Down ({analysisResult.confidence})
              </CardDescription>
            )}
            {analysisResult.isStable && (
              <CardDescription
                className={`text-lg font-medium ${
                  analysisResult.message
                    .toLowerCase()
                    .includes("high volatility")
                    ? `text-orange-500` // Brighter orange for light theme
                    : `text-gray-700`
                }`}
              >
                Type:{" "}
                {analysisResult.message
                  .toLowerCase()
                  .includes("high volatility")
                  ? "Stable (High Volatility)"
                  : "Stable / Not Significant"}{" "}
                ({analysisResult.confidence})
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500">
              Detailed statistics and monthly data are available in the main
              analysis section below.
            </p>
          </CardContent>
        </Card>
      )}
      {/* --- New Three-Card Structure END --- */}

      {/* Original Prominent Trend Status Display - REMOVED as it's now split into Card 1 and Card 2 */}

      {/* Analysis Error Card (if analysis failed) */}
      {analysisResult && !analysisResult.success && analysisResult.message && (
        <Card className={`my-6 text-center border-red-500 bg-white shadow-md`}>
          <CardHeader>
            <CardTitle className={`text-2xl font-bold text-red-600`}>
              Analysis Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{analysisResult.message}</p>
          </CardContent>
        </Card>
      )}

      {isCheckingTrend && !analysisResult && (
        <div className="flex items-center justify-center mt-6 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading analysis...
        </div>
      )}
      {analysisResult && analysisResult.success && (
        <TrendDisplay analysisResult={analysisResult} />
      )}
      {analysisResult &&
        !analysisResult.success &&
        analysisResult.error &&
        !analysisResult.message && (
          <Card
            className={`mt-6 border-red-500 bg-white text-gray-800 shadow-md`}
          >
            <CardHeader>
              <CardTitle className="text-red-600">Analysis Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{analysisResult.error}</p>
            </CardContent>
          </Card>
        )}

      {analysisResult && analysisResult.success && (
        <Card className="mt-8 bg-white border-gray-200 text-gray-800 shadow-md">
          <CardHeader>
            <CardTitle className={`text-${accentColor}-700`}>
              Investigate Related Keywords
            </CardTitle>
            <CardDescription className="text-gray-600">
              Explore trends for keywords related to "{keyword}".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleFetchRelatedKeywords}
              disabled={isFetchingRelated || isCheckingTrend}
              variant="outline"
              className={`mb-4 border-${accentColor}-500 text-${accentColor}-600 hover:bg-${accentColor}-50 hover:text-${accentColor}-700 focus:ring-offset-white focus:ring-${accentColor}-500`}
            >
              {isFetchingRelated ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Find Related Keywords for "{keyword}"
            </Button>

            {isFetchingRelated && relatedKeywords.length === 0 && (
              <div className="flex items-center justify-center mt-4 text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Fetching...
              </div>
            )}

            {relatedKeywords.length > 0 && (
              <div>
                <h5 className="font-semibold mb-2 text-sm text-gray-700">
                  Click a keyword to analyze its trend:
                </h5>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {relatedKeywords.map((kw, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handleRelatedKeywordClick(kw)}
                        className={`text-${accentColor}-600 hover:text-${accentColor}-800 hover:underline disabled:text-gray-400 disabled:no-underline`}
                        disabled={isCheckingTrend || isFetchingRelated}
                      >
                        {kw}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!isFetchingRelated &&
              relatedKeywords.length === 0 &&
              analysisResult &&
              analysisResult.message &&
              !analysisResult.message.startsWith("No distinct") && (
                <p className="text-sm text-gray-500 mt-2">
                  No related keywords were found, or an error occurred.
                </p>
              )}
          </CardContent>
        </Card>
      )}

      {/* Card 3: News Snippets (Remains as the third distinct card when applicable) */}
      {analysisResult && analysisResult.success && newsSearchTarget && (
        <Card className="mt-8 bg-white border-gray-200 text-gray-800 shadow-md">
          <CardHeader>
            <CardTitle
              className={`text-xl font-semibold text-${accentColor}-700`}
            >
              Related News & Events ({newsSearchTarget.monthStr}{" "}
              {newsSearchTarget.year})
            </CardTitle>
            <CardDescription className="text-gray-600">
              Notable happenings around the time of interest for "{keyword}".
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingNews && newsSnippets.length === 0 && (
              <div className="flex items-center justify-center py-4 text-gray-600">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Searching for
                news...
              </div>
            )}
            {!isLoadingNews && newsSnippets.length === 0 && (
              <p className="text-gray-500 py-4">
                No news items found for this period, or search is pending.
              </p>
            )}
            {newsSnippets.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="icon"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-75 hover:opacity-100 disabled:opacity-25 border-${accentColor}-500 text-${accentColor}-600 hover:bg-${accentColor}-100 focus:ring-offset-white`}
                  onClick={() => handleScrollNews("left")}
                  disabled={isLoadingNews}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div
                  ref={newsScrollContainerRef}
                  className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar scrolling-touch px-12" // Added padding for buttons
                  style={{ scrollSnapType: "x mandatory" }}
                >
                  {newsSnippets.map((snippet, index) => (
                    <div
                      key={index}
                      className="min-w-[300px] max-w-[300px] bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm scroll-snap-align-start text-gray-700"
                    >
                      <h3
                        className="font-semibold text-sm mb-1 truncate text-gray-800"
                        title={snippet.title}
                      >
                        {snippet.title}
                      </h3>
                      <p
                        className="text-xs text-gray-600 mb-2 line-clamp-3"
                        title={snippet.summary}
                      >
                        {snippet.summary}
                      </p>
                      {snippet.sourceOrEntityHint && (
                        <p className="text-xs text-gray-500">
                          Source/Entity: {snippet.sourceOrEntityHint}
                        </p>
                      )}
                    </div>
                  ))}
                  {/* Load More Button - visible if not loading and potentially more items */}
                  {!isLoadingNews && (
                    <div className="min-w-[150px] flex flex-col items-center justify-center">
                      <Button
                        variant="outline"
                        onClick={() =>
                          fetchNewsForTargetMonth(newsSearchTarget, false)
                        }
                        disabled={isLoadingNews}
                        className={`border-${accentColor}-500 text-${accentColor}-600 hover:bg-${accentColor}-50 hover:text-${accentColor}-700 focus:ring-offset-white`}
                      >
                        <Newspaper className="h-4 w-4 mr-2" />
                        Load More
                      </Button>
                    </div>
                  )}
                  {isLoadingNews && newsSnippets.length > 0 && (
                    <div className="min-w-[150px] flex items-center justify-center text-gray-600">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-75 hover:opacity-100 disabled:opacity-25 border-${accentColor}-500 text-${accentColor}-600 hover:bg-${accentColor}-100 focus:ring-offset-white`}
                  onClick={() => handleScrollNews("right")}
                  disabled={isLoadingNews}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
