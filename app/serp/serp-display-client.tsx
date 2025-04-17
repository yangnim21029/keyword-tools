'use client';

import type { SerpAnalysisData as FirebaseSerpAnalysisData } from '@/app/services/firebase/db-serp'; // Use the type from db-serp
import React, { useCallback, useState, useTransition } from 'react';
// Import Server Actions
import {
  generateAnalysisJsonFromText,
  deleteSerpAnalysisAction,
  performContentTypeAnalysis,
  performSerpTitleAnalysis,
  performUserIntentAnalysis,
  // Import the exported types
  type ContentTypeAnalysisJson,
  type TitleAnalysisJson,
  type UserIntentAnalysisJson
} from '@/app/actions/serp-action';
// --- NEW: Import keyword research action and type ---
import {
  fetchKeywordResearchSummaryAction,
  findRelevantResearchQueries
} from '@/app/actions/keyword-research-action';
// --- Import NEW summary type from DB layer ---
import type { KeywordResearchSummaryItem } from '@/app/services/firebase/db-keyword-research';
import { Button } from '@/components/ui/button'; // Import Button component
// --- NEW: Import Dialog and Table components ---
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatVolume } from '@/lib/utils'; // Import formatVolume
import { Clock, Globe, Languages, Loader2, Sigma, Trash2 } from 'lucide-react'; // Import icon
import Link from 'next/link'; // <-- Correct import for Link
import { useRouter } from 'next/navigation'; // Import router
import { Badge } from '@/components/ui/badge'; // Import Badge
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components
import { Lightbulb } from 'lucide-react'; // Import an icon

// Define the data structure expected by the Client Component
// This should mirror SerpAnalysisData from db-serp.ts, converting Timestamp to Date
type ClientSerpAnalysisData = Omit<
  FirebaseSerpAnalysisData,
  'timestamp' | 'organicResults'
> & {
  timestamp: Date; // Convert timestamp to Date for client
  // Explicitly type organicResults to match client needs (may differ slightly from DB schema if needed)
  organicResults: Array<{
    position: number;
    title: string;
    url: string;
    description: string | null;
    displayedUrl?: string | null;
    emphasizedKeywords?: string[] | null;
    // Add other fields from organicResultSchema if needed for display
    // siteLinks?: Array<{ title?: string | null; url?: string | null; description?: string | null }> | null;
    // type?: string | null;
    // ... etc
  }>;
  // Include other top-level fields from FirebaseSerpAnalysisData
  searchQuery?: FirebaseSerpAnalysisData['searchQuery'];
  resultsTotal?: FirebaseSerpAnalysisData['resultsTotal'];
  relatedQueries?: FirebaseSerpAnalysisData['relatedQueries'];
  aiOverview?: FirebaseSerpAnalysisData['aiOverview'];
  // paidResults, paidProducts, peopleAlsoAsk can be added if needed for display

  // Existing analysis fields
  contentTypeAnalysisJson: ContentTypeAnalysisJson | null;
  userIntentAnalysisJson: UserIntentAnalysisJson | null;
};

// Update props type to use the client-specific data structure
type SerpDisplayClientProps = {
  initialAnalysisData: ClientSerpAnalysisData;
};

// Analysis types will now trigger different flows
type AnalysisTriggerType = 'contentType' | 'userIntent' | 'title';

// --- NEW: Rankability Assessment Logic & Component ---

type RankabilityLevel = 'good' | 'fair' | 'poor' | 'incomplete';

interface RankabilityResult {
  level: RankabilityLevel;
  reason: string;
  details: {
    dominantIntent?: string;
    articleCount?: number;
    topIntents?: string[];
    topContentTypes?: string[];
  };
}

