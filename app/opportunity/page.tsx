"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
  processRandomOpportunityAction,
  getAllOpportunitiesListAction,
  markOpportunityUnavailableAction,
  ProcessAttemptOutcome,
  saveBatchProcessedOpportunitiesAction,
  deleteMultipleProcessedOpportunitiesAction,
  deleteProcessedOpportunityAction,
  processNextOpportunityForSiteAction,
  SuccessDataPayload,
} from "../actions/actions-opportunity";

import { ProcessedFirebaseOpportunity } from "../services/firebase/data-opportunity";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge"; // For status

import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  RefreshCcw, // For Redraw
  PlusCircle, // For Draw New
  Archive, // For history button
  Loader2, // For loading states
  RotateCw, // New icon for redraw all
  ClipboardCopy, // New icon for Copy CSV
  Check, // Icon for copy success
} from "lucide-react"; // Icons
import { toast } from "sonner"; // Import toast for feedback
import { MEDIASITE_DATA } from "@/app/global-config"; // Import site config

// Helper function to check if a date is in the current week (Monday to Sunday)
const isDateInCurrentWeek = (date: Date): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentDayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  // Adjust to make Monday the start of the week (optional, depends on definition of week)
  const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return date >= monday && date <= sunday;
};

// Define GscKeywordMetric for typing to resolve linter errors
interface GscKeywordMetric {
  keyword: string;
  mean_position: number;
  total_impressions: number;
  total_clicks: number;
}

interface AllOpportunitiesListDisplayResult {
  opportunities?: ProcessedFirebaseOpportunity[];
  error?: string;
}

// Interface for author stats
interface AuthorStat {
  author: string;
  count: number;
}

const buttonStyle = {
  padding: "0.5rem 1rem",
  fontSize: "0.9rem",
  cursor: "pointer",
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "0.25rem",
  margin: "0.25rem",
};

// Define batch constants at component level
// const MAX_SUCCESSFUL_ITEMS_PER_BATCH = 3; // No longer used
const TARGET_SUCCESSES_PER_SITE = 2;
const MAX_ATTEMPTS_PER_SITE = 7; // Let's try 7 attempts per site

