"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
  processRandomOppourtunityAction,
  getAllOpportunitiesListAction,
  markOppourtunityUnavailableAction,
  ProcessAttemptOutcome,
  saveBatchProcessedOpportunitiesAction,
  deleteMultipleProcessedOpportunitiesAction,
} from "@/app/actions/actions-oppourtunity";

import { ProcessedFirebaseOppourtunity } from "@/app/services/firebase/data-oppourtunity";
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

interface AllOpportunitiesListDisplayResult {
  opportunities?: ProcessedFirebaseOppourtunity[];
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
const MAX_SUCCESSFUL_ITEMS_PER_BATCH = 3;
const MAX_ATTEMPTS_PER_BATCH = 15;

export default function OppourtunityPage() {
  const [isProcessingLottery, startProcessingLotteryTransition] =
    useTransition();
  const [isLoadingList, startLoadingListTransition] = useTransition();
  const [isUpdatingStatus, startUpdatingStatusTransition] = useTransition();
  const [isRedrawingWeek, startRedrawingWeekTransition] = useTransition();

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

  // State for current attempt number in a batch run
  const [currentAttemptInBatch, setCurrentAttemptInBatch] = useState(0);

  const [allOpportunitiesList, setAllOpportunitiesList] =
    useState<AllOpportunitiesListDisplayResult | null>(null);

  // New state for this week's opportunities and dialog
  const [thisWeeksOpportunities, setThisWeeksOpportunities] = useState<
    ProcessedFirebaseOppourtunity[]
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

  const handleRunLottery = () => {
    setLotteryError(null);
    setLatestAttemptOutcome(null);
    setCurrentBatchSuccesses([]);
    setLastAttemptStatusMessage(null);
    setCurrentAttemptInBatch(0);

    startProcessingLotteryTransition(async () => {
      const collectedDataForSaving: Extract<
        ProcessAttemptOutcome,
        { status: "success_ready_for_batch" }
      >["data"][] = [];
      let attempts = 0;
      let anyErrorsDuringAttempts = false;

      setGeneralMessage(
        `Batch Goal: Process & collect ${MAX_SUCCESSFUL_ITEMS_PER_BATCH} opportunities. Starting...`
      );

      while (
        collectedDataForSaving.length < MAX_SUCCESSFUL_ITEMS_PER_BATCH &&
        attempts < MAX_ATTEMPTS_PER_BATCH
      ) {
        attempts++;
        setCurrentAttemptInBatch(attempts);
        setGeneralMessage(
          `Attempt ${attempts}/${MAX_ATTEMPTS_PER_BATCH}: Processing new opportunity... (Collected ${collectedDataForSaving.length}/${MAX_SUCCESSFUL_ITEMS_PER_BATCH} for this batch)`
        );

        try {
          const researchId = `research_batch_${new Date().getTime()}_${attempts}`;
          const response = await processRandomOppourtunityAction(researchId);
          setLatestAttemptOutcome(response); // Store the very last attempt

          if (response.status === "success_ready_for_batch") {
            collectedDataForSaving.push(response.data);
            // Add to displayed successes for this batch run
            setCurrentBatchSuccesses((prev) => [...prev, response]);
            setLotteryError(null);
            setLastAttemptStatusMessage(null); // Clear previous non-success message
            setGeneralMessage(
              `COLLECTED (${collectedDataForSaving.length}/${MAX_SUCCESSFUL_ITEMS_PER_BATCH}): ${response.finalStatusMessage}`
            );
          } else {
            // Handle non-success cases for the current attempt message
            if (response.status === "error") {
              setLotteryError(response.error); // Set specific error for this attempt
              anyErrorsDuringAttempts = true;
              setLastAttemptStatusMessage(
                `Attempt ${attempts} FAILED: ${response.finalStatusMessage} (Error: ${response.error})`
              );
            } else if (response.status === "author_limit_deferred") {
              setLotteryError(null); // Not an error for the batch, but for this attempt
              setLastAttemptStatusMessage(
                `Attempt ${attempts} Deferred (Author Limit): ${response.finalStatusMessage}`
              );
            } else if (response.status === "no_new_items") {
              setLotteryError(null);
              setLastAttemptStatusMessage(response.finalStatusMessage); // This message is key
              setGeneralMessage(response.finalStatusMessage + " Batch ending.");
              break; // Exit while loop
            }
            // Update general message for batch progress if not 'no_new_items'
            setGeneralMessage(
              `Batch continuing... (Collected ${collectedDataForSaving.length}/${MAX_SUCCESSFUL_ITEMS_PER_BATCH})`
            );
          }

          // Delay only if we are expecting more items in this batch
          if (
            collectedDataForSaving.length < MAX_SUCCESSFUL_ITEMS_PER_BATCH &&
            latestAttemptOutcome?.status !== "no_new_items"
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }
        } catch (e) {
          console.error(
            `Critical client-side error during batch attempt ${attempts}:`,
            e
          );
          const errorMsg =
            e instanceof Error
              ? e.message
              : "Client error during batch lottery.";
          setLotteryError(errorMsg);
          setGeneralMessage(
            `Critical error on attempt ${attempts}: ${errorMsg}. Batch processing stopped.`
          );
          anyErrorsDuringAttempts = true;
          break;
        }
      } // End while loop

      // After loop, set final general message based on outcomes
      if (collectedDataForSaving.length > 0) {
        // This will be overridden if save action is called and is successful/fails
        setGeneralMessage(
          `Collection phase finished. ${collectedDataForSaving.length} items ready for saving.`
        );
      } else if (latestAttemptOutcome?.status === "no_new_items") {
        // Already handled by setGeneralMessage inside loop
      } else if (
        !anyErrorsDuringAttempts &&
        attempts < MAX_ATTEMPTS_PER_BATCH
      ) {
        setGeneralMessage(
          "Batch ended: No new opportunities were collected for saving (e.g., all were deferred or skipped due to limits)."
        );
      } else if (
        anyErrorsDuringAttempts &&
        collectedDataForSaving.length === 0
      ) {
        setGeneralMessage(
          "Batch collection finished with errors, and no items were successfully collected to save."
        );
      } else if (
        attempts >= MAX_ATTEMPTS_PER_BATCH &&
        collectedDataForSaving.length === 0
      ) {
        setGeneralMessage(
          "Max attempts reached for batch. No items were successfully collected to save."
        );
      }
      // If 'no_new_items' was the status, generalMessage is already set and loop broken.

      let itemsSavedInThisRunCount = 0; // Variable to store the count of successfully saved items

      // Save collected items if any
      if (collectedDataForSaving.length > 0) {
        setGeneralMessage(
          `Saving ${collectedDataForSaving.length} collected items to Firestore...`
        );
        setLotteryError(null); // Clear lottery-specific error before save
        try {
          const batchSaveResult = await saveBatchProcessedOpportunitiesAction(
            collectedDataForSaving
          );
          itemsSavedInThisRunCount = batchSaveResult.successCount; // Store the count
          setGeneralMessage(batchSaveResult.overallMessage); // Update with save result
          if (batchSaveResult.failedCount > 0) {
            console.error("Batch save failures:", batchSaveResult.errors);
            setGeneralMessage(
              (prev) =>
                `${prev} (${batchSaveResult.failedCount} failed to save)`
            );
            setLotteryError(
              `Batch save: ${batchSaveResult.failedCount} items failed to save.`
            );
          }
          if (batchSaveResult.successCount > 0) {
            // Refresh lists to show newly saved items (including this week's)
            await fetchAllOpportunitiesFromFirestore();
          }
        } catch (e) {
          console.error("Critical error during batch save action call:", e);
          const errorMsg =
            e instanceof Error ? e.message : "Client error during batch save.";
          setLotteryError(errorMsg);
          setGeneralMessage(`Critical error during batch save: ${errorMsg}`);
          // itemsSavedInThisRunCount remains 0 if save fails
        }
      }

      // Reset currentBatchSuccesses display if no items were collected,
      // or if collected items were saved but resulted in zero actual successes.
      if (
        collectedDataForSaving.length === 0 ||
        (collectedDataForSaving.length > 0 && itemsSavedInThisRunCount === 0)
      ) {
        setCurrentBatchSuccesses([]);
      }
    });
  };

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

  // New handler for redrawing the entire week
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
        const response = await markOppourtunityUnavailableAction(
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
  const escapeCsvField = (field: string | undefined | null): string => {
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

    const header =
      [
        "Author",
        "AI Primary Keyword",
        "AI Primary Keyword Volume",
        "AI Related Keyword 1",
        "AI Related Keyword 2",
        "Original CSV Keyword",
        "URL",
        "Drawn Date",
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
        const url = opp.url;
        const drawnDate = opp.processedAt
          ? new Date(opp.processedAt).toLocaleDateString()
          : "N/A";

        return [
          author,
          aiPrimaryKeyword,
          String(aiPrimaryKeywordVolume),
          aiRelatedKeyword1,
          aiRelatedKeyword2,
          originalCsvKeyword,
          url,
          drawnDate,
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

        {/* Table Display for This Week's Opportunities */}
        {!isLoadingList && thisWeeksOpportunities.length > 0 && (
          <div className="overflow-x-auto bg-white shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                    AI Primary Keyword (Volume)
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
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    URL
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {thisWeeksOpportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {opp.author || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {opp.keywordGroup?.aiPrimaryKeyword || (
                        <span className="text-gray-400 italic">(Not Set)</span>
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
                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 max-w-xs break-words">
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {decodeURIComponent(opp.url)}
                        <ExternalLink className="inline h-3 w-3 ml-1 align-baseline" />
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opp.processedAt
                        ? new Date(opp.processedAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/oppourtunity/${opp.id}`}
                          legacyBehavior={false}
                        >
                          View Details
                        </Link>
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
            {MAX_SUCCESSFUL_ITEMS_PER_BATCH} new content opportunities for you.
          </p>
          <Button
            size="lg"
            onClick={handleRunLottery}
            disabled={isProcessingLottery || isLoadingList || isUpdatingStatus}
            className="px-10 py-6 text-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-xl transform hover:scale-105 transition-transform duration-300 focus:ring-4 focus:ring-pink-300"
          >
            {isProcessingLottery ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" /> Processing
                Batch ({currentAttemptInBatch}/{MAX_ATTEMPTS_PER_BATCH},{" "}
                {currentBatchSuccesses.length} Collected)
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
                                {item.data.gscKeywords.map((kw, idx) => (
                                  <li
                                    key={idx}
                                  >{`"${kw.keyword}" (Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks})`}</li>
                                ))}
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
                              href={`/oppourtunity/${opp.id}`}
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
                                      .map((kw, idx) => (
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/oppourtunity/${opp.id}`}
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