// Helper function to determine rankability (can be moved outside if needed)
function assessRankability(
  contentTypeAnalysis: ContentTypeAnalysisJson | null,
  userIntentAnalysis: UserIntentAnalysisJson | null
): RankabilityResult {
  const details: RankabilityResult['details'] = {};

  if (!contentTypeAnalysis || !userIntentAnalysis) {
    return {
      level: 'incomplete',
      reason:
        '需要先完成「內容類型分析」和「用戶意圖分析」才能評估排名潛力。',
      details
    };
  }

  // --- Analyze User Intent ---
  let dominantIntent = '未知';
  let isInformationalDominant = false;
  let topIntents: string[] = [];
  if (userIntentAnalysis.intents && userIntentAnalysis.intents.length > 0) {
    // Sort intents by count descending
    const sortedIntents = [...userIntentAnalysis.intents].sort(
      (a, b) => b.count - a.count
    );
    dominantIntent = sortedIntents[0].category || '未知';
    // Consider '資訊型' (Informational) as the target intent for articles
    isInformationalDominant = dominantIntent === '資訊型';
    topIntents = sortedIntents
      .slice(0, 3)
      .map(i => `${i.category} (${i.count})`);
    details.dominantIntent = dominantIntent;
    details.topIntents = topIntents;
  } else {
    dominantIntent = '無意圖數據';
  }

  // --- Analyze Content Type ---
  let articleCount = 0;
  const articleTypes = ['文章', '部落格文章', '資訊頁面', '指南']; // Add more relevant types if needed
  let topContentTypes: string[] = [];
  if (
    contentTypeAnalysis.contentTypes &&
    contentTypeAnalysis.contentTypes.length > 0
  ) {
    const sortedTypes = [...contentTypeAnalysis.contentTypes].sort(
      (a, b) => b.count - a.count
    );
    topContentTypes = sortedTypes
      .slice(0, 3)
      .map(t => `${t.type} (${t.count})`);
    details.topContentTypes = topContentTypes;

    contentTypeAnalysis.contentTypes.forEach(ct => {
      if (articleTypes.includes(ct.type)) {
        // Count pages within the top 10 positions
        const top10Pages = ct.pages?.filter(p => p.position <= 10) ?? [];
        articleCount += top10Pages.length;
      }
    });
    details.articleCount = articleCount;
  }

  // --- Determine Rankability Level ---
  if (isInformationalDominant) {
    if (articleCount >= 5) {
      return {
        level: 'good',
        reason:
          '主要用戶意圖為「資訊型」，且 SERP 中已有較多文章類型內容排名靠前，適合以文章競爭。',
        details
      };
    } else if (articleCount >= 2) {
      return {
        level: 'fair',
        reason:
          '主要用戶意圖為「資訊型」，但 SERP 中文章類型內容不多，有機會但可能需更強內容或不同角度。',
        details
      };
    } else {
      return {
        level: 'poor',
        reason:
          '主要用戶意圖為「資訊型」，但 SERP 中幾乎沒有文章類型內容，以文章競爭可能較困難，需評估其他內容形式。',
        details
      };
    }
  } else {
    // Not informational dominant
    if (articleCount >= 3) {
      // Even if not dominant, if articles exist, maybe there's a niche?
      return {
        level: 'fair', // Changed from poor to fair, as articles *do* rank
        reason: `主要用戶意圖 (${dominantIntent}) 並非「資訊型」，但 SERP 中仍有部分文章排名，可能存在特定角度的資訊需求。`,
        details
      };
    } else {
      return {
        level: 'poor',
        reason: `主要用戶意圖 (${dominantIntent}) 並非「資訊型」，且 SERP 中文章類型內容很少或沒有，不建議優先以文章競爭。`,
        details
      };
    }
  }
}

