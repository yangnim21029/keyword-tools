"use server";

import {
  getNewAvailableOpportunitiesFromCsv,
  saveProcessedOpportunity,
  getAllProcessedOpportunities,
  markUrlAsUnavailable,
  updateProcessedOpportunity,
  // FirebaseOpportunity, // Raw type, actions will use the processed type
  OpportunityFromCsv,
  OpportunityStatus,
  ProcessedFirebaseOpportunity, // Import the type with Date objects
  getProcessedOpportunitiesCountByAuthorAndWeek, // <-- Import new helper
  FirebaseOpportunitySchema, // <--- ADD THIS IMPORT
  getOpportunitiesFromCsv, // <<<< ENSURE THIS IS EXPORTED AND IMPORTED
} from "../services/firebase/data-opportunity";
import { extractArticleContentFromUrl } from "../services/scrape.service";
import { GscKeywordMetrics } from "../services/firebase/schema"; // <-- ADD THIS IMPORT
import {
  addOnPageResult,
  // getOnPageResultsByAuthorAndWeek,
} from "../services/firebase/data-onpage-result";
import { analyzeKeywordsWithAiAction, KeywordGroup } from "./actions-ai-audit";
import { fetchGscKeywordsForUrl } from "../services/gsc-keywords.service";
import { db, COLLECTIONS } from "../services/firebase/db-config";
import { Timestamp, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { MEDIASITE_DATA } from "../global-config"; // <-- Import MEDIASITE_DATA
import {
  getSearchVolume,
  getRelatedKeywordIdeas,
} from "../services/keyword-idea-api.service"; // <-- Import Ads volume service and related keywords
import { revalidatePath } from "next/cache"; // Needed for revalidation

// List of authors to ignore (case-insensitive)
const IGNORED_AUTHORS_LOWERCASE = ["hai taeng", "miki", "bernice"];

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
          ProcessedFirebaseOpportunity,
          "id" | "createdAt" | "updatedAt" | "processedAt"
        > & {
          originalCsvKeyword: string;
          csvVolume?: number;
          url: string;
          status: Extract<OpportunityStatus, "analyzed">;
        };
        finalStatusMessage: string;
      }
    | {
        status: "author_limit_deferred";
        finalStatusMessage: string;
        urlSkipped: string;
      }
    | {
        status: "author_ignored"; // New status for explicitly ignored authors
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
export type SuccessDataPayload = Extract<
  ProcessAttemptOutcome,
  { status: "success_ready_for_batch" }
>["data"];

interface AllOpportunitiesListResult {
  opportunities?: ProcessedFirebaseOpportunity[]; // Use ProcessedFirebaseOpportunity
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

// --- NEW Core Helper: Processes a single CSV Opportunity ---
async function processSingleCsvItem(
  csvCandidate: OpportunityFromCsv,
  researchId: string,
  ignoredAuthors: string[]
): Promise<ProcessAttemptOutcome> {
  let onPageResultId: string | null = null;
  let authorToSave: string | undefined = undefined;

  console.log(
    `[processSingleCsvItem] Processing URL: ${csvCandidate.url}, Keyword: ${csvCandidate.keyword}, Research ID: ${researchId}`
  );

  try {
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

    // **** Author Ignore Check (before weekly limit) ****
    if (authorToSave && ignoredAuthors.includes(authorToSave.toLowerCase())) {
      console.log(
        `[processSingleCsvItem] Author ${authorToSave} for ${csvCandidate.url} is on ignore list. Skipping.`
      );
      return {
        status: "author_ignored",
        finalStatusMessage: `Author ${authorToSave} on ignore list for ${csvCandidate.url}.`,
        urlSkipped: csvCandidate.url,
      };
    }

    // **** Author Weekly Limit Check ****
    const authorLimitReached = await checkAuthorWeeklyLimit(
      authorToSave,
      researchId
    );
    if (authorLimitReached) {
      return {
        status: "author_limit_deferred",
        finalStatusMessage: `Author ${authorToSave || "N/A"} weekly limit for ${csvCandidate.url}. Item deferred.`,
        urlSkipped: csvCandidate.url,
      };
    }

    const dataForBatch: SuccessDataPayload = {
      url: csvCandidate.url,
      originalCsvKeyword: csvCandidate.keyword,
      csvVolume: csvCandidate.volume,
      originalCsvKeywordRank: csvCandidate.currentPosition,
      status: "analyzed",
      onPageResultId: onPageResultId!,
      scrapedTitle: scrapedData.title ?? undefined,
      scrapedExcerpt: scrapedData.excerpt ?? undefined,
      scrapedSiteName: scrapedData.siteName ?? undefined,
      keywordGroup: undefined,
      author: authorToSave,
      researchId: researchId,
      gscKeywords: undefined, // Will be EnrichedKeywordData[]
    };

    // --- Step 1: Fetch GSC Keywords ---
    let gscFetchStatusMessage = "";
    let rawGscKeywords: GscKeywordMetrics[] | undefined = undefined;
    try {
      const gscKeywordsResult = await fetchGscKeywordsForUrl(csvCandidate.url);
      if (!("error" in gscKeywordsResult)) {
        rawGscKeywords = gscKeywordsResult;
        gscFetchStatusMessage =
          rawGscKeywords.length > 0
            ? ` (Fetched ${rawGscKeywords.length} GSC keywords)`
            : " (No GSC keywords found)";
        console.log(
          `[processSingleCsvItem] ${gscFetchStatusMessage} for ${csvCandidate.url}`
        );
      } else {
        gscFetchStatusMessage = ` (GSC fetch failed: ${gscKeywordsResult.error})`;
        console.warn(
          `[processSingleCsvItem] GSC fetch failed for ${csvCandidate.url}: ${gscKeywordsResult.error}`,
          gscKeywordsResult.details
        );
      }
    } catch (gscError) {
      gscFetchStatusMessage = " (GSC fetch error)";
      console.error(
        `[processSingleCsvItem] GSC fetch error for ${csvCandidate.url}:`,
        gscError
      );
    }

    // --- Step 2: Prepare Keywords & Get Ads Volume/Ideas ---
    let enrichedKeywordsForAI: EnrichedKeywordData[] = [];
    let adsFetchStatusMessage = "";
    const siteInfo = findMediaSiteInfo(csvCandidate.url);
    const region = siteInfo.region;
    const language = siteInfo.language;

    if (rawGscKeywords && rawGscKeywords.length > 0) {
      const topGscKeywords = [...rawGscKeywords]
        .sort((a, b) => a.mean_position - b.mean_position)
        .slice(0, 20);
      const topKeywordStrings = topGscKeywords.map((k) => k.keyword);

      if (region && language && topKeywordStrings.length > 0) {
        console.log(
          `[processSingleCsvItem/GSC Path] Getting Ads Vol for ${topKeywordStrings.length} GSC keywords (Region: ${region}, Lang: ${language}) for ${csvCandidate.url}`
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
          adsFetchStatusMessage = ` (Ads Vol for ${enrichedKeywordsForAI.length} GSC keywords checked)`;
          console.log(
            `[processSingleCsvItem/GSC Path] Enriched ${enrichedKeywordsForAI.length} GSC keywords with Ads Vol for ${csvCandidate.url}.`
          );
        } catch (adsError) {
          adsFetchStatusMessage = " (Ads Vol fetch error for GSC keywords)";
          console.error(
            `[processSingleCsvItem/GSC Path] Ads Vol error for ${csvCandidate.url}:`,
            adsError
          );
          enrichedKeywordsForAI = topGscKeywords.map((gscKw) => ({
            ...gscKw,
            searchVolume: undefined,
          }));
        }
      } else {
        adsFetchStatusMessage =
          " (Ads Vol skipped for GSC: missing region/lang or no keywords)";
        enrichedKeywordsForAI = topGscKeywords.map((gscKw) => ({
          ...gscKw,
          searchVolume: undefined,
        }));
      }
    } else {
      console.log(
        `[processSingleCsvItem/Fallback Path] GSC failed/empty. Ads fallback using seed: "${csvCandidate.keyword}" for ${csvCandidate.url}`
      );
      adsFetchStatusMessage = " (GSC failed/empty, attempting Ads fallback)";
      if (region && language) {
        try {
          const relatedIdeas = await getRelatedKeywordIdeas({
            seedKeywords: [csvCandidate.keyword],
            region: region,
            language: language,
            maxResults: 20,
          });
          if (relatedIdeas && relatedIdeas.length > 0) {
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
            adsFetchStatusMessage = ` (GSC failed, used ${relatedIdeas.length} related keywords from Ads)`;
          } else {
            adsFetchStatusMessage =
              " (GSC failed, Ads fallback yielded no keywords)";
          }
        } catch (fallbackError) {
          adsFetchStatusMessage = " (GSC failed, Ads fallback fetch error)";
          console.error(
            `[processSingleCsvItem/Fallback Path] Ads fallback error for ${csvCandidate.url}:`,
            fallbackError
          );
        }
      } else {
        adsFetchStatusMessage =
          " (GSC failed, Ads fallback skipped - no region/lang)";
      }
    }

    // --- Step 2b: Filter out zero-volume keywords before sending to AI ---
    const originalCount = enrichedKeywordsForAI.length;
    enrichedKeywordsForAI = enrichedKeywordsForAI.filter(
      (kw) => typeof kw.searchVolume === "number" && kw.searchVolume > 0
    );
    console.log(
      `[processSingleCsvItem] Filtered out zero/null/undefined volume keywords for ${csvCandidate.url}. ` +
        `Before: ${originalCount}, After: ${enrichedKeywordsForAI.length}. (Kept only > 0)`
    );
    // Update dataForBatch.gscKeywords with the filtered list if it changed
    // This is important if dataForBatch.gscKeywords was already assigned the unfiltered list by reference.
    // However, enrichedKeywordsForAI is the one passed to AI, so this direct update is key.
    // If dataForBatch.gscKeywords is intended to store the *final* list sent to AI, it should be updated here:
    dataForBatch.gscKeywords = enrichedKeywordsForAI;

    // --- Step 3: AI Analysis ---
    const aiInputForLlm = {
      scrapedContent: scrapedData,
      originalCsvKeyword: csvCandidate.keyword,
      enrichedKeywords: enrichedKeywordsForAI,
    };
    console.log(
      `[processSingleCsvItem] Passing ${enrichedKeywordsForAI.length} keywords to AI for ${csvCandidate.url}.`
    );
    const aiAnalysisResult = await analyzeKeywordsWithAiAction(aiInputForLlm);

    if ("error" in aiAnalysisResult || !aiAnalysisResult.aiPrimaryKeyword) {
      const errorMsg =
        ("error" in aiAnalysisResult && aiAnalysisResult.error) ||
        "AI analysis returned no keywords";
      // No markUrlAsUnavailable here, let the caller decide or handle based on status
      return {
        status: "error",
        finalStatusMessage: `AI Keyword Analysis failed for ${csvCandidate.url}. Error: ${errorMsg}.${gscFetchStatusMessage}${adsFetchStatusMessage}`,
        error: `AI Analysis Error: ${errorMsg}`,
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
    console.error(
      `[processSingleCsvItem] Critical error for ${csvCandidate.url}:`,
      e
    );
    const errorMsg = e instanceof Error ? e.message : String(e);
    // No markUrlAsUnavailable here, let the caller decide or handle based on status
    return {
      status: "error",
      finalStatusMessage: `Critical Failure during processing for ${csvCandidate.url}. ${errorMsg}. Check logs.`,
      error: errorMsg,
      urlAttempted: csvCandidate.url,
    };
  }
}
// --- END Core Helper ---

export async function processRandomOpportunityAction(
  researchId: string
): Promise<ProcessAttemptOutcome> {
  console.log(
    `[processRandomOpportunityAction] Called. Research ID: ${researchId}`
  );
  try {
    // Get ONE available opportunity from CSV (any site, not yet processed)
    const availableCsvOpportunities =
      await getNewAvailableOpportunitiesFromCsv(1);
    if (!availableCsvOpportunities || availableCsvOpportunities.length === 0) {
      return {
        status: "no_new_items",
        finalStatusMessage:
          "No new opportunities available from CSV to process.",
      };
    }
    const csvCandidate = availableCsvOpportunities[0];
    console.log(
      `[processRandomOpportunityAction] Selected CSV candidate: ${csvCandidate.url}`
    );

    // Process this single CSV item using the new core helper
    const result = await processSingleCsvItem(
      csvCandidate,
      researchId,
      IGNORED_AUTHORS_LOWERCASE
    );

    // If processing failed in a way that makes the URL unusable, mark it.
    if (
      result.status === "error" &&
      (result.error.includes("Scraping error") ||
        result.error.includes("AI Analysis Error"))
    ) {
      try {
        await markUrlAsUnavailable(
          csvCandidate.url,
          `processing_error_in_batch: ${result.error.substring(0, 100)}`
        );
        console.log(
          `[processRandomOpportunityAction] Marked ${csvCandidate.url} as unavailable due to error: ${result.error}`
        );
      } catch (markError) {
        console.error(
          `[processRandomOpportunityAction] Failed to mark ${csvCandidate.url} as unavailable:`,
          markError
        );
      }
    }
    return result;
  } catch (e) {
    console.error("[processRandomOpportunityAction] Critical error:", e);
    const errorMsg = e instanceof Error ? e.message : String(e);
    return {
      status: "error",
      finalStatusMessage: `Critical Failure in processRandomOpportunityAction. ${errorMsg}. Check logs.`,
      error: errorMsg,
      // urlAttempted might not be known here if error is early
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

export async function markOpportunityUnavailableAction(
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
    console.error("Error in markOpportunityUnavailableAction:", e);
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
  opportunity?: ProcessedFirebaseOpportunity; // Use the Zod-inferred type with Date objects
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

    // Validate and transform to ProcessedFirebaseOpportunity (with Date objects)
    // Assuming FirebaseOpportunitySchema is available in this file's scope
    // or imported from data-opportunity.ts (which it is)
    const validationResult = FirebaseOpportunitySchema.safeParse(dataWithId);

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

// Renamed and refactored: was findAndProcessRandomOpportunityFromSitemapInternal
async function findAndProcessRandomOpportunityForSiteInternal(
  siteUrlPrefix: string,
  researchId: string,
  ignoredAuthors: string[]
): Promise<ProcessAttemptOutcome> {
  console.log(
    `[findAndProcessRandomOpportunityForSiteInternal] Site: ${siteUrlPrefix}, Research ID: ${researchId}`
  );

  if (!db) {
    console.error(
      "[findAndProcessRandomOpportunityForSiteInternal] Firestore DB not available."
    );
    return {
      status: "error",
      finalStatusMessage:
        "Database not available. Cannot process opportunity for site.",
      error: "Database not available",
      urlAttempted: siteUrlPrefix,
    };
  }

  try {
    // 1. Get ALL opportunities from CSV
    const allCsvOpportunities = await getOpportunitiesFromCsv(); // Assume this function exists and works
    if (!allCsvOpportunities || allCsvOpportunities.length === 0) {
      return {
        status: "no_new_items",
        finalStatusMessage: "CSV file is empty or could not be loaded.",
      };
    }
    console.log(
      `[findAndProcessRandomOpportunityForSiteInternal] Loaded ${allCsvOpportunities.length} total items from CSV.`
    );

    // 2. Filter by siteUrlPrefix
    const siteSpecificCsvOpportunities = allCsvOpportunities.filter((opp) =>
      opp.url.startsWith(siteUrlPrefix)
    );
    if (siteSpecificCsvOpportunities.length === 0) {
      return {
        status: "no_new_items",
        finalStatusMessage: `No items found in CSV for site prefix: ${siteUrlPrefix}.`,
      };
    }
    console.log(
      `[findAndProcessRandomOpportunityForSiteInternal] Found ${siteSpecificCsvOpportunities.length} items for site ${siteUrlPrefix} in CSV.`
    );

    // 3. Filter out already processed or unavailable URLs
    // Need to fetch all processed and unavailable URLs from Firestore
    // This could be slow if there are many. Consider optimizing if needed.
    const processedDocsSnapshot = await db
      .collection(COLLECTIONS.PROCESSED_OPPORTUNITY!)
      .select("url")
      .get();
    const processedUrls = new Set(
      processedDocsSnapshot.docs.map((doc) => doc.data().url as string)
    );

    const unavailableDocsSnapshot = await db
      .collection(COLLECTIONS.UNAVAILABLE_URLS!)
      .select("url")
      .get();
    const unavailableUrls = new Set(
      unavailableDocsSnapshot.docs.map((doc) => doc.data().url as string)
    );

    console.log(
      `[findAndProcessRandomOpportunityForSiteInternal] Known processed URLs: ${processedUrls.size}, Known unavailable URLs: ${unavailableUrls.size}`
    );

    const availableForSite = siteSpecificCsvOpportunities.filter(
      (opp) => !processedUrls.has(opp.url) && !unavailableUrls.has(opp.url)
    );

    if (availableForSite.length === 0) {
      return {
        status: "no_new_items",
        finalStatusMessage: `All CSV items for ${siteUrlPrefix} are either already processed or marked unavailable.`,
      };
    }
    console.log(
      `[findAndProcessRandomOpportunityForSiteInternal] Found ${availableForSite.length} available items for site ${siteUrlPrefix} from CSV after filtering.`
    );

    // 4. Randomly pick one
    const randomIndex = Math.floor(Math.random() * availableForSite.length);
    const csvCandidate = availableForSite[randomIndex];
    console.log(
      `[findAndProcessRandomOpportunityForSiteInternal] Selected candidate: ${csvCandidate.url}`
    );

    // 5. Process this single CSV item using the core helper
    const result = await processSingleCsvItem(
      csvCandidate,
      researchId,
      ignoredAuthors
    );

    // If processing failed in a way that makes the URL unusable, mark it.
    // This is important so we don't keep trying the same failing URL from CSV for this site.
    if (
      result.status === "error" &&
      (result.error.includes("Scraping error") ||
        result.error.includes("AI Analysis Error"))
    ) {
      try {
        await markUrlAsUnavailable(
          csvCandidate.url,
          `processing_error_for_site_draw: ${result.error.substring(0, 100)}`
        );
        console.log(
          `[findAndProcessRandomOpportunityForSiteInternal] Marked ${csvCandidate.url} as unavailable due to error: ${result.error}`
        );
      } catch (markError) {
        console.error(
          `[findAndProcessRandomOpportunityForSiteInternal] Failed to mark ${csvCandidate.url} as unavailable:`,
          markError
        );
      }
    }
    return result;
  } catch (error) {
    console.error(
      `[findAndProcessRandomOpportunityForSiteInternal] Critical error for site ${siteUrlPrefix}:`,
      error
    );
    return {
      status: "error",
      finalStatusMessage: `Critical error during CSV opportunity processing for site ${siteUrlPrefix}.`,
      error: error instanceof Error ? error.message : "Unknown server error",
      urlAttempted: siteUrlPrefix, // Or a more specific URL if available from candidate
    };
  }
}

export async function processNextOpportunityForSiteAction(
  siteUrlPrefix: string,
  researchId: string
): Promise<ProcessAttemptOutcome> {
  console.log(
    `[processNextOpportunityForSiteAction] Called for site: ${siteUrlPrefix}, researchId: ${researchId}`
  );
  try {
    // Call the renamed and refactored internal function
    const processingResult =
      await findAndProcessRandomOpportunityForSiteInternal(
        // Corrected function name
        siteUrlPrefix,
        researchId,
        IGNORED_AUTHORS_LOWERCASE
      );

    if (processingResult.status === "success_ready_for_batch") {
      revalidatePath("/opportunity");
    }
    return processingResult;
  } catch (error) {
    console.error(
      `[processNextOpportunityForSiteAction] Critical error for site ${siteUrlPrefix}:`,
      error
    );
    return {
      status: "error",
      finalStatusMessage: `Critical error during processing for site ${siteUrlPrefix}.`,
      error: error instanceof Error ? error.message : "Unknown server error",
      urlAttempted: siteUrlPrefix,
    };
  }
}
