"use server";

import {
  getNewAvailableOpportunitiesFromCsv,
  saveProcessedOpportunity,
  getAllProcessedOpportunities,
  markUrlAsUnavailable,
  updateProcessedOppourtunity,
  // FirebaseOppourtunity, // Raw type, actions will use the processed type
  OpportunityFromCsv,
  OppourtunityStatus,
  ProcessedFirebaseOppourtunity, // Import the type with Date objects
  getProcessedOpportunitiesCountByAuthorAndWeek, // <-- Import new helper
  FirebaseOppourtunitySchema, // <--- ADD THIS IMPORT
} from "@/app/services/firebase/data-oppourtunity";
import { extractArticleContentFromUrl } from "@/app/services/scrape.service";
import { GscKeywordMetrics } from "@/app/services/firebase/schema"; // <-- ADD THIS IMPORT
import {
  addOnPageResult,
  // getOnPageResultsByAuthorAndWeek,
} from "@/app/services/firebase/data-onpage-result";
import { analyzeKeywordsWithAiAction, KeywordGroup } from "./actions-ai-audit";
import { fetchGscKeywordsForUrl } from "@/app/services/gsc-keywords.service";
import { db, COLLECTIONS } from "@/app/services/firebase/db-config";
import { Timestamp, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { MEDIASITE_DATA } from "@/app/global-config"; // <-- Import MEDIASITE_DATA
import {
  getSearchVolume,
  getRelatedKeywordIdeas,
} from "@/app/services/keyword-idea-api.service"; // <-- Import Ads volume service and related keywords

// --- Helper Function for Site Info ---
interface MediaSiteInfo {
  region: string | null;
  language: string | null;
  name?: string | null;
}

/**
 * Finds the best matching media site information (region, language, name)
 * for a given URL based on the MEDIASITE_DATA config.
 * It prioritizes the longest matching base URL.
 *
 * @param url The URL to analyze.
 * @returns An object containing region, language, and name, or nulls if no match found.
 */
function findMediaSiteInfo(url: string): MediaSiteInfo {
  if (!url) {
    return { region: null, language: null, name: null };
  }

  let bestMatch: { site: (typeof MEDIASITE_DATA)[0]; length: number } | null =
    null;

  for (const site of MEDIASITE_DATA) {
    if (url.startsWith(site.url)) {
      if (!bestMatch || site.url.length > bestMatch.length) {
        bestMatch = { site: site, length: site.url.length };
      }
    }
  }

  if (bestMatch) {
    return {
      region: bestMatch.site.region || null,
      language: bestMatch.site.language || null,
      name: bestMatch.site.name || null,
    };
  } else {
    console.warn(
      `[findMediaSiteInfo] No matching media site found for URL: ${url}`
    );
    return { region: null, language: null, name: null };
  }
}
// --- End Helper Function ---

// Define type for combined GSC + Ads Volume data
interface EnrichedKeywordData extends GscKeywordMetrics {
  searchVolume?: number | null; // Added from Google Ads
}

// Define the new outcome type for the processing attempt
export type ProcessAttemptOutcome = // Export for use in page.tsx if needed for state typing

    | {
        status: "success_ready_for_batch";
        // Data payload for successful processing, ready for batch saving
        data: Omit<
          ProcessedFirebaseOppourtunity,
          "id" | "createdAt" | "updatedAt" | "processedAt"
        > & {
          originalCsvKeyword: string;
          csvVolume?: number;
          url: string;
          status: Extract<OppourtunityStatus, "analyzed">;
        };
        finalStatusMessage: string;
      }
    | {
        status: "author_limit_deferred";
        finalStatusMessage: string;
        urlSkipped: string;
      }
    | {
        status: "no_new_items";
        finalStatusMessage: string;
      }
    | {
        status: "error"; // For actual errors like scraping, AI, etc.
        finalStatusMessage: string;
        error: string;
        urlAttempted?: string;
      };

// Helper type to extract the specific data payload for success
type SuccessDataPayload = Extract<
  ProcessAttemptOutcome,
  { status: "success_ready_for_batch" }
>["data"];

interface AllOpportunitiesListResult {
  opportunities?: ProcessedFirebaseOppourtunity[]; // Use ProcessedFirebaseOppourtunity
  error?: string;
}

interface MarkUnavailableResult {
  success: boolean;
  message: string;
  error?: string;
}

// Interface for the result of the batch save action
interface BatchSaveResult {
  successCount: number;
  failedCount: number;
  errors: { url: string; error: string }[];
  overallMessage: string;
}

async function checkAuthorWeeklyLimit(
  author: string | null | undefined,
  researchId: string // researchId is no longer directly used here but kept for consistent signature if needed elsewhere
): Promise<boolean> {
  if (!author) {
    return false; // No author, no limit applicable
  }
  // Now uses the count of successfully processed opportunities for the author
  const processedCountThisWeek =
    await getProcessedOpportunitiesCountByAuthorAndWeek(author);

  // Define the weekly limit for processed opportunities per author
  const weeklyLimit = 2;

  console.log(
    `[checkAuthorWeeklyLimit] Author: ${author}, Processed this week: ${processedCountThisWeek}, Limit: ${weeklyLimit} (Research ID: ${researchId})`
  );
  return processedCountThisWeek >= weeklyLimit;
}

export async function processRandomOppourtunityAction(
  researchId: string
): Promise<ProcessAttemptOutcome> {
  // Return the new outcome type
  let csvCandidate: OpportunityFromCsv | null = null;
  let onPageResultId: string | null = null;
  let authorToSave: string | undefined = undefined;

  try {
    const availableCsvOpportunities =
      await getNewAvailableOpportunitiesFromCsv(1);
    if (!availableCsvOpportunities || availableCsvOpportunities.length === 0) {
      return {
        status: "no_new_items",
        finalStatusMessage:
          "No new opportunities available from CSV to process.",
      };
    }
    csvCandidate = availableCsvOpportunities[0];

    const scrapedData = await extractArticleContentFromUrl(csvCandidate.url);
    if (!scrapedData || !scrapedData.textContent) {
      return {
        status: "error",
        finalStatusMessage: `Scraping yielded no text content for ${csvCandidate.url}.`,
        error: "Scraping error - no content",
        urlAttempted: csvCandidate.url,
      };
    }

    onPageResultId = await addOnPageResult(scrapedData);
    if (!onPageResultId) {
      return {
        status: "error",
        finalStatusMessage: `Could not store scraped page content for ${csvCandidate.url}.`,
        error: "DB error storing scrape data",
        urlAttempted: csvCandidate.url,
      };
    }

    authorToSave = scrapedData.byline === null ? undefined : scrapedData.byline;

    const authorLimitReached = await checkAuthorWeeklyLimit(
      authorToSave,
      researchId
    );
    if (authorLimitReached) {
      // DO NOT markUrlAsUnavailable here anymore. Caller (batch loop) will decide.
      return {
        status: "author_limit_deferred",
        finalStatusMessage: `Author ${authorToSave || "N/A"} weekly limit for ${csvCandidate.url}. Skipped for this batch.`,
        urlSkipped: csvCandidate.url,
      };
    }

    const dataForBatch: SuccessDataPayload = {
      url: csvCandidate.url,
      originalCsvKeyword: csvCandidate.keyword,
      csvVolume: csvCandidate.volume,
      status: "analyzed",
      onPageResultId: onPageResultId!,
      scrapedTitle: scrapedData.title ?? undefined,
      scrapedExcerpt: scrapedData.excerpt ?? undefined,
      scrapedSiteName: scrapedData.siteName ?? undefined,
      keywordGroup: undefined,
      author: authorToSave,
      researchId: researchId,
      gscKeywords: undefined,
    };

    // --- Step 1: Fetch GSC Keywords ---
    let gscFetchStatusMessage = "";
    let rawGscKeywords: GscKeywordMetrics[] | undefined = undefined;
    try {
      const gscKeywordsResult = await fetchGscKeywordsForUrl(csvCandidate.url);
      if (!("error" in gscKeywordsResult)) {
        rawGscKeywords = gscKeywordsResult;
        gscFetchStatusMessage = " (GSC keywords fetched)";
        console.log(
          `Successfully fetched ${rawGscKeywords.length} GSC keywords for ${csvCandidate.url}`
        );
      } else {
        gscFetchStatusMessage = ` (GSC keywords fetch failed: ${gscKeywordsResult.error})`;
        console.warn(
          `Failed to fetch GSC keywords for ${csvCandidate.url}: ${gscKeywordsResult.error}`,
          gscKeywordsResult.details
        );
      }
    } catch (gscError) {
      gscFetchStatusMessage = " (GSC keywords fetch error)";
      console.error(
        `Unexpected error fetching GSC keywords for ${csvCandidate.url}:`,
        gscError
      );
    }

    // --- Step 2: Prepare Keywords & Get Ads Volume/Ideas ---
    let enrichedKeywordsForAI: EnrichedKeywordData[] = [];
    let adsFetchStatusMessage = "";
    const siteInfo = findMediaSiteInfo(csvCandidate.url);
    const region = siteInfo.region;
    const language = siteInfo.language;
    const nowForTimestamp = Timestamp.now();

    if (rawGscKeywords && rawGscKeywords.length > 0) {
      // --- Original Path: GSC data exists ---
      const topGscKeywords = [...rawGscKeywords]
        .sort((a, b) => a.mean_position - b.mean_position)
        .slice(0, 20);
      const topKeywordStrings = topGscKeywords.map((k) => k.keyword);

      if (region && language && topKeywordStrings.length > 0) {
        console.log(
          `[Action/GSC Path] Getting Ads Volume for ${topKeywordStrings.length} GSC keywords (Region: ${region}, Lang: ${language})`
        );
        try {
          const volumeResults = await getSearchVolume({
            keywords: topKeywordStrings,
            region: region,
            language: language,
            filterZeroVolume: false,
          });
          const volumeMap = new Map<string, number | null | undefined>();
          volumeResults.forEach((v) =>
            volumeMap.set(v.text.toLowerCase().trim(), v.searchVolume)
          );

          enrichedKeywordsForAI = topGscKeywords.map((gscKw) => ({
            ...gscKw,
            searchVolume: volumeMap.get(gscKw.keyword.toLowerCase().trim()),
          }));
          adsFetchStatusMessage = " (Ads Volume for GSC keywords checked)";
          console.log(
            `[Action/GSC Path] Enriched ${enrichedKeywordsForAI.length} GSC keywords with Ads Volume.`
          );
        } catch (adsError) {
          adsFetchStatusMessage = " (Ads Volume fetch error for GSC keywords)";
          console.error(
            `[Action/GSC Path] Error fetching Ads volume:`,
            adsError
          );
          enrichedKeywordsForAI = topGscKeywords.map((gscKw) => ({
            ...gscKw,
            searchVolume: undefined,
          })); // Fallback: GSC only
        }
      } else {
        adsFetchStatusMessage =
          " (Ads Volume skipped for GSC: missing region/lang)";
        enrichedKeywordsForAI = topGscKeywords.map((gscKw) => ({
          ...gscKw,
          searchVolume: undefined,
        })); // Fallback: GSC only
      }
      // --- End Original Path ---
    } else {
      // --- Fallback Path: GSC failed or returned empty ---
      console.log(
        `[Action/Fallback Path] GSC failed or empty. Trying Ads API for related keywords using seed: "${csvCandidate.keyword}"`
      );
      adsFetchStatusMessage = " (GSC failed, attempting Ads fallback)";

      if (region && language) {
        try {
          const relatedIdeas = await getRelatedKeywordIdeas({
            seedKeywords: [csvCandidate.keyword], // Seed with original CSV keyword
            region: region,
            language: language,
            maxResults: 20, // Limit fallback results
          });

          if (relatedIdeas && relatedIdeas.length > 0) {
            console.log(
              `[Action/Fallback Path] Found ${relatedIdeas.length} related keywords via Ads.`
            );
            enrichedKeywordsForAI = relatedIdeas.map(
              (idea): EnrichedKeywordData => ({
                keyword: idea.text,
                searchVolume: idea.searchVolume,
                mean_position: -1,
                min_position: -1,
                max_position: -1,
                site_ids: [],
                total_impressions: 0,
                total_clicks: 0,
                overall_ctr: 0,
              })
            );
            adsFetchStatusMessage = ` (GSC failed, using ${relatedIdeas.length} related keywords from Ads)`;
          } else {
            console.log(
              `[Action/Fallback Path] Ads API returned no related keywords for seed: "${csvCandidate.keyword}"`
            );
            adsFetchStatusMessage =
              " (GSC failed, Ads fallback yielded no keywords)";
            // enrichedKeywordsForAI remains empty
          }
        } catch (fallbackError) {
          console.error(
            `[Action/Fallback Path] Error fetching related keywords from Ads:`,
            fallbackError
          );
          adsFetchStatusMessage = " (GSC failed, Ads fallback fetch error)";
          // enrichedKeywordsForAI remains empty
        }
      } else {
        console.log(
          "[Action/Fallback Path] Ads fallback skipped: missing region/language."
        );
        adsFetchStatusMessage =
          " (GSC failed, Ads fallback skipped - no region/lang)";
        // enrichedKeywordsForAI remains empty
      }
      // --- End Fallback Path ---
    }

    dataForBatch.gscKeywords = enrichedKeywordsForAI;

    // --- Step 3: AI Analysis ---
    const aiInputForLlm = {
      scrapedContent: scrapedData,
      originalCsvKeyword: csvCandidate.keyword,
      enrichedKeywords: enrichedKeywordsForAI,
    };
    console.log(
      `[Action] Passing ${enrichedKeywordsForAI.length} keywords to AI for analysis.`
    );
    const aiAnalysisResult = await analyzeKeywordsWithAiAction(aiInputForLlm);

    if ("error" in aiAnalysisResult || !aiAnalysisResult.aiPrimaryKeyword) {
      const errorMsg =
        ("error" in aiAnalysisResult && aiAnalysisResult.error) ||
        "AI analysis returned no keywords";
      await markUrlAsUnavailable(
        csvCandidate.url,
        `AI_analysis_failed: ${errorMsg}`
      );
      return {
        status: "error",
        finalStatusMessage: `AI Keyword Analysis failed for ${csvCandidate.url}. Error: ${errorMsg}.${gscFetchStatusMessage}${adsFetchStatusMessage}`,
        error: "AI Analysis Error",
        urlAttempted: csvCandidate.url,
      };
    }

    dataForBatch.keywordGroup = aiAnalysisResult as KeywordGroup;

    return {
      status: "success_ready_for_batch" as const,
      data: dataForBatch,
      finalStatusMessage: `Opportunity ${csvCandidate.url} processed.${gscFetchStatusMessage}${adsFetchStatusMessage}`,
    };
  } catch (e) {
    console.error("Critical error in processRandomOppourtunityAction:", e);
    const errorMsg = e instanceof Error ? e.message : String(e);
    if (csvCandidate?.url) {
      try {
        await markUrlAsUnavailable(
          csvCandidate.url,
          `critical_processing_error: ${errorMsg.substring(0, 100)}`
        );
      } catch (markError) {
        console.error(
          `Failed to mark URL as unavailable during critical error handling for ${csvCandidate.url}:`,
          markError
        );
      }
    }
    return {
      status: "error",
      finalStatusMessage: `Critical Failure during processing for ${csvCandidate?.url || "unknown URL"}. ${errorMsg}. Check logs.`,
      error: errorMsg,
      urlAttempted: csvCandidate?.url,
    };
  }
}

export async function getAllOpportunitiesListAction(): Promise<AllOpportunitiesListResult> {
  try {
    const opportunities = await getAllProcessedOpportunities();
    return { opportunities };
  } catch (e) {
    console.error("Error in getAllOpportunitiesListAction:", e);
    return {
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function markOppourtunityUnavailableAction(
  url: string,
  reason?: string
): Promise<MarkUnavailableResult> {
  try {
    const success = await markUrlAsUnavailable(
      url,
      reason || "user_marked_unavailable"
    );
    if (success) {
      return {
        success: true,
        message: `Successfully marked ${url} as unavailable.`,
      };
    } else {
      return {
        success: false,
        message: `Attempted to mark ${url} as unavailable. Check service logs for details.`,
      };
    }
  } catch (e) {
    console.error("Error in markOppourtunityUnavailableAction:", e);
    return {
      success: false,
      message: `Error marking ${url} as unavailable.`,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function saveBatchProcessedOpportunitiesAction(
  opportunitiesToSave: SuccessDataPayload[]
): Promise<BatchSaveResult> {
  if (!opportunitiesToSave || opportunitiesToSave.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: [],
      overallMessage: "No opportunities provided to save.",
    };
  }

  let successCount = 0;
  const errors: { url: string; error: string }[] = [];

  console.log(
    `Batch Save: Attempting to save ${opportunitiesToSave.length} opportunities.`
  );

  for (const oppData of opportunitiesToSave) {
    try {
      // saveProcessedOpportunity expects data that Omit-s id, createdAt, updatedAt, processedAt
      // and includes status. SuccessDataPayload matches this.
      const savedOpp = await saveProcessedOpportunity(oppData);
      if (savedOpp) {
        successCount++;
      } else {
        // This case should ideally be caught by an error in saveProcessedOpportunity if it returns null
        console.error(
          `Batch Save: Failed to save opportunity for URL ${oppData.url} - saveProcessedOpportunity returned null.`
        );
        errors.push({
          url: oppData.url,
          error:
            "saveProcessedOpportunity returned null without throwing an error.",
        });
      }
    } catch (e) {
      console.error(
        `Batch Save: Error saving opportunity for URL ${oppData.url}:`,
        e
      );
      errors.push({
        url: oppData.url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const overallMessage = `Batch Save Complete: ${successCount} saved successfully, ${errors.length} failed.`;
  console.log(overallMessage, errors.length > 0 ? errors : "");

  return {
    successCount,
    failedCount: errors.length,
    errors,
    overallMessage,
  };
}

// --- New Action for Author Weekly Submission Counts ---
interface AuthorSubmissionCount {
  author: string;
  count: number;
}

interface AuthorCountsResult {
  counts?: AuthorSubmissionCount[];
  error?: string;
}

export async function getAuthorWeeklySubmissionCountsAction(): Promise<AuthorCountsResult> {
  if (!db) {
    console.error("[Action] Firestore DB not available for author counts.");
    return { error: "Database not available." };
  }

  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoTimestamp = Timestamp.fromDate(oneWeekAgo);

    const PROCESSED_OPP_COLLECTION = COLLECTIONS.PROCESSED_OPPORTUNITY;
    if (!PROCESSED_OPP_COLLECTION) {
      return { error: "Processed Opportunity collection name not configured." };
    }

    const querySnapshot = await db
      .collection(PROCESSED_OPP_COLLECTION)
      .where("processedAt", ">=", oneWeekAgoTimestamp)
      .select("author")
      .get();

    if (querySnapshot.empty) {
      return { counts: [] };
    }

    const authorCountsMap = new Map<string, number>();
    querySnapshot.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      const author = data.author;
      if (author && typeof author === "string") {
        authorCountsMap.set(author, (authorCountsMap.get(author) || 0) + 1);
      } else if (author) {
        console.warn(
          `[Action] Document ${doc.id} in processed_opportunities has non-string author:`,
          author
        );
      }
    });

    const counts: AuthorSubmissionCount[] = [];
    for (const [author, count] of authorCountsMap.entries()) {
      counts.push({ author, count });
    }

    counts.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.author.localeCompare(b.author);
    });

    return { counts };
  } catch (error) {
    console.error(
      "[Action] Error fetching author weekly submission counts:",
      error
    );
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// --- New Action to Delete a Processed Opportunity ---
interface DeleteProcessedOpportunityResult {
  success: boolean;
  message: string;
  error?: string;
}

export async function deleteProcessedOpportunityAction(
  opportunityId: string
): Promise<DeleteProcessedOpportunityResult> {
  if (!db) {
    console.error(
      "[Action] Firestore DB not available for deleting opportunity."
    );
    return {
      success: false,
      message: "Database not available.",
      error: "Database not available.",
    };
  }
  if (!opportunityId) {
    return {
      success: false,
      message: "Opportunity ID is required for deletion.",
      error: "Missing opportunityId",
    };
  }

  const PROCESSED_OPP_COLLECTION = COLLECTIONS.PROCESSED_OPPORTUNITY;
  if (!PROCESSED_OPP_COLLECTION) {
    return {
      success: false,
      message: "Processed Opportunity collection name not configured.",
      error: "Collection not configured",
    };
  }

  try {
    await db.collection(PROCESSED_OPP_COLLECTION).doc(opportunityId).delete();
    console.log(
      `[Action] Successfully deleted processed opportunity: ${opportunityId}`
    );
    // Consider if revalidation is needed here or handled by caller after re-fetching lists
    // For now, not revalidating tags from this specific delete action directly.
    return {
      success: true,
      message: `Successfully deleted opportunity ${opportunityId}.`,
    };
  } catch (error) {
    console.error(
      `[Action] Error deleting processed opportunity ${opportunityId}:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to delete opportunity ${opportunityId}.`,
      error: errorMessage,
    };
  }
}

// --- New Action to Delete Multiple Processed Opportunities ---
interface DeleteMultipleProcessedOpportunitiesResult {
  success: boolean;
  deletedCount: number;
  failedCount: number;
  message: string;
  errors: { id: string; error: string }[];
}

export async function deleteMultipleProcessedOpportunitiesAction(
  opportunityIds: string[]
): Promise<DeleteMultipleProcessedOpportunitiesResult> {
  if (!db) {
    console.error(
      "[Action] Firestore DB not available for deleting multiple opportunities."
    );
    return {
      success: false,
      deletedCount: 0,
      failedCount: opportunityIds.length,
      message: "Database not available.",
      errors: opportunityIds.map((id) => ({
        id,
        error: "Database not available.",
      })),
    };
  }
  if (!opportunityIds || opportunityIds.length === 0) {
    return {
      success: true, // Technically successful, nothing to delete
      deletedCount: 0,
      failedCount: 0,
      message: "No opportunity IDs provided for deletion.",
      errors: [],
    };
  }

  const PROCESSED_OPP_COLLECTION = COLLECTIONS.PROCESSED_OPPORTUNITY;
  if (!PROCESSED_OPP_COLLECTION) {
    return {
      success: false,
      deletedCount: 0,
      failedCount: opportunityIds.length,
      message: "Processed Opportunity collection name not configured.",
      errors: opportunityIds.map((id) => ({
        id,
        error: "Collection not configured.",
      })),
    };
  }

  let deletedCount = 0;
  const errors: { id: string; error: string }[] = [];

  console.log(
    `[Action] Attempting to delete ${opportunityIds.length} processed opportunities.`
  );

  // Deleting sequentially. Could use Promise.all or batch writes for larger scale.
  for (const id of opportunityIds) {
    if (!id) {
      errors.push({ id: "(empty string)", error: "Empty ID string provided." });
      continue;
    }
    try {
      await db.collection(PROCESSED_OPP_COLLECTION).doc(id).delete();
      deletedCount++;
    } catch (error) {
      console.error(
        `[Action] Error deleting processed opportunity ${id} during multi-delete:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push({ id, error: errorMessage });
    }
  }

  const success = errors.length === 0;
  const message = `Batch Delete Complete: ${deletedCount} deleted successfully, ${errors.length} failed.`;
  console.log(message, errors.length > 0 ? errors : "");

  return {
    success,
    deletedCount,
    failedCount: errors.length,
    message,
    errors,
  };
}

// --- New Action to Get a Single Processed Opportunity by ID ---
interface GetProcessedOpportunityByIdResult {
  opportunity?: ProcessedFirebaseOppourtunity; // Use the Zod-inferred type with Date objects
  error?: string;
}

export async function getProcessedOpportunityByIdAction(
  opportunityId: string
): Promise<GetProcessedOpportunityByIdResult> {
  if (!db) {
    console.error(
      "[Action] Firestore DB not available for fetching opportunity by ID."
    );
    return { error: "Database not available." };
  }
  if (!opportunityId) {
    return { error: "Opportunity ID is required." };
  }

  const PROCESSED_OPP_COLLECTION = COLLECTIONS.PROCESSED_OPPORTUNITY;
  if (!PROCESSED_OPP_COLLECTION) {
    return { error: "Processed Opportunity collection name not configured." };
  }

  try {
    const docRef = db.collection(PROCESSED_OPP_COLLECTION).doc(opportunityId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(
        `[Action] No processed opportunity found with ID: ${opportunityId}`
      );
      return { error: "Opportunity not found." };
    }

    const rawData = docSnap.data();
    // Combine rawData with the document ID before validation (as schema expects it)
    const dataWithId = { ...rawData, id: docSnap.id };

    // Validate and transform to ProcessedFirebaseOppourtunity (with Date objects)
    // Assuming FirebaseOppourtunitySchema is available in this file's scope
    // or imported from data-oppourtunity.ts (which it is)
    const validationResult = FirebaseOppourtunitySchema.safeParse(dataWithId);

    if (!validationResult.success) {
      console.error(
        `[Action] Failed to validate/transform fetched opportunity ${opportunityId}:`,
        validationResult.error.flatten()
      );
      return { error: "Data validation failed for the fetched opportunity." };
    }

    console.log(
      `[Action] Successfully fetched and validated opportunity: ${opportunityId}`
    );
    return { opportunity: validationResult.data };
  } catch (error) {
    console.error(
      `[Action] Error fetching processed opportunity ${opportunityId} by ID:`,
      error
    );
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { error: `Failed to fetch opportunity: ${errorMessage}` };
  }
}