// Rankability Assessment Component
function RankabilityAssessment({
  analysisData
}: {
  analysisData: ClientSerpAnalysisData;
}) {
  const assessment = assessRankability(
    analysisData.contentTypeAnalysisJson,
    analysisData.userIntentAnalysisJson
  );

  const getBadgeVariant = (
    level: RankabilityLevel
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (level) {
      case 'good':
        return 'default'; // Greenish in default theme? Or customize
      case 'fair':
        return 'secondary'; // Yellowish/Orange?
      case 'poor':
        return 'destructive'; // Red
      case 'incomplete':
      default:
        return 'outline'; // Grey
    }
  };

  const getLevelText = (level: RankabilityLevel): string => {
    switch (level) {
      case 'good':
        return '潛力良好';
      case 'fair':
        return '潛力中等';
      case 'poor':
        return '潛力較低';
      case 'incomplete':
      default:
        return '評估未完成';
    }
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 border-l-4 border-blue-400 shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-xl font-semibold text-gray-800">
          <Lightbulb className="mr-2 h-5 w-5 text-yellow-500" />
          文章排名潛力評估
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-gray-700">評估結果:</span>
          <Badge variant={getBadgeVariant(assessment.level)}>
            {getLevelText(assessment.level)}
          </Badge>
        </div>
        <p className="text-sm text-gray-600">{assessment.reason}</p>
        {assessment.level !== 'incomplete' && (
          <div className="text-xs text-gray-500 pt-2 border-t mt-2 space-y-1">
            {assessment.details.dominantIntent && (
              <p>
                <span className="font-medium">主要意圖:</span>{' '}
                {assessment.details.dominantIntent} (
                {assessment.details.topIntents?.join('; ')})
              </p>
            )}
            {assessment.details.articleCount !== undefined && (
              <p>
                <span className="font-medium">前10名文章數:</span>{' '}
                {assessment.details.articleCount} (主要類型:{' '}
                {assessment.details.topContentTypes?.join('; ') || 'N/A'})
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- END NEW ---

export function SerpDisplayClient({
  initialAnalysisData
}: SerpDisplayClientProps) {
  const [analysisData, setAnalysisData] =
    useState<ClientSerpAnalysisData>(initialAnalysisData);
  const router = useRouter(); // Get router instance

  // Combined loading state for Text Generation + JSON Conversion
  const [isLoading, setIsLoading] = useState<
    Record<AnalysisTriggerType, boolean>
  >({
    contentType: false,
    userIntent: false,
    title: false
  });

  // Combined error state
  const [analysisError, setAnalysisError] = useState<
    Record<AnalysisTriggerType, string | null>
  >({
    contentType: null,
    userIntent: null,
    title: null
  });

  // Separate state for page-level delete action
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // --- NEW: State for recent keyword research ---
  const [isRecentDialogOpen, setIsRecentDialogOpen] = useState(false);
  // --- UPDATED: State types use KeywordResearchSummaryItem ---
  const [fullRecentResearchList, setFullRecentResearchList] = useState<
    KeywordResearchSummaryItem[]
  >([]);
  const [filteredResearchList, setFilteredResearchList] = useState<
    KeywordResearchSummaryItem[]
  >([]);
  const [isFetchingRecent, setIsFetchingRecent] = useState(false);
  const [fetchRecentError, setFetchRecentError] = useState<string | null>(null);
  const [isFindingRelevant, setIsFindingRelevant] = useState(false);
  const [findRelevantError, setFindRelevantError] = useState<string | null>(
    null
  );
  // --- End NEW State ---

  // Access data using new structure
  const keyword = analysisData.originalKeyword;
  const organicResults = analysisData.organicResults; // Use organicResults
  const docId = analysisData.id;

  // Update formatSerpForPrompt
  const formatSerpForPrompt = useCallback(
    (data: typeof organicResults): string => {
      // Use organicResults type
      return data
        .slice(0, 10)
        .map(
          item =>
            // Use item.position and include description/displayedUrl if helpful
            `Position: ${item.position}\nTitle: ${item.title}\nURL: ${
              item.url
            }\nDisplayed URL: ${item.displayedUrl ?? 'N/A'}\nDescription: ${
              item.description ?? 'N/A'
            }\n\n`
        )
        .join('');
    },
    []
  );

  // --- Main analysis handler function ---
  const handleAnalyze = useCallback(
    async (type: AnalysisTriggerType) => {
      setIsLoading(prev => ({ ...prev, [type]: true }));
      setAnalysisError(prev => ({ ...prev, [type]: null }));

      if (!docId) {
        setAnalysisError(prev => ({
          ...prev,
          [type]: '缺少文檔 ID，無法執行分析。'
        }));
        setIsLoading(prev => ({ ...prev, [type]: false }));
        return;
      }

      try {
        // Use organicResults here
        const serpString = formatSerpForPrompt(organicResults);
        console.log(
          `[Client] Requesting ${type} analysis for Doc ID: ${docId} (Keyword: ${keyword})`
        );

        let updatedAnalysisData: Partial<ClientSerpAnalysisData> = {};

        if (type === 'contentType' || type === 'userIntent') {
          // --- Step 1: Get Raw Text ---
          const analysisFn =
            type === 'contentType'
              ? performContentTypeAnalysis
              : performUserIntentAnalysis;
          const params: any = { docId, keyword, serpString };
          if (type === 'userIntent') {
            // Pass actual related queries if available and needed by prompt
            // For now, assuming prompt uses serpString or dedicated logic
            params.relatedKeywordsRaw =
              analysisData.relatedQueries
                ?.map(q => `${q.title}, N/A`)
                .join('\n') ?? '';
          }

          console.log(`[Client] Performing ${type} text analysis...`);
          const textResult = await analysisFn(params);
          const rawText = textResult.analysisText;

          // Update state with raw text immediately (optional, but can show intermediate step)
          const textStateKey =
            type === 'contentType'
              ? 'contentTypeAnalysisText'
              : 'userIntentAnalysisText';
          updatedAnalysisData = { ...updatedAnalysisData, [textStateKey]: rawText }


          console.log(
            `[Client] Received raw ${type} text. Converting to JSON...`
          );

          // --- Step 2: Convert Text to JSON ---
          const conversionResult = await generateAnalysisJsonFromText({
            docId: docId,
            analysisType: type,
            analysisText: rawText,
            keyword: keyword
          });

          console.log(
            `[Client] Received converted ${type} JSON:`,
            conversionResult
          );

          // Update state with the final JSON result
          const jsonStateKey =
            type === 'contentType'
              ? 'contentTypeAnalysisJson'
              : 'userIntentAnalysisJson';
          updatedAnalysisData = { ...updatedAnalysisData, [jsonStateKey]: conversionResult };

        } else if (type === 'title') {
          // --- Direct JSON Analysis (Title) ---
          console.log(`[Client] Performing title JSON analysis...`);
          // Pass docId, keyword, serpString to the action
          const result = await performSerpTitleAnalysis({
            docId,
            keyword,
            serpString
          });
          console.log(`[Client] Received title JSON:`, result);
          // Make sure key matches ClientSerpAnalysisData if needed
          updatedAnalysisData = { ...updatedAnalysisData, titleAnalysis: result }; // Assuming titleAnalysis is the key
        }

        // Update state once with all changes for this analysis type
         setAnalysisData(prev => ({ ...prev, ...updatedAnalysisData }));


      } catch (err) {
        console.error(
          `[Client] Error during ${type} analysis/conversion:`,
          err
        );
        const errorMessage =
          err instanceof Error ? err.message : '分析或轉換時發生未知錯誤';
        setAnalysisError(prev => ({ ...prev, [type]: errorMessage }));
        // Optionally clear partial results on error
        // setAnalysisData(prev => ({ ...prev, ... }));
      } finally {
        setIsLoading(prev => ({ ...prev, [type]: false }));
      }
    },
    // Update dependencies
    [
      docId,
      keyword,
      organicResults,
      formatSerpForPrompt,
      analysisData.relatedQueries
    ]
  );


  // --- Delete Handler for this page ---
  const handleDeletePage = async () => {
    setDeleteError(null);
    if (!docId) {
      setDeleteError('缺少文檔 ID，無法刪除。');
      return;
    }
    if (
      !confirm(
        `確定要刪除關鍵字 "${keyword}" 的所有分析結果嗎？此操作無法復原。`
      )
    ) {
      return;
    }

    startDeleteTransition(async () => {
      try {
        console.log(`[Display Client] Calling delete action for ID: ${docId}`);
        const result = await deleteSerpAnalysisAction({ docId: docId });
        if (result.success) {
          console.log(
            `[Display Client] Deletion successful for ID: ${docId}. Redirecting to input page...`
          );
          // Redirect to the main input page after successful deletion
          router.push('/serp');
          router.refresh(); // Refresh the input page to update the list there too
        } else {
          console.error(
            `[Display Client] Deletion failed for ID: ${docId}: ${result.message}`
          );
          setDeleteError(result.message || '刪除失敗，請重試。');
        }
      } catch (error) {
        console.error(
          `[Display Client] Error during deletion action for ID: ${docId}:`,
          error
        );
        const message =
          error instanceof Error ? error.message : '執行刪除時發生未知錯誤';
        setDeleteError(message);
      }
    });
  };


  // --- UPDATED: Handler for fetching and filtering recent keyword research ---
  const handleViewRecentResearch = useCallback(async () => {
    setIsRecentDialogOpen(true);
    setIsFetchingRecent(true);
    setIsFindingRelevant(false);
    setFetchRecentError(null);
    setFindRelevantError(null);
    setFullRecentResearchList([]);
    setFilteredResearchList([]);

    try {
      console.log(
        '[Display Client] Fetching recent keyword research summary list...'
      );
      // --- UPDATED: Call the new summary action ---
      const listResult = await fetchKeywordResearchSummaryAction(
        undefined,
        undefined,
        10
      );
      // --- End Update ---

      if (listResult.error || !listResult.data) {
        // Check for null data too
        throw new Error(
          `獲取列表失敗: ${listResult.error || 'No data returned'}`
        );
      }
      const fetchedList = listResult.data;
      setFullRecentResearchList(fetchedList);
      console.log(
        `[Display Client] Fetched ${fetchedList.length} recent research summary items.`
      );
      setIsFetchingRecent(false);

      if (fetchedList.length > 0 && keyword) {
        setIsFindingRelevant(true);
        const recentQueryStrings = fetchedList.map(item => item.query);

        console.log(
          `[Display Client] Requesting AI relevance check for "${keyword}"...`
        );
        const relevanceResult = await findRelevantResearchQueries({
          currentSerpQuery: keyword,
          recentQueries: recentQueryStrings
        });

        if (relevanceResult.error) {
          throw new Error(`AI 相關性分析失敗: ${relevanceResult.error}`);
        }

        const relevantQueries = relevanceResult.data ?? [];
        console.log(
          `[Display Client] AI found ${relevantQueries.length} relevant queries.`
        );

        // Filter the full list based on relevant query strings
        const filtered = fetchedList.filter(item =>
          relevantQueries.includes(item.query)
        );
        setFilteredResearchList(filtered);
        console.log(
          `[Display Client] Filtered list contains ${filtered.length} items.`
        );
      } else {
        setFilteredResearchList([]);
      }
    } catch (error) {
      console.error(
        '[Display Client] Error during recent research process:',
        error
      );
      const message =
        error instanceof Error ? error.message : '處理最近研究時發生未知錯誤';
      if (isFetchingRecent) {
        setFetchRecentError(message);
      } else {
        setFindRelevantError(message);
      }
    } finally {
      setIsFetchingRecent(false);
      setIsFindingRelevant(false);
    }
  }, [keyword]);
  // --- End UPDATED Handler ---


  // --- Display Logic ---

  // Helper to format date/time nicely
  const formatDateTime = (
    date: Date | string | { seconds: number; nanoseconds: number } | undefined
  ): string => {
    if (!date) return 'N/A';
    try {
      let dateObj: Date;
      if (
        typeof date === 'object' &&
        'seconds' in date &&
        'nanoseconds' in date
      ) {
        // Handle Firestore Timestamp object
        dateObj = new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
      } else {
        // Handle Date object or string
        dateObj = new Date(date);
      }

      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }

      return dateObj.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">SERP 分析結果</h1>
          <p className="text-lg text-gray-600">
            關鍵字:{' '}
            <span className="font-semibold text-blue-700">{keyword}</span>
          </p>
          <p className="text-sm text-gray-500">
            分析時間: {formatDateTime(analysisData.timestamp)} (ID: {docId})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end"> {/* Added flex-wrap and justify-end */}
          {/* --- UPDATED Dialog Section --- */}
          <Dialog
            open={isRecentDialogOpen}
            onOpenChange={setIsRecentDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                onClick={() => handleViewRecentResearch()}
                size="sm" // Make buttons slightly smaller
              >
                查找相關研究
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[725px]">
              <DialogHeader>
                <DialogTitle>相關的最近關鍵字研究</DialogTitle>
                <DialogDescription>
                  以下是與 "{keyword}" 相關的最近研究項目。
                </DialogDescription>
              </DialogHeader>
              {(isFetchingRecent || isFindingRelevant) && (
                <div className="flex justify-center items-center p-4">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在{isFetchingRecent ? '獲取列表' : '分析相關性'}...
                </div>
              )}
              {fetchRecentError && (
                <p className="text-red-600 text-center p-4">
                  列表錯誤: {fetchRecentError}
                </p>
              )}
              {findRelevantError && (
                <p className="text-red-600 text-center p-4">
                  AI分析錯誤: {findRelevantError}
                </p>
              )}
              {!isFetchingRecent &&
                !isFindingRelevant &&
                !fetchRecentError &&
                !findRelevantError && (
                  <>
                    {filteredResearchList.length > 0 ? (
                      <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>查詢</TableHead>
                              <TableHead className="text-right">
                                總搜尋量
                              </TableHead>
                              <TableHead>地區</TableHead>
                              <TableHead>語言</TableHead>
                              <TableHead>建立時間</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredResearchList.map(item => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  <Link
                                    href={`/keyword-mapping/${item.id}`}
                                    className="hover:underline"
                                    target="_blank"
                                  >
                                    {item.query}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="flex items-center justify-end">
                                    <Sigma
                                      size={12}
                                      className="mr-1 flex-shrink-0"
                                    />
                                    {formatVolume(item.totalVolume)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {item.region ? (
                                    <span className="flex items-center">
                                      <Globe
                                        size={12}
                                        className="mr-1 flex-shrink-0"
                                      />
                                      {item.region}
                                    </span>
                                  ) : (
                                    'N/A'
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.language ? (
                                    <span className="flex items-center">
                                      <Languages
                                        size={12}
                                        className="mr-1 flex-shrink-0"
                                      />
                                      {item.language}
                                    </span>
                                  ) : (
                                    'N/A'
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center">
                                    <Clock
                                      size={12}
                                      className="mr-1 flex-shrink-0"
                                    />
                                    {formatDateTime(item.createdAt)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 p-4">
                        找不到與 "{keyword}" 相關的最近研究記錄。
                      </p>
                    )}
                  </>
                )}
            </DialogContent>
          </Dialog>
          {/* --- End UPDATED Dialog Section --- */}

          <Button
            variant="destructive"
            onClick={handleDeletePage}
            disabled={isDeleting}
            size="sm" // Make buttons slightly smaller
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                刪除中...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                刪除此分析
              </>
            )}
          </Button>
        </div>
      </div>
      {deleteError && (
        <p className="text-red-600 mb-4 text-center md:text-right">
          刪除錯誤: {deleteError}
        </p>
      )}

      {/* --- NEW: Rankability Assessment --- */}
      <RankabilityAssessment analysisData={analysisData} />
      {/* --- END NEW --- */}


      {/* Two-column layout for content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         {/* Left Column: Organic Results Section */}
         <div className="space-y-4 border rounded-lg p-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">自然搜尋結果 (前 10)</h2>
          {organicResults.slice(0, 10).map(item => (
            <div key={item.position} className="border-b pb-4 last:border-b-0">
              <p className="text-sm text-gray-500">排名: {item.position}</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-lg font-medium block"
              >
                {item.title}
              </a>
              <p className="text-green-700 text-sm mt-1 break-all">
                {item.displayedUrl ?? item.url}
              </p>
              <p className="text-gray-700 mt-2 text-sm">
                {item.description ?? '無描述'}
              </p>
              {item.emphasizedKeywords &&
                item.emphasizedKeywords.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    強調關鍵字: {item.emphasizedKeywords.join(', ')}
                  </p>
                )}
            </div>
          ))}
          {organicResults.length === 0 && (
            <p className="text-gray-500">未找到自然搜尋結果。</p>
          )}
        </div>


        {/* Right Column: Analysis Sections */}
         <div className="space-y-6">
           <AnalysisSection
             title="內容類型分析"
             type="contentType"
             isLoading={isLoading.contentType}
             error={analysisError.contentType}
             onAnalyze={() => handleAnalyze('contentType')}
             result={analysisData.contentTypeAnalysisJson}
             rawTextResult={analysisData.contentTypeAnalysisText} // Pass raw text
           />
           <AnalysisSection
             title="用戶意圖分析"
             type="userIntent"
             isLoading={isLoading.userIntent}
             error={analysisError.userIntent}
             onAnalyze={() => handleAnalyze('userIntent')}
             result={analysisData.userIntentAnalysisJson}
             rawTextResult={analysisData.userIntentAnalysisText} // Pass raw text
          />
          <AnalysisSection
            title="SERP 標題分析"
            type="title"
            isLoading={isLoading.title}
            error={analysisError.title}
            onAnalyze={() => handleAnalyze('title')}
            result={analysisData.titleAnalysis} // Assuming key is titleAnalysis
            // No raw text for title analysis typically
          />
        </div>
      </div>
    </div>
  );
}


// Helper component for displaying each analysis section
type AnalysisSectionProps = {
  title: string;
  type: AnalysisTriggerType;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
  result:
    | ContentTypeAnalysisJson
    | UserIntentAnalysisJson
    | TitleAnalysisJson // Use correct type for title analysis
    | null;
  rawTextResult?: string | null; // Optional raw text for display
};


function AnalysisSection({
  title,
  type,
  isLoading,
  error,
  onAnalyze,
  result,
  rawTextResult // Receive raw text prop
}: AnalysisSectionProps): React.ReactNode {
  // --- Render Result Logic ---
  const renderResult = (): React.ReactNode | null => {
    if (!result) return null;

    // Content Type Rendering
    if (type === 'contentType' && result && 'contentTypes' in result) {
      const data = result as ContentTypeAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">
            {data.analysisTitle || title}
          </h4>
          {data.reportDescription && (
            <p className="text-gray-600">{data.reportDescription}</p>
          )}
          {data.usageHint && (
            <p className="text-xs italic text-gray-500">
              提示: {data.usageHint}
            </p>
          )}
          <h5 className="font-medium mt-2">內容類型分佈:</h5>
          {data.contentTypes && data.contentTypes.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2">
              {data.contentTypes.map((ct, index) => (
                <li key={index}>
                  <span className="font-medium">{ct.type}</span> ({ct.count}{' '}
                  個結果)
                  {ct.pages && ct.pages.length > 0 && (
                    <ul className="list-circle pl-5 mt-1 text-xs space-y-1">
                      {ct.pages.map(page => (
                        <li key={page.position}>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            位置 {page.position}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">未分析出內容類型。</p>
          )}
        </div>
      );
    }

    // User Intent Rendering
    if (type === 'userIntent' && result && 'intents' in result) {
      const data = result as UserIntentAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">
            {data.analysisTitle || title}
          </h4>
          {data.reportDescription && (
            <p className="text-gray-600">{data.reportDescription}</p>
          )}
          {data.usageHint && (
            <p className="text-xs italic text-gray-500">
              提示: {data.usageHint}
            </p>
          )}

          <h5 className="font-medium mt-2">用戶意圖分析:</h5>
          {data.intents && data.intents.length > 0 ? (
            <ul className="space-y-3">
              {data.intents.map((intent, index) => (
                <li key={index} className="border-l-2 pl-3 border-gray-200">
                  <p>
                    <span className="font-medium">類別:</span> {intent.category}
                  </p>
                  <p>
                    <span className="font-medium">具體意圖:</span>{' '}
                    {intent.specificIntent} ({intent.count} 個結果)
                  </p>
                  {intent.pages && intent.pages.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium">涉及頁面:</span>
                      <ul className="list-circle pl-5 text-xs space-y-1">
                        {intent.pages.map(page => (
                          <li key={page.position}>
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              位置 {page.position}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">未分析出用戶意圖。</p>
          )}

          {data.relatedKeywords && data.relatedKeywords.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium">相關關鍵字:</h5>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {data.relatedKeywords.map((kw, index) => (
                  <li key={index}>
                    {kw.keyword} (搜索量: {kw.searchVolume ?? '?'})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Title Analysis Rendering
    // Check for 'titleAnalysis' as the property name if that's what's in ClientSerpAnalysisData
     if (type === 'title' && result && 'title' in result && 'analysis' in result) {
      const data = result as TitleAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">建議標題:</h4>
          <p className="bg-green-50 p-2 rounded border border-green-200">
            {data.title}
          </p>

          <h5 className="font-medium mt-2">標題分析:</h5>
          <p className="text-gray-700 whitespace-pre-wrap break-words">
            {data.analysis}
          </p>

          {data.recommendations && data.recommendations.length > 0 && (
            <div className="mt-2">
              <h5 className="font-medium">建議:</h5>
              <ul className="list-disc pl-5 space-y-1">
                {data.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }


    // Fallback for unknown result structure or type
    return (
      <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };


  // --- Render Raw Text Logic ---
  const renderRawText = (): React.ReactNode | null => {
    if (!rawTextResult || result) return null; // Only show if no JSON result yet
    return (
      <div className="mt-2">
        <h4 className="text-sm font-medium text-gray-600 mb-1">
          原始文本結果 (等待JSON轉換):
        </h4>
        <pre className="text-xs bg-yellow-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
          {rawTextResult}
        </pre>
      </div>
    );
  };


  // --- Main Component Return ---
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      {/* Header with Title and Button */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button // Use Shadcn Button
          onClick={onAnalyze}
          disabled={isLoading}
          size="sm" // Make button smaller
          variant="default" // Or another appropriate variant
        >
          {isLoading ? (
             <>
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
               處理中...
             </>
           ) : (
             '開始分析'
           )}
         </Button>
       </div>

      {/* Error Display */}
      {error && (
        <div className="text-red-600 bg-red-50 p-2 rounded mb-2 text-sm">
          錯誤: {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && !result && !rawTextResult && ( // Show loading only if nothing else is shown
         <div className="flex items-center text-sm text-gray-500">
           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
           正在加載分析結果...
         </div>
       )}


      {/* Content Area: Render JSON or Raw Text or Placeholder */}
       {!isLoading && !error && (
         <>
           {renderResult()} {/* Render JSON result if available */}
           {renderRawText()} {/* Render Raw text if available AND JSON is not */}
         </>
       )}


      {/* Placeholder when no data, not loading, and no error */}
       {!result && !rawTextResult && !isLoading && !error && (
         <p className="text-sm text-gray-400">點擊 "開始分析" 以獲取結果。</p>
       )}
     </div>
   );
}