export default function OpportunityPage() {
  const [isProcessingLottery, startProcessingLotteryTransition] =
    useTransition();
  const [isLoadingList, startLoadingListTransition] = useTransition();
  const [isUpdatingStatus, startUpdatingStatusTransition] = useTransition();
  const [isRedrawingWeek, startRedrawingWeekTransition] = useTransition();
  const [isRedrawingSingle, startRedrawingSingleTransition] = useTransition();
  const [redrawingOppId, setRedrawingOppId] = useState<string | null>(null);
  const [isProcessingSite, setIsProcessingSite] = useState<string | null>(null); // Track which site is being processed

  const [latestAttemptOutcome, setLatestAttemptOutcome] =
    useState<ProcessAttemptOutcome | null>(null);
  const [lastAttemptStatusMessage, setLastAttemptStatusMessage] = useState<
    string | null
  >(null);
  const [lotteryError, setLotteryError] = useState<string | null>(null);
  const [generalMessage, setGeneralMessage] = useState<string | null>(null);

  // New state to store all successful outcomes of the current batch
  const [currentBatchSuccesses, setCurrentBatchSuccesses] = useState<
    Extract<ProcessAttemptOutcome, { status: "success_ready_for_batch" }>[]
  >([]);

  // State for current attempt number (can represent total attempts across sites)
  const [currentAttemptInBatch, setCurrentAttemptInBatch] = useState(0);

  const [allOpportunitiesList, setAllOpportunitiesList] =
    useState<AllOpportunitiesListDisplayResult | null>(null);

  // New state for this week's opportunities and dialog
  const [thisWeeksOpportunities, setThisWeeksOpportunities] = useState<
    ProcessedFirebaseOpportunity[]
  >([]);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  ); // State for copy feedback

  // Add new state for calculated weekly author counts from the table data
  const [calculatedAuthorCounts, setCalculatedAuthorCounts] = useState<
    AuthorStat[]
  >([]);

  // New state for toggling history table
  const [showFullHistory, setShowFullHistory] = useState(false);

  // useEffect to calculate author counts when thisWeeksOpportunities changes
  useEffect(() => {
    if (thisWeeksOpportunities && thisWeeksOpportunities.length > 0) {
      const countsMap = new Map<string, number>();
      thisWeeksOpportunities.forEach((opp) => {
        const author = opp.author || "Unknown Author";
        countsMap.set(author, (countsMap.get(author) || 0) + 1);
      });
      const sortedCounts: AuthorStat[] = Array.from(countsMap.entries())
        .map(([author, count]) => ({ author, count }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.author.localeCompare(b.author);
        });
      setCalculatedAuthorCounts(sortedCounts);
    } else {
      setCalculatedAuthorCounts([]);
    }
  }, [thisWeeksOpportunities]);

  // Effect to filter for this week's opportunities
  useEffect(() => {
    if (allOpportunitiesList?.opportunities) {
      const weekly = allOpportunitiesList.opportunities.filter((opp) =>
        opp.processedAt ? isDateInCurrentWeek(new Date(opp.processedAt)) : false
      );
      setThisWeeksOpportunities(weekly);
    } else {
      setThisWeeksOpportunities([]);
    }
  }, [allOpportunitiesList]);

  const fetchAllOpportunitiesFromFirestore = useCallback(() => {
    setGeneralMessage(null);
    startLoadingListTransition(async () => {
      try {
        const response = await getAllOpportunitiesListAction();
        setAllOpportunitiesList(response);
        if (response.error) {
          setGeneralMessage(
            `Error loading processed opportunities list: ${response.error}`
          );
        } else {
          // Clear message if successful and no error
          setGeneralMessage(null);
        }
      } catch (e) {
        console.error("Failed to fetch all processed opportunities:", e);
        setGeneralMessage(
          e instanceof Error
            ? e.message
            : "Client error fetching processed list."
        );
      }
    });
  }, []);

  // Initial fetch of all opportunities
  useEffect(() => {
    fetchAllOpportunitiesFromFirestore();
  }, [fetchAllOpportunitiesFromFirestore]);

  // --- NEW handleRunLottery (Site-by-Site) ---
  const handleRunLottery = () => {
    setLotteryError(null);
    setLatestAttemptOutcome(null);
    setCurrentBatchSuccesses([]); // Clear display from previous runs
    setLastAttemptStatusMessage(null);
    setCurrentAttemptInBatch(0); // Reset global attempt counter
    setIsProcessingSite(null);

    // Define sites based on config - filter out any potentially invalid entries
    const sitesToProcess = MEDIASITE_DATA.filter(
      (site) => site.url && site.name
    ).map((site) => ({ name: site.name!, urlPrefix: site.url }));

    if (sitesToProcess.length === 0) {
      setGeneralMessage(
        "No target sites configured or found in MEDIASITE_DATA."
      );
      return; // Cannot proceed
    }

    startProcessingLotteryTransition(async () => {
      const allCollectedDataForSaving: SuccessDataPayload[] = [];
      const overallBatchSiteSuccessCounts = new Map<string, number>();
      let totalAttemptsAcrossSites = 0;
      let anyErrorsDuringBatch = false;
      let stopBatchEarly = false;

      setGeneralMessage(
        `Starting structured batch: Aiming for ${TARGET_SUCCESSES_PER_SITE} successes per site (${sitesToProcess.map((s) => s.name).join(", ")}). Max ${MAX_ATTEMPTS_PER_SITE} attempts per site.`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause

      for (const site of sitesToProcess) {
        if (stopBatchEarly) break; // Stop if a critical error occurred

        setIsProcessingSite(site.name); // Update UI indicator
        setGeneralMessage(
          `Processing Site: ${site.name}. Goal: ${TARGET_SUCCESSES_PER_SITE} successes (Max ${MAX_ATTEMPTS_PER_SITE} attempts)`
        );

        let siteSuccesses = 0;
        let siteAttempts = 0;

        while (
          siteSuccesses < TARGET_SUCCESSES_PER_SITE &&
          siteAttempts < MAX_ATTEMPTS_PER_SITE
        ) {
          siteAttempts++;
          totalAttemptsAcrossSites++;
          setCurrentAttemptInBatch(totalAttemptsAcrossSites); // Update overall counter

          const progressMsg = `Site: ${site.name} | Attempt ${siteAttempts}/${MAX_ATTEMPTS_PER_SITE} | Successes ${siteSuccesses}/${TARGET_SUCCESSES_PER_SITE}`;
          setGeneralMessage(progressMsg + " | Processing...");

          try {
            const researchId = `research_${site.name}_${new Date().getTime()}_${siteAttempts}`;
            // Call the new site-specific action
            const response = await processNextOpportunityForSiteAction(
              site.urlPrefix,
              researchId
            );
            setLatestAttemptOutcome(response); // Store last attempt globally

            if (response.status === "success_ready_for_batch") {
              siteSuccesses++;
              allCollectedDataForSaving.push(response.data);
              setCurrentBatchSuccesses((prev) => [...prev, response]); // Update display

              // Update overall count for final summary
              const currentOverallCount =
                (overallBatchSiteSuccessCounts.get(site.name) || 0) + 1;
              overallBatchSiteSuccessCounts.set(site.name, currentOverallCount);

              setLotteryError(null);
              setLastAttemptStatusMessage(null);
              setGeneralMessage(
                `${progressMsg} | COLLECTED: ${response.data.url}`
              );
              // Maybe add a shorter delay after success?
              await new Promise((resolve) => setTimeout(resolve, 500));
            } else if (response.status === "no_new_items") {
              setGeneralMessage(
                `${progressMsg} | No more items available for ${site.name}. Moving to next site.`
              );
              await new Promise((resolve) => setTimeout(resolve, 1000)); // Pause before next site
              break; // Exit inner loop for this site
            } else {
              // Handle error or author_limit_deferred
              anyErrorsDuringBatch = true;
              setLotteryError(
                response.status === "error" ? response.error : null
              );
              setLastAttemptStatusMessage(
                `Site: ${site.name} | Attempt ${siteAttempts} -> ${response.status}: ${response.finalStatusMessage}`
              );
              setGeneralMessage(
                `${progressMsg} | Status: ${response.status}. Continuing...`
              );
              // Longer delay after non-success
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          } catch (e) {
            console.error(
              `Critical client error during processing for site ${site.name}, attempt ${siteAttempts}:`,
              e
            );
            const errorMsg =
              e instanceof Error
                ? e.message
                : "Client error during site processing.";
            setLotteryError(errorMsg);
            setGeneralMessage(
              `CRITICAL ERROR processing ${site.name}. Stopping batch. Error: ${errorMsg}`
            );
            anyErrorsDuringBatch = true;
            stopBatchEarly = true; // Stop processing further sites
            break; // Exit inner loop
          }
        } // End inner while loop (site attempts)

        // Add a check to prevent unnecessary delay if the whole batch was stopped early
        if (!stopBatchEarly) {
          setGeneralMessage(
            `Finished processing site: ${site.name}. Collected ${siteSuccesses}/${TARGET_SUCCESSES_PER_SITE}.`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Pause before next site
        }
      } // End outer for loop (sites)

      setIsProcessingSite(null); // Clear site indicator

      // --- After all sites processed ---
      const finalSiteCountsMsg = Array.from(
        overallBatchSiteSuccessCounts.entries()
      )
        .map(([site, count]) => `${site}: ${count}`)
        .join(", ");

      setGeneralMessage(
        `Batch Finished. Total collected: ${allCollectedDataForSaving.length} opportunities across sites (${finalSiteCountsMsg || "None"}). ` +
          (allCollectedDataForSaving.length > 0
            ? "Proceeding to save..."
            : "Nothing to save.")
      );

      // --- Saving Logic --- //
      let itemsSavedInThisRunCount = 0; // Define here for scope
      if (allCollectedDataForSaving.length > 0) {
        try {
          const batchSaveResult = await saveBatchProcessedOpportunitiesAction(
            allCollectedDataForSaving
          );
          itemsSavedInThisRunCount = batchSaveResult.successCount;
          setGeneralMessage(batchSaveResult.overallMessage);
          if (batchSaveResult.failedCount > 0) {
            console.error("Batch save failures:", batchSaveResult.errors);
            setLotteryError(
              `Batch save: ${batchSaveResult.failedCount} items failed to save.`
            );
          }
          if (batchSaveResult.successCount > 0) {
            await fetchAllOpportunitiesFromFirestore();
          }
        } catch (e) {
          console.error("Critical error during batch save action call:", e);
          const saveErrorMsg =
            e instanceof Error ? e.message : "Client error during batch save.";
          setLotteryError(saveErrorMsg);
          setGeneralMessage(
            `Critical error during batch save: ${saveErrorMsg}`
          );
        }
      }
      // Reset display if nothing was collected or saved
      if (
        allCollectedDataForSaving.length === 0 ||
        itemsSavedInThisRunCount === 0
      ) {
        setCurrentBatchSuccesses([]);
      }
    }); // End startProcessingLotteryTransition
  }; // End handleRunLottery

  const handleRedrawThisWeek = async () => {
    const idsToDelete = thisWeeksOpportunities.map((opp) => opp.id);
    if (idsToDelete.length === 0) {
      setGeneralMessage("Nothing to redraw for this week.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to redraw this week? This will delete all ${idsToDelete.length} opportunities listed for this week and attempt to draw a new batch.`
      )
    ) {
      return;
    }

    setGeneralMessage(
      `Deleting ${idsToDelete.length} opportunities from this week...`
    );
    setLotteryError(null);
    setCurrentBatchSuccesses([]); // Clear any previous batch display

    startRedrawingWeekTransition(async () => {
      const deleteResult =
        await deleteMultipleProcessedOpportunitiesAction(idsToDelete);

      if (deleteResult.success) {
        setGeneralMessage(
          `Successfully deleted ${deleteResult.deletedCount} opportunities. Now attempting to draw a new batch...`
        );
        // Automatically trigger the lottery draw after successful deletion
        handleRunLottery();
      } else {
        setGeneralMessage(
          `Failed to delete all weekly opportunities (${deleteResult.failedCount} failures). ${deleteResult.message}. Please refresh and try again, or run a normal lottery draw.`
        );
        setLotteryError(
          deleteResult.errors.map((e) => `ID ${e.id}: ${e.error}`).join("; ")
        );
        // Refresh the list to show the current state after partial failure
        await fetchAllOpportunitiesFromFirestore();
      }
    });
  };

  const handleMarkUnavailable = (url: string) => {
    if (!url) return;
    setGeneralMessage(null);
    startUpdatingStatusTransition(async () => {
      try {
        const response = await markOpportunityUnavailableAction(
          url,
          "user_marked_unavailable"
        );
        setGeneralMessage(response.message);
        if (response.success) {
          fetchAllOpportunitiesFromFirestore();
        }
      } catch (e) {
        console.error("Failed to mark opportunity unavailable:", e);
        setGeneralMessage(
          e instanceof Error ? e.message : "Client error marking unavailable."
        );
      }
    });
  };

  // Helper to determine alert variant based on current states
  const getMainAlertVariant = () => {
    if (lotteryError) return "destructive";
    if (latestAttemptOutcome?.status === "error") return "destructive";
    // Could add more variants here, e.g. success
    return "default"; // Default to informational
  };

  const mainAlertTitle = () => {
    if (lotteryError) return "Batch Error";
    if (latestAttemptOutcome?.status === "error") return "Attempt Error";
    return "Batch Update";
  };

  // Function to safely escape string for CSV
  const escapeCsvField = (
    field: string | number | undefined | null
  ): string => {
    if (field === null || typeof field === "undefined") {
      return "";
    }
    const stringField = String(field);
    const escapedField = stringField.replace(/"/g, '""');
    // Only add quotes if the string contains a comma, a quote, or a newline
    if (
      stringField.includes(",") ||
      stringField.includes('"') ||
      stringField.includes("\n")
    ) {
      return `"${escapedField}"`;
    }
    return escapedField; // Return as is if no special characters
  };

  // Handler for Copy to CSV
  const handleCopyToCsv = async () => {
    if (thisWeeksOpportunities.length === 0) {
      toast.error("No opportunities available this week to copy.");
      return;
    }

    // Construct base URL - Note: This relies on window object
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const header =
      [
        "Author",
        "AI Primary Keyword",
        "AI Primary Keyword Volume",
        "AI Related Keyword 1",
        "AI Related Keyword 2",
        "Original CSV Keyword",
        "Tracking Rank",
        "URL", // Original URL
        "Drawn Date",
        "Advice URL", // <-- Added Advice URL header
      ]
        .map(escapeCsvField)
        .join(",") + "\n";

    const rows = thisWeeksOpportunities
      .map((opp) => {
        const author = opp.author || "N/A";
        const aiPrimaryKeyword = opp.keywordGroup?.aiPrimaryKeyword || "";
        const aiPrimaryKeywordVolume =
          opp.keywordGroup?.aiPrimaryKeywordVolume ?? "N/A";
        const aiRelatedKeyword1 =
          opp.keywordGroup?.aiRelatedKeyword1 &&
          opp.keywordGroup.aiRelatedKeyword1 !== "N/A"
            ? opp.keywordGroup.aiRelatedKeyword1
            : "";
        const aiRelatedKeyword2 =
          opp.keywordGroup?.aiRelatedKeyword2 &&
          opp.keywordGroup.aiRelatedKeyword2 !== "N/A"
            ? opp.keywordGroup.aiRelatedKeyword2
            : "";
        const originalCsvKeyword = opp.originalCsvKeyword || "";
        const trackingRank = opp.originalCsvKeywordRank ?? "N/A";
        const url = opp.url;
        const drawnDate = opp.processedAt
          ? new Date(opp.processedAt).toLocaleDateString()
          : "N/A";
        const adviceUrl = `${baseUrl}/opportunity/${opp.id}`; // <-- Construct Advice URL

        return [
          author,
          aiPrimaryKeyword,
          String(aiPrimaryKeywordVolume),
          aiRelatedKeyword1,
          aiRelatedKeyword2,
          originalCsvKeyword,
          String(trackingRank),
          url,
          drawnDate,
          adviceUrl, // <-- Add adviceUrl data
        ]
          .map(escapeCsvField)
          .join(",");
      })
      .join("\n");

    const csvString = header + rows;

    try {
      await navigator.clipboard.writeText(csvString);
      setCopyStatus("copied");
      toast.success(
        `Copied ${thisWeeksOpportunities.length} opportunities (full weekly draw data) to clipboard!`
      );
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy CSV to clipboard:", err);
      setCopyStatus("error");
      toast.error("Failed to copy to clipboard. See console for details.");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  };

  // Handler for redrawing (deleting) a single opportunity
  const handleRedrawSingle = (oppId: string) => {
    if (!oppId) return;
    if (
      !confirm(
        `Are you sure you want to redraw opportunity ${oppId}? This will delete it.`
      )
    ) {
      return;
    }
    setGeneralMessage(null); // Clear general messages
    setLotteryError(null);
    setRedrawingOppId(oppId); // Set the ID being redrawn

    startRedrawingSingleTransition(async () => {
      try {
        // Call the delete action directly
        const response = await deleteProcessedOpportunityAction(oppId);

        if (response.success) {
          toast.success(response.message + " List has been updated.");
          // Revalidation should trigger a refresh, but fetch again for certainty
          await fetchAllOpportunitiesFromFirestore();
        } else {
          toast.error(`Delete failed: ${response.error || response.message}`);
        }
      } catch (e) {
        console.error(`Failed to delete opportunity ${oppId}:`, e);
        toast.error(
          e instanceof Error ? e.message : "Client error during single delete."
        );
      } finally {
        setRedrawingOppId(null); // Clear the ID being redrawn
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-10">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">
          Opportunity Dashboard
        </h1>
        <p className="text-lg text-gray-600">
          Manage and process new content opportunities.
        </p>
      </header>

      {(generalMessage || lotteryError) && (
        <Alert
          variant={getMainAlertVariant()}
          className={`mb-6 ${getMainAlertVariant() === "destructive" ? "" : "border-blue-500 text-blue-700"}`}
        >
          {getMainAlertVariant() === "destructive" ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <Info className="h-5 w-5" />
          )}
          <AlertTitle className="font-semibold">{mainAlertTitle()}</AlertTitle>
          <AlertDescription>
            {generalMessage}
            {lotteryError && latestAttemptOutcome?.status !== "error" && (
              <p className="mt-1">Specific error: {lotteryError}</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {lastAttemptStatusMessage &&
        !lotteryError &&
        latestAttemptOutcome?.status !== "no_new_items" && (
          <Alert
            variant="default"
            className="mb-6 border-yellow-400 bg-yellow-50 text-yellow-700"
          >
            <Info className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="font-semibold text-yellow-800">
              Last Individual Attempt
            </AlertTitle>
            <AlertDescription>{lastAttemptStatusMessage}</AlertDescription>
          </Alert>
        )}

      <section className="space-y-6">
        <header className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-3xl font-semibold text-gray-700">
            This Week's Draws
          </h2>
          <div className="flex flex-wrap gap-2">
            {thisWeeksOpportunities.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToCsv}
                disabled={copyStatus !== "idle"}
              >
                {copyStatus === "copied" ? (
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                )}
                {copyStatus === "copied"
                  ? "Copied!"
                  : copyStatus === "error"
                    ? "Copy Error"
                    : "Copy Week's Draws"}
              </Button>
            )}
            {thisWeeksOpportunities.length > 0 && (
              <Button
                variant="destructive"
                onClick={handleRedrawThisWeek}
                disabled={
                  isRedrawingWeek ||
                  isProcessingLottery ||
                  isLoadingList ||
                  isUpdatingStatus
                }
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isRedrawingWeek ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCw className="mr-2 h-4 w-4" />
                )}
                Redraw All ({thisWeeksOpportunities.length})
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => fetchAllOpportunitiesFromFirestore()}
              disabled={isLoadingList || isProcessingLottery || isRedrawingWeek}
            >
              {isLoadingList ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh List
            </Button>
          </div>
        </header>

        {isLoadingList && thisWeeksOpportunities.length === 0 && (
          <p className="text-center text-gray-500 py-4">
            Loading weekly opportunities...
          </p>
        )}
        {!isLoadingList && thisWeeksOpportunities.length === 0 && (
          <Card className="text-center py-8 border-dashed border-gray-300">
            <CardHeader>
              <CardTitle className="text-xl text-gray-600">
                No Opportunities Drawn This Week Yet
              </CardTitle>
              <CardDescription className="text-gray-500">
                Run the lottery below to draw new opportunities for this week!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                onClick={handleRunLottery}
                disabled={isProcessingLottery}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white shadow-lg animate-pulse"
              >
                <PlusCircle className="mr-2 h-5 w-5" /> Draw First Batch for the
                Week!
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Table Display for This Week's Opportunities - NOW USING HISTORY TABLE FORMAT */}
        {!isLoadingList && thisWeeksOpportunities.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Title / URL
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Author
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    AI Keyword (Vol)
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    All Keywords
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Tracking Keyword (CSV Vol)
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Tracking Rank
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Drawn Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    GSC Info
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {thisWeeksOpportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-normal text-sm font-medium text-gray-900 max-w-md break-words">
                      <Link
                        href={`/opportunity/${opp.id}`}
                        legacyBehavior={false}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {opp.scrapedTitle || decodeURIComponent(opp.url)}
                      </Link>
                      {opp.scrapedTitle && (
                        <p className="text-xs text-gray-500 mt-1">
                          {decodeURIComponent(opp.url)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {opp.author || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {opp.keywordGroup?.aiPrimaryKeyword || (
                        <span className="text-gray-400 italic">
                          {opp.originalCsvKeyword}
                        </span>
                      )}
                      {opp.keywordGroup?.aiPrimaryKeywordVolume !== null &&
                        opp.keywordGroup?.aiPrimaryKeywordVolume !==
                          undefined && (
                          <span className="ml-2 text-xs text-gray-500">
                            (
                            {opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()}
                            )
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      <ul className="space-y-0.5">
                        {opp.keywordGroup?.aiPrimaryKeyword && (
                          <li>
                            <strong>AI:</strong>{" "}
                            {opp.keywordGroup.aiPrimaryKeyword}
                          </li>
                        )}
                        {opp.keywordGroup?.aiRelatedKeyword1 &&
                          opp.keywordGroup.aiRelatedKeyword1 !== "N/A" && (
                            <li>
                              <strong>R1:</strong>{" "}
                              {opp.keywordGroup.aiRelatedKeyword1}
                            </li>
                          )}
                        {opp.keywordGroup?.aiRelatedKeyword2 &&
                          opp.keywordGroup.aiRelatedKeyword2 !== "N/A" && (
                            <li>
                              <strong>R2:</strong>{" "}
                              {opp.keywordGroup.aiRelatedKeyword2}
                            </li>
                          )}
                        <li>
                          <strong>CSV:</strong> {opp.originalCsvKeyword}
                        </li>
                      </ul>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {opp.originalCsvKeyword || (
                        <span className="text-gray-400 italic">(N/A)</span>
                      )}
                      {typeof opp.csvVolume === "number" && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({opp.csvVolume.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {opp.originalCsvKeywordRank ?? (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Badge
                        variant={
                          opp.status === "analyzed"
                            ? "default"
                            : opp.status === "marked_unavailable"
                              ? "outline"
                              : "secondary"
                        }
                        className={`text-xs ${
                          opp.status === "analyzed"
                            ? "bg-blue-100 text-blue-700"
                            : opp.status === "marked_unavailable"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {opp.status || "analyzed"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opp.processedAt
                        ? new Date(opp.processedAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {opp.gscKeywords && opp.gscKeywords.length > 0 ? (
                        <Collapsible>
                          <CollapsibleTrigger className="text-xs text-blue-600 hover:underline flex items-center">
                            <ChevronDown className="h-3 w-3 mr-1" /> Show GSC (
                            {opp.gscKeywords.length})
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <ul className="mt-1 pl-2 list-disc space-y-0.5 text-[10px] max-h-32 overflow-y-auto scrollbar-thin p-1 bg-gray-50 rounded border">
                              {opp.gscKeywords
                                .slice(0, 5)
                                .map((kw: GscKeywordMetric, idx: number) => (
                                  <li
                                    key={idx}
                                  >{`"${kw.keyword}" P:${kw.mean_position.toFixed(0)} I:${kw.total_impressions} C:${kw.total_clicks}`}</li>
                                ))}
                              {opp.gscKeywords.length > 5 && (
                                <li>
                                  ...and {opp.gscKeywords.length - 5} more
                                </li>
                              )}
                            </ul>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        <span className="text-xs italic">No GSC</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 flex items-center">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/opportunity/${opp.id}`}
                          legacyBehavior={false}
                        >
                          View Details
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRedrawSingle(opp.id)}
                        disabled={
                          isProcessingLottery ||
                          isRedrawingWeek ||
                          isRedrawingSingle ||
                          redrawingOppId === opp.id
                        }
                        className="text-orange-600 border-orange-400 hover:bg-orange-50 hover:text-orange-700 h-8 px-2 text-xs"
                        title="Delete this opportunity"
                      >
                        {redrawingOppId === opp.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="mr-1 h-3 w-3" />
                        )}
                        Redraw
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Calculated Author Performance Display (Below This Week's Table) */}
        {!isLoadingList && calculatedAuthorCounts.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-md font-semibold text-gray-600 mb-2">
              Author Submissions This Week (from table):
            </h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {calculatedAuthorCounts.map((stat) => (
                <li key={stat.author}>
                  <strong>{stat.author}:</strong> {stat.count} opportunity(s)
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* End Calculated Author Performance */}
      </section>

      <section className="my-12 py-10 bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-xl shadow-2xl border border-purple-200">
        <div className="container mx-auto text-center px-6">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4">
            Ready for New Opportunities?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Click the button below to start the automated process. The system
            will find, scrape, analyze (with AI!), and prepare up to{" "}
            {TARGET_SUCCESSES_PER_SITE} new content opportunities for you.
          </p>
          <Button
            size="lg"
            onClick={handleRunLottery}
            disabled={isProcessingLottery || isLoadingList || isUpdatingStatus}
            className="px-10 py-6 text-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-xl transform hover:scale-105 transition-transform duration-300 focus:ring-4 focus:ring-pink-300"
          >
            {isProcessingLottery ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Processing Batch
                {isProcessingSite && ` (Site: ${isProcessingSite})`}
                ... Attempt {currentAttemptInBatch} ...
                {currentBatchSuccesses.length > 0 &&
                  ` (${currentBatchSuccesses.length} Collected)`}
              </>
            ) : (
              <>
                <PlusCircle className="mr-3 h-6 w-6" /> Draw New Opportunity
                Batch
              </>
            )}
          </Button>

          {currentBatchSuccesses.length > 0 && (
            <div className="mt-8 pt-6 border-t border-purple-200 space-y-4 max-w-4xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-700">
                Collected in Current Draw ({currentBatchSuccesses.length}):
              </h3>
              {currentBatchSuccesses.map((item, index) => (
                <Card
                  key={`batch-${item.data.url || index}`}
                  className="text-left bg-white/80 backdrop-blur-sm shadow-md hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-md font-medium text-purple-700">
                          {item.data.scrapedTitle ||
                            decodeURIComponent(item.data.url)}
                        </CardTitle>
                        <CardDescription className="text-xs text-purple-600">
                          Keyword: {item.data.originalCsvKeyword} | Author:{" "}
                          {item.data.author || "N/A"}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-purple-100 text-purple-700 border-purple-300"
                      >
                        <CheckCircle className="mr-1 h-3 w-3" /> Ready
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs pb-4">
                    <p className="text-gray-600 mb-2 text-ellipsis overflow-hidden whitespace-nowrap">
                      <Info className="inline h-3 w-3 mr-1" />{" "}
                      {item.finalStatusMessage}
                    </p>
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-purple-600 hover:bg-purple-100 hover:text-purple-700 justify-start pl-0"
                        >
                          <ChevronDown className="h-4 w-4 mr-1 collaps-icon-closed" />
                          <ChevronUp className="h-4 w-4 mr-1 collaps-icon-open" />
                          Show Details
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="p-3 bg-purple-50/70 rounded-md border border-purple-200 space-y-1 text-gray-700">
                          <p>
                            <strong>URL:</strong>{" "}
                            <a
                              href={item.data.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline break-all"
                            >
                              {decodeURIComponent(item.data.url)}
                            </a>
                          </p>
                          {item.data.scrapedExcerpt && (
                            <p>
                              <strong>Excerpt:</strong>{" "}
                              <span className="italic">
                                {item.data.scrapedExcerpt.substring(0, 100)}...
                              </span>
                            </p>
                          )}
                          {item.data.gscKeywords &&
                          item.data.gscKeywords.length > 0 ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-purple-600 hover:underline">
                                Detailed GSC Keywords (
                                {item.data.gscKeywords.length})
                              </summary>
                              <ul className="mt-1 pl-4 list-disc space-y-0.5 max-h-32 overflow-y-auto scrollbar-thin">
                                {item.data.gscKeywords.map(
                                  (kw: GscKeywordMetric, idx: number) => (
                                    <li
                                      key={idx}
                                    >{`"${kw.keyword}" (Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks})`}</li>
                                  )
                                )}
                              </ul>
                            </details>
                          ) : (
                            <p className="text-xs italic text-gray-500">
                              No GSC keyword data processed for this item.
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Full History Section (Replaces Author Stats & History Section) */}
      <section className="mt-10 pt-6 border-t">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h3 className="text-2xl font-semibold text-gray-700">
            Opportunity History
          </h3>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setShowFullHistory((prev) => !prev)}
            disabled={isLoadingList}
          >
            {isLoadingList ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : showFullHistory ? (
              <ChevronUp className="mr-2 h-5 w-5" />
            ) : (
              <Archive className="mr-2 h-5 w-5" />
            )}
            {showFullHistory ? "Hide Full History" : "Show Full History"}
            {allOpportunitiesList?.opportunities &&
              ` (${allOpportunitiesList.opportunities.length})`}
          </Button>
        </div>

        {showFullHistory && (
          <>
            {isLoadingList &&
              (!allOpportunitiesList ||
                !allOpportunitiesList.opportunities) && (
                <p className="text-center text-gray-500 py-4">
                  Loading history...
                </p>
              )}
            {allOpportunitiesList && allOpportunitiesList.error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Loading History</AlertTitle>
                <AlertDescription>
                  {allOpportunitiesList.error}
                </AlertDescription>
              </Alert>
            )}
            {allOpportunitiesList?.opportunities &&
              allOpportunitiesList.opportunities.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No processed opportunities found in Firestore.
                </p>
              )}
            {allOpportunitiesList?.opportunities &&
              allOpportunitiesList.opportunities.length > 0 && (
                <div className="overflow-x-auto bg-white shadow-md rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Title / URL
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Author
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          AI Keyword (Vol)
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          All Keywords
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Tracking Keyword (CSV Vol)
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Tracking Rank
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Drawn Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          GSC Info
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allOpportunitiesList.opportunities.map((opp) => (
                        <tr key={opp.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-normal text-sm font-medium text-gray-900 max-w-md break-words">
                            <Link
                              href={`/opportunity/${opp.id}`}
                              legacyBehavior={false}
                              className="text-indigo-600 hover:text-indigo-800 hover:underline"
                            >
                              {opp.scrapedTitle || decodeURIComponent(opp.url)}
                            </Link>
                            {opp.scrapedTitle && (
                              <p className="text-xs text-gray-500 mt-1">
                                {decodeURIComponent(opp.url)}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {opp.author || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {opp.keywordGroup?.aiPrimaryKeyword || (
                              <span className="text-gray-400 italic">
                                {opp.originalCsvKeyword}
                              </span>
                            )}
                            {opp.keywordGroup?.aiPrimaryKeywordVolume !==
                              null &&
                              opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                undefined && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (
                                  {opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()}
                                </span>
                              )}
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-600">
                            <ul className="space-y-0.5">
                              {opp.keywordGroup?.aiPrimaryKeyword && (
                                <li>
                                  <strong>AI:</strong>{" "}
                                  {opp.keywordGroup.aiPrimaryKeyword}
                                </li>
                              )}
                              {opp.keywordGroup?.aiRelatedKeyword1 &&
                                opp.keywordGroup.aiRelatedKeyword1 !==
                                  "N/A" && (
                                  <li>
                                    <strong>R1:</strong>{" "}
                                    {opp.keywordGroup.aiRelatedKeyword1}
                                  </li>
                                )}
                              {opp.keywordGroup?.aiRelatedKeyword2 &&
                                opp.keywordGroup.aiRelatedKeyword2 !==
                                  "N/A" && (
                                  <li>
                                    <strong>R2:</strong>{" "}
                                    {opp.keywordGroup.aiRelatedKeyword2}
                                  </li>
                                )}
                              <li>
                                <strong>CSV:</strong> {opp.originalCsvKeyword}
                              </li>
                            </ul>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {opp.originalCsvKeyword || (
                              <span className="text-gray-400 italic">
                                (N/A)
                              </span>
                            )}
                            {typeof opp.csvVolume === "number" && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({opp.csvVolume.toLocaleString()})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            {opp.originalCsvKeywordRank ?? (
                              <span className="text-gray-400 italic">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Badge
                              variant={
                                opp.status === "analyzed"
                                  ? "default"
                                  : opp.status === "marked_unavailable"
                                    ? "outline"
                                    : "secondary"
                              }
                              className={`text-xs ${opp.status === "analyzed" ? "bg-blue-100 text-blue-700" : opp.status === "marked_unavailable" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}
                            >
                              {opp.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {opp.processedAt
                              ? new Date(opp.processedAt).toLocaleString()
                              : "N/A"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {opp.gscKeywords && opp.gscKeywords.length > 0 ? (
                              <Collapsible>
                                <CollapsibleTrigger className="text-xs text-blue-600 hover:underline flex items-center">
                                  <ChevronDown className="h-3 w-3 mr-1" /> Show
                                  GSC ({opp.gscKeywords.length})
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <ul className="mt-1 pl-2 list-disc space-y-0.5 text-[10px] max-h-32 overflow-y-auto scrollbar-thin p-1 bg-gray-50 rounded border">
                                    {opp.gscKeywords
                                      .slice(0, 5)
                                      .map(
                                        (kw: GscKeywordMetric, idx: number) => (
                                          <li
                                            key={idx}
                                          >{`"${kw.keyword}" P:${kw.mean_position.toFixed(0)} I:${kw.total_impressions} C:${kw.total_clicks}`}</li>
                                        )
                                      )}
                                    {opp.gscKeywords.length > 5 && (
                                      <li>
                                        ...and {opp.gscKeywords.length - 5} more
                                      </li>
                                    )}
                                  </ul>
                                </CollapsibleContent>
                              </Collapsible>
                            ) : (
                              <span className="text-xs italic">No GSC</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 flex items-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/opportunity/${opp.id}`}
                                legacyBehavior={false}
                              >
                                View
                              </Link>
                            </Button>
                            {opp.status !== "marked_unavailable" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 border-red-400 hover:bg-red-50 hover:text-red-600 h-8 px-2 text-xs"
                                onClick={() => handleMarkUnavailable(opp.url)}
                                disabled={
                                  isUpdatingStatus || isProcessingLottery
                                }
                              >
                                <XCircle className="mr-1 h-3 w-3" /> M.U.
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </section>

      {latestAttemptOutcome &&
        (latestAttemptOutcome.status === "error" ||
          latestAttemptOutcome.status === "author_limit_deferred" ||
          latestAttemptOutcome.status === "no_new_items") &&
        !currentBatchSuccesses.find(
          (s) =>
            s.data.url === (latestAttemptOutcome as any).urlAttempted ||
            s.data.url === (latestAttemptOutcome as any).urlSkipped
        ) &&
        !lotteryError &&
        !lastAttemptStatusMessage && (
          <Alert
            variant={
              latestAttemptOutcome.status === "error"
                ? "destructive"
                : "default"
            }
            className={`mt-6 ${latestAttemptOutcome.status !== "error" ? "border-yellow-400 bg-yellow-50 text-yellow-700" : ""}`}
          >
            {latestAttemptOutcome.status === "error" ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4 text-yellow-600" />
            )}
            <AlertTitle
              className={`${latestAttemptOutcome.status !== "error" ? "text-yellow-800" : ""}`}
            >
              Update from Last Individual Attempt (
              {latestAttemptOutcome.status === "error"
                ? latestAttemptOutcome.urlAttempted &&
                  decodeURIComponent(latestAttemptOutcome.urlAttempted)
                : latestAttemptOutcome.status === "author_limit_deferred"
                  ? latestAttemptOutcome.urlSkipped &&
                    decodeURIComponent(latestAttemptOutcome.urlSkipped)
                  : "No New Items"}
              )
            </AlertTitle>
            <AlertDescription>
              {latestAttemptOutcome.finalStatusMessage}
              {latestAttemptOutcome.status === "error" &&
                latestAttemptOutcome.error && (
                  <p className="font-semibold mt-1">
                    Details: {latestAttemptOutcome.error}
                  </p>
                )}
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
}
