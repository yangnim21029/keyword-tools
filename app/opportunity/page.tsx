"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
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
  Eye, // For View Details icon
  Trash2, // For Delete/Mark Unavailable (generalizing for history too)
  PlayCircle, // Placeholder for Redraw
} from "lucide-react"; // Icons
import { toast } from "sonner"; // Import toast for feedback
import { MEDIASITE_DATA } from "@/app/global-config"; // Import site config
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Import Table components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription, // If needed for GSC dialog body
} from "@/components/ui/dialog"; // For GSC Dialog

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

// --- TARGET SITE NAMES FOR FILTERING ---
const TARGET_SITE_NAMES = ["BF", "GSHK", "HSHK", "PL", "TB", "UL", "MD"];

export default function OpportunityPage() {
  const [isProcessingLottery, startProcessingLotteryTransition] =
    useTransition();
  const [isLoadingList, startLoadingListTransition] = useTransition();
  const [isUpdatingStatus, startUpdatingStatusTransition] = useTransition();
  const [isRedrawingWeek, startRedrawingWeekTransition] = useTransition();
  const [isRedrawingSingle, startRedrawingSingleTransition] = useTransition();
  const [redrawingOppId, setRedrawingOppId] = useState<string | null>(null);
  const [isProcessingSite, setIsProcessingSite] = useState<string | null>(null); // Track which site is being processed
  const [selectedSiteForSingleDraw, setSelectedSiteForSingleDraw] =
    useState<string>("");
  const [isDrawingOne, startDrawingOneTransition] = useTransition();

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
    // AND filter by TARGET_SITE_NAMES
    const sitesToProcess = MEDIASITE_DATA.filter(
      (site) => site.url && site.name && TARGET_SITE_NAMES.includes(site.name)
    ).map((site) => ({ name: site.name!, urlPrefix: site.url }));

    if (sitesToProcess.length === 0) {
      setGeneralMessage(
        "No target sites configured or found in MEDIASITE_DATA."
      );
      return; // Cannot proceed
    }

    setGeneralMessage(
      `Starting Opportunity Draw Batch... (Will attempt ${MAX_ATTEMPTS_PER_SITE} times per site to find ${TARGET_SUCCESSES_PER_SITE} for each)`
    );
    setLotteryError(null);
    const allCollectedDataForSaving: SuccessDataPayload[] = [];
    let itemsSavedInThisRunCount = 0;
    let anyErrorsDuringBatch = false;

    startProcessingLotteryTransition(async () => {
      for (const site of sitesToProcess) {
        setIsProcessingSite(site.name);
        setGeneralMessage(
          `Batch: Now processing ${site.name}. Trying to find ${TARGET_SUCCESSES_PER_SITE} item(s) from your CSV list...`
        );
        let successesForThisSite = 0;
        let attemptsForThisSite = 0;

        while (
          successesForThisSite < TARGET_SUCCESSES_PER_SITE &&
          attemptsForThisSite < MAX_ATTEMPTS_PER_SITE
        ) {
          attemptsForThisSite++;
          setCurrentAttemptInBatch((prev) => prev + 1);
          const researchId = `batch_${site.name.replace(/\s+/g, "")}_${new Date().getTime()}_${attemptsForThisSite}`;
          setLastAttemptStatusMessage(
            `Batch: Attempt ${attemptsForThisSite}/${MAX_ATTEMPTS_PER_SITE} for ${site.name}...`
          );
          const attempt = await processNextOpportunityForSiteAction(
            site.urlPrefix,
            researchId
          );
          setLatestAttemptOutcome(attempt); // Update for detailed display

          if (attempt.status === "success_ready_for_batch") {
            allCollectedDataForSaving.push(attempt.data);
            setCurrentBatchSuccesses((prev) => {
              // Check if an item with the same URL already exists
              if (
                prev.some(
                  (existingItem) => existingItem.data.url === attempt.data.url
                )
              ) {
                console.warn(
                  `[handleRunLottery] Attempted to add duplicate URL to currentBatchSuccesses: ${attempt.data.url}. Skipping.`
                );
                return prev; // Return previous state if duplicate
              }
              return [...prev, attempt]; // Add new item if not duplicate
            });
            successesForThisSite++;
            toast.success(
              `Batch: Found item for ${site.name}: ${attempt.data.url}`,
              { duration: 2000 }
            );
            setLastAttemptStatusMessage(
              `Batch: Success for ${site.name}! (${successesForThisSite}/${TARGET_SUCCESSES_PER_SITE} found).`
            );
          } else if (attempt.status === "no_new_items") {
            setLastAttemptStatusMessage(
              `Batch: No more available items found in CSV for ${site.name} this round.`
            );
            toast.info(
              `Batch: No more available items in CSV for ${site.name}.`,
              { duration: 2000 }
            );
            break; // No point in further attempts for this site in this batch
          } else if (attempt.status === "no_gsc_data_skipped") {
            toast.info(
              `Batch item for ${site.name} (${attempt.urlSkipped}) skipped: No GSC data found.`,
              { duration: 2500 }
            );
            setLastAttemptStatusMessage(
              `Batch: Item for ${site.name} skipped (No GSC data). Trying next...`
            );
            // Continue attempts for this site as this specific item was skipped due to no GSC data
          } else if (
            attempt.status === "author_limit_deferred" ||
            attempt.status === "author_ignored"
          ) {
            toast.info(
              `Batch item for ${site.name} skipped: ${attempt.finalStatusMessage}`,
              { duration: 2000 }
            );
            setLastAttemptStatusMessage(
              `Batch: Item for ${site.name} skipped (${attempt.status}). Trying next...`
            );
            // Continue attempts for this site as this specific item was skipped
          } else {
            // Error status
            anyErrorsDuringBatch = true;
            setLotteryError(
              (prev) =>
                `${prev ? prev + "; " : ""}Error for ${site.name}: ${attempt.finalStatusMessage}`
            );
            toast.error(
              `Batch Error for ${site.name}: ${attempt.finalStatusMessage}`
            );
            setLastAttemptStatusMessage(
              `Batch: Error for ${site.name}. Check messages.`
            );
            // Depending on error, might break or continue. For now, continue attempts.
          }
        }
        if (successesForThisSite < TARGET_SUCCESSES_PER_SITE) {
          toast.info(
            `Batch for ${site.name}: Found ${successesForThisSite}/${TARGET_SUCCESSES_PER_SITE} items from CSV after ${attemptsForThisSite} attempts.`
          );
        }
      } // End for...of sitesToProcess

      setIsProcessingSite(null); // Clear site specific processing message
      setLastAttemptStatusMessage("Batch processing attempts finished.");

      if (allCollectedDataForSaving.length > 0) {
        setGeneralMessage(
          `Batch Finished. Attempting to save ${allCollectedDataForSaving.length} collected items...`
        );
        const saveResult = await saveBatchProcessedOpportunitiesAction(
          allCollectedDataForSaving
        );
        itemsSavedInThisRunCount = saveResult.successCount;
        if (saveResult.successCount > 0) {
          toast.success(
            `${saveResult.successCount} new opportunities saved from batch!`
          );
        }
        if (saveResult.failedCount > 0) {
          anyErrorsDuringBatch = true;
          const errorDetails = saveResult.errors
            .map((e) => `URL: ${e.url}, Err: ${e.error}`)
            .join("; ");
          setLotteryError(
            (prev) =>
              `${prev ? prev + "; " : ""}Save Errors: ${saveResult.failedCount} failed. ${errorDetails}`
          );
          toast.error(
            `Batch Save: ${saveResult.failedCount} items failed to save.`,
            { description: errorDetails, duration: 10000 }
          );
        }
        setGeneralMessage(
          `Batch save complete. Saved ${saveResult.successCount} of ${allCollectedDataForSaving.length} collected items.`
        );
      } else {
        setGeneralMessage(
          "Batch finished. No new items were collected to save from your CSV lists."
        );
      }
    }); // End startProcessingLotteryTransition
  }; // End handleRunLottery

  // --- NEW: Handler for Drawing One Single Opportunity for a Selected Site ---
  const handleDrawOneForSite = async () => {
    if (!selectedSiteForSingleDraw) {
      toast.info("Please select a site to draw an opportunity for.");
      return;
    }

    const siteInfo = MEDIASITE_DATA.find(
      (site) => site.url === selectedSiteForSingleDraw
    );
    if (!siteInfo) {
      toast.error("Selected site configuration not found.");
      return;
    }

    const siteName = siteInfo.name || "Selected Site";

    setGeneralMessage(
      `Attempting to draw one new opportunity for site: ${siteName} from your CSV list...`
    );
    setLotteryError(null);
    setCurrentBatchSuccesses([]);
    setLatestAttemptOutcome(null);
    setIsProcessingSite(siteName); // Indicate processing for this site

    const MAX_SINGLE_DRAW_ATTEMPTS = 3;

    startDrawingOneTransition(async () => {
      let success = false;
      // Outer try for the whole multi-attempt process, for the finally block.
      try {
        for (
          let attemptNum = 1;
          attemptNum <= MAX_SINGLE_DRAW_ATTEMPTS;
          attemptNum++
        ) {
          setGeneralMessage(
            `Attempt ${attemptNum}/${MAX_SINGLE_DRAW_ATTEMPTS} to draw new opportunity for site: ${siteName} from CSV...`
          );
          toast.info(
            `Draw One (${siteName}): Attempt ${attemptNum}/${MAX_SINGLE_DRAW_ATTEMPTS}...`
          );
          try {
            // Inner try for each specific attempt
            const researchId = `drawOne_${siteName.replace(/\s+/g, "")}_${new Date().getTime()}_${attemptNum}`;
            const attempt = await processNextOpportunityForSiteAction(
              selectedSiteForSingleDraw, // This is the siteUrlPrefix
              researchId
            );
            setLatestAttemptOutcome(attempt);

            if (attempt.status === "success_ready_for_batch") {
              toast.info(
                `Draw One (${siteName}, Attempt ${attemptNum}): Found ${attempt.data.url}. Saving...`
              );
              const saveResult = await saveBatchProcessedOpportunitiesAction([
                attempt.data,
              ]);
              if (saveResult.successCount > 0) {
                toast.success(
                  `Draw One (${siteName}): New CSV opportunity saved successfully!`
                );
                setGeneralMessage(
                  `New opportunity for ${siteName} (from CSV) drawn and saved on attempt ${attemptNum}.`
                );
                success = true;
                break; // Exit loop on success
              } else {
                toast.error(
                  `Draw One (${siteName}, Attempt ${attemptNum}): Failed to save new CSV opportunity. ` +
                    (saveResult.errors[0]?.error || "Unknown save error.")
                );
                setGeneralMessage(
                  `Draw One (${siteName}, Attempt ${attemptNum}): Found CSV opportunity, but failed to save it.`
                );
                break; // Break on save failure
              }
            } else if (attempt.status === "no_new_items") {
              toast.info(
                `Draw One (${siteName}, Attempt ${attemptNum}): No new available items in CSV list.`
              );
              setGeneralMessage(
                `Draw One (${siteName}): No new available items in CSV list after ${attemptNum} attempt(s).`
              );
              break; // No point in further attempts
            } else if (
              attempt.status === "no_gsc_data_skipped" ||
              attempt.status === "no_keywords_for_ai_skipped" ||
              attempt.status === "author_limit_deferred" ||
              attempt.status === "author_ignored"
            ) {
              toast.info(
                `Draw One (${siteName}, Attempt ${attemptNum}): Item skipped - ${attempt.finalStatusMessage}. Trying again...`,
                { duration: 3000 }
              );
              // Message already set by setLatestAttemptOutcome indirectly via main alert or explicitly if needed
            } else {
              // Error status for the attempt
              toast.error(
                `Draw One (${siteName}, Attempt ${attemptNum}): Could not draw. ${attempt.finalStatusMessage}`
              );
              // Message already set by setLatestAttemptOutcome indirectly via main alert or explicitly if needed
            }
          } catch (e) {
            // Catch for an individual attempt's processing error
            console.error(
              `Error during Draw One for Site ${siteName}, Attempt ${attemptNum}:`,
              e
            );
            toast.error(
              e instanceof Error
                ? `Draw One Error (Attempt ${attemptNum}): ${e.message}`
                : `Client error during single draw attempt ${attemptNum}.`
            );
            setGeneralMessage(
              `An error occurred during attempt ${attemptNum} for ${siteName}. Check console.`
            );
          }
          if (attemptNum < MAX_SINGLE_DRAW_ATTEMPTS && !success) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay before next attempt
          }
        } // End for loop

        if (!success) {
          setGeneralMessage(
            `Finished ${MAX_SINGLE_DRAW_ATTEMPTS} attempts for ${siteName}. No new opportunity was successfully drawn and saved.`
          );
          toast.info(
            `Draw One (${siteName}): Completed ${MAX_SINGLE_DRAW_ATTEMPTS} attempts without saving a new opportunity.`
          );
        }
      } catch (outerError) {
        // Optional outer catch for unforeseen issues in the transition block setup
        console.error(
          `Outer error during Draw One for Site ${siteName} transition:`,
          outerError
        );
        toast.error(
          outerError instanceof Error
            ? `Critical Draw One Error: ${outerError.message}`
            : "Critical client error during single draw process."
        );
        setGeneralMessage(
          `A critical error occurred while attempting to draw for ${siteName}.`
        );
      } finally {
        setIsProcessingSite(null);
        await fetchAllOpportunitiesFromFirestore();
      }
    });
  };

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
        .join("\t") + "\n"; // Use TAB as delimiter for header cells

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
          .join("\t"); // Use TAB as delimiter for data cells
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

  // Handler for redrawing (deleting) a single opportunity and attempting to draw one replacement
  const handleRedrawSingle = (oppId: string, oppUrl: string) => {
    if (!oppId || !oppUrl) return;
    if (
      !confirm(
        `Are you sure you want to redraw opportunity ${oppId}? This will delete it and attempt to draw one replacement.`
      )
    ) {
      return;
    }
    setGeneralMessage(null);
    setLotteryError(null);
    setRedrawingOppId(oppId);
    setCurrentBatchSuccesses([]); // Clear any previous batch items from display
    setLatestAttemptOutcome(null);

    startRedrawingSingleTransition(async () => {
      const MAX_REDRAW_ATTEMPTS = 3;
      let replacementSuccess = false;

      try {
        toast.info(
          `Redraw: Deleting item ${oppId} and attempting to find a replacement from CSV for its site...`
        );
        setGeneralMessage(
          `Redraw: Deleting ${oppId} and trying to find a CSV replacement...`
        );

        const deleteResult = await deleteProcessedOpportunityAction(oppId);
        if (!deleteResult.success) {
          toast.error(
            `Redraw: Failed to delete original item ${oppId}. Error: ${deleteResult.error}`
          );
          setGeneralMessage(
            `Redraw: Failed to delete ${oppId}. Aborting redraw.`
          );
          // No finally block here, as it's part of the outer try/finally
          setRedrawingOppId(null); // Still ensure this is cleared
          await fetchAllOpportunitiesFromFirestore(); // Refresh to show deletion status
          return;
        }
        toast.success(`Redraw: Original item ${oppId} deleted.`);

        const siteData = MEDIASITE_DATA.find((s) => oppUrl.startsWith(s.url));
        if (!siteData) {
          toast.error(
            `Redraw: Could not determine site for URL ${oppUrl}. Cannot draw replacement.`
          );
          setGeneralMessage(
            `Redraw: Could not identify site for ${oppUrl}. Replacement aborted.`
          );
          setRedrawingOppId(null);
          await fetchAllOpportunitiesFromFirestore();
          return;
        }
        const siteUrlPrefix = siteData.url;
        const siteName = siteData.name || "the original site";

        for (
          let attemptNum = 1;
          attemptNum <= MAX_REDRAW_ATTEMPTS;
          attemptNum++
        ) {
          setGeneralMessage(
            `Redraw Attempt ${attemptNum}/${MAX_REDRAW_ATTEMPTS}: Finding new CSV item for ${siteName}...`
          );
          toast.info(
            `Redraw (${siteName}): Attempt ${attemptNum}/${MAX_REDRAW_ATTEMPTS} for replacement...`
          );

          try {
            // Inner try for each attempt to process a new opportunity
            const researchId = `redraw_${siteName.replace(/\s+/g, "")}_${new Date().getTime()}_${attemptNum}`;
            const attempt = await processNextOpportunityForSiteAction(
              siteUrlPrefix,
              researchId
            );
            setLatestAttemptOutcome(attempt);

            if (attempt.status === "success_ready_for_batch") {
              toast.info(
                `Redraw (${siteName}, Attempt ${attemptNum}): Found new CSV item ${attempt.data.url}. Saving...`
              );
              const saveResult = await saveBatchProcessedOpportunitiesAction([
                attempt.data,
              ]);
              if (saveResult.successCount > 0) {
                toast.success(
                  `Redraw (${siteName}): New replacement item saved successfully!`
                );
                setGeneralMessage(
                  `Redraw for ${siteName} complete. New CSV item saved on attempt ${attemptNum}.`
                );
                replacementSuccess = true;
                break; // Exit loop on successful replacement and save
              } else {
                toast.error(
                  `Redraw (${siteName}, Attempt ${attemptNum}): Failed to save new CSV replacement. ` +
                    (saveResult.errors[0]?.error || "Unknown save error.")
                );
                setGeneralMessage(
                  `Redraw (${siteName}, Attempt ${attemptNum}): Found CSV replacement, but save failed.`
                );
                break; // Break on save failure
              }
            } else if (attempt.status === "no_new_items") {
              toast.info(
                `Redraw (${siteName}, Attempt ${attemptNum}): No new available CSV items for replacement.`
              );
              setGeneralMessage(
                `Redraw (${siteName}): No new available CSV items found for replacement after ${attemptNum} attempt(s).`
              );
              break; // No point in further attempts
            } else if (
              attempt.status === "no_gsc_data_skipped" ||
              attempt.status === "no_keywords_for_ai_skipped" ||
              attempt.status === "author_limit_deferred" ||
              attempt.status === "author_ignored"
            ) {
              toast.info(
                `Redraw (${siteName}, Attempt ${attemptNum}): Replacement candidate skipped - ${attempt.finalStatusMessage}. Trying again...`,
                { duration: 3000 }
              );
              // Loop continues
            } else {
              // Error status for the attempt
              toast.error(
                `Redraw (${siteName}, Attempt ${attemptNum}): Could not draw replacement. ${attempt.finalStatusMessage}`
              );
              // Loop continues
            }
          } catch (e) {
            // Catch for an individual replacement attempt's processing error
            console.error(
              `Error during Redraw for Site ${siteName}, Attempt ${attemptNum}:`,
              e
            );
            toast.error(
              e instanceof Error
                ? `Redraw Error (Attempt ${attemptNum}): ${e.message}`
                : `Client error during redraw attempt ${attemptNum}.`
            );
            setGeneralMessage(
              `An error occurred during replacement attempt ${attemptNum} for ${siteName}. Check console.`
            );
          }
          if (attemptNum < MAX_REDRAW_ATTEMPTS && !replacementSuccess) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Small delay
          }
        } // End for loop for redraw attempts

        if (!replacementSuccess) {
          setGeneralMessage(
            `Finished ${MAX_REDRAW_ATTEMPTS} attempts to find a replacement for ${siteName}. None saved.`
          );
          toast.info(
            `Redraw (${siteName}): Completed ${MAX_REDRAW_ATTEMPTS} attempts without saving a replacement.`
          );
        }
      } catch (e) {
        // Catch for errors in the delete part or outer redraw logic
        console.error("Error during redraw single operation:", e);
        toast.error(
          e instanceof Error
            ? `Redraw Error: ${e.message}`
            : "Client error during single redraw operation."
        );
        setGeneralMessage(
          "Redraw: An unexpected error occurred during the operation."
        );
      } finally {
        setRedrawingOppId(null);
        await fetchAllOpportunitiesFromFirestore(); // Refresh list regardless of outcome
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
            {/* --- NEW: UI for Drawing One Specific Opportunity --- */}
            <div className="flex items-end gap-2 ml-auto">
              {" "}
              {/* Aligns this group to the right */}
              <div className="w-48">
                <Select
                  value={selectedSiteForSingleDraw}
                  onValueChange={setSelectedSiteForSingleDraw}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select site for single draw" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIASITE_DATA.filter(
                      (site) =>
                        site.url &&
                        site.name &&
                        TARGET_SITE_NAMES.includes(site.name)
                    ).map((site) => (
                      <SelectItem
                        key={site.url}
                        value={site.url}
                        className="text-xs"
                      >
                        {site.name} ({site.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDrawOneForSite}
                disabled={
                  isDrawingOne ||
                  isProcessingLottery ||
                  !selectedSiteForSingleDraw
                }
                className="h-9"
              >
                {isDrawingOne ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="mr-2 h-4 w-4" />
                )}
                Draw One
              </Button>
            </div>
            {/* --- END: UI for Drawing One Specific Opportunity --- */}
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
                    All Keywords (Vol)
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
                    GSC Info
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                      <span className="ml-1 text-xs text-gray-500">
                        (Vol:{" "}
                        {opp.keywordGroup?.aiPrimaryKeywordVolume !== null &&
                        opp.keywordGroup?.aiPrimaryKeywordVolume !== undefined
                          ? opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()
                          : "N/A"}
                        )
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      <ul className="space-y-0.5">
                        {opp.keywordGroup?.aiPrimaryKeyword && (
                          <li>
                            <strong>AI:</strong>{" "}
                            {opp.keywordGroup.aiPrimaryKeyword}
                            {opp.keywordGroup?.aiPrimaryKeywordVolume !==
                              null &&
                              opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                undefined && (
                                <span className="ml-1 text-gray-500">
                                  {" "}
                                  (Vol:{" "}
                                  {opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()}
                                  )
                                </span>
                              )}
                          </li>
                        )}
                        {opp.keywordGroup?.aiRelatedKeyword1 &&
                          opp.keywordGroup.aiRelatedKeyword1 !== "N/A" && (
                            <li>
                              <strong>R1:</strong>{" "}
                              {opp.keywordGroup.aiRelatedKeyword1}
                              {opp.keywordGroup.aiRelatedKeyword1Volume !==
                                null &&
                              opp.keywordGroup.aiRelatedKeyword1Volume !==
                                undefined &&
                              typeof opp.keywordGroup
                                .aiRelatedKeyword1Volume === "number" ? (
                                <span className="ml-1 text-gray-500">
                                  {" "}
                                  (Vol:{" "}
                                  {opp.keywordGroup.aiRelatedKeyword1Volume.toLocaleString()}
                                  )
                                </span>
                              ) : (
                                <span className="ml-1 text-gray-500">
                                  {" "}
                                  (Vol: N/A)
                                </span>
                              )}
                            </li>
                          )}
                        {opp.keywordGroup?.aiRelatedKeyword2 &&
                          opp.keywordGroup.aiRelatedKeyword2 !== "N/A" && (
                            <li>
                              <strong>R2:</strong>{" "}
                              {opp.keywordGroup.aiRelatedKeyword2}
                              {opp.keywordGroup.aiRelatedKeyword2Volume !==
                                null &&
                              opp.keywordGroup.aiRelatedKeyword2Volume !==
                                undefined &&
                              typeof opp.keywordGroup
                                .aiRelatedKeyword2Volume === "number" ? (
                                <span className="ml-1 text-gray-500">
                                  {" "}
                                  (Vol:{" "}
                                  {opp.keywordGroup.aiRelatedKeyword2Volume.toLocaleString()}
                                  )
                                </span>
                              ) : (
                                <span className="ml-1 text-gray-500">
                                  {" "}
                                  (Vol: N/A)
                                </span>
                              )}
                            </li>
                          )}
                        <li>
                          <strong>CSV:</strong> {opp.originalCsvKeyword}
                          {typeof opp.csvVolume === "number" && (
                            <span className="ml-1 text-gray-500">
                              {" "}
                              (Vol: {opp.csvVolume.toLocaleString()})
                            </span>
                          )}
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
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {opp.gscKeywords && opp.gscKeywords.length > 0 ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs p-0 h-auto text-blue-600 hover:underline"
                            >
                              <Info className="h-3 w-3 mr-1" /> Show GSC (
                              {opp.gscKeywords.length})
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>
                                GSC Keywords for:{" "}
                                {opp.scrapedTitle ||
                                  decodeURIComponent(opp.url)}
                              </DialogTitle>
                              <DialogDescription>
                                Top {opp.gscKeywords.length} keywords from
                                Google Search Console.
                              </DialogDescription>
                            </DialogHeader>
                            <ul className="mt-2 list-disc space-y-1 text-xs text-gray-800 max-h-60 overflow-y-auto scrollbar-thin pr-2 pl-5">
                              {opp.gscKeywords.map(
                                (kw: GscKeywordMetric, idx: number) => (
                                  <li
                                    key={idx}
                                  >{`"${kw.keyword}" (Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks})`}</li>
                                )
                              )}
                            </ul>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-xs italic text-gray-500">
                          No GSC kw data
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="View Details"
                      >
                        <Link
                          href={`/opportunity/${opp.id}`}
                          legacyBehavior={false}
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Redraw Opportunity"
                        onClick={() => handleRedrawSingle(opp.id, opp.url)}
                        disabled={
                          isProcessingLottery ||
                          isRedrawingWeek ||
                          isRedrawingSingle ||
                          redrawingOppId === opp.id
                        }
                        className="text-orange-600 hover:text-orange-700"
                      >
                        {redrawingOppId === opp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCw className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- NEW: This Week's Opportunities by Site Summary Table --- */}
        {!isLoadingList && thisWeeksOpportunities.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-3">
              This Week's Opportunities by Site
            </h3>
            {thisWeeksOpportunities.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Media Site</TableHead>
                    <TableHead className="text-right">
                      Count This Week
                    </TableHead>
                    <TableHead>
                      Authors (Contributions to Site This Week)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MEDIASITE_DATA.filter((site) =>
                    TARGET_SITE_NAMES.includes(site.name)
                  ).map((site) => {
                    const siteOpportunitiesThisWeek =
                      thisWeeksOpportunities.filter((opp) =>
                        opp.url.startsWith(site.url)
                      );
                    const count = siteOpportunitiesThisWeek.length;

                    // Calculate author contributions for this specific site
                    const authorContributionsMap = new Map<string, number>();
                    siteOpportunitiesThisWeek.forEach((opp) => {
                      const author = opp.author || "Unknown Author";
                      authorContributionsMap.set(
                        author,
                        (authorContributionsMap.get(author) || 0) + 1
                      );
                    });
                    const authorContributionsString = Array.from(
                      authorContributionsMap
                    )
                      .map(([author, num]) => `${author} (${num})`)
                      .join(", ");

                    return (
                      <TableRow key={site.url}>
                        <TableCell>{site.name}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {authorContributionsString || "N/A"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No opportunities drawn this week to summarize.
              </p>
            )}
          </div>
        )}
        {/* --- END: This Week's Opportunities by Site Summary Table --- */}

        {/* RELOCATED AND RESTYLED: Overall Author Performance Note */}
        {!isLoadingList && calculatedAuthorCounts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-1">
              Overall Author Contributions This Week:
            </p>
            <p className="text-xs text-gray-600">
              {calculatedAuthorCounts
                .map((stat) => `${stat.author} (${stat.count})`)
                .join(", ")}
            </p>
          </div>
        )}
        {/* END RELOCATED AND RESTYLED: Overall Author Performance Note */}
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
                          All Keywords (Vol)
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
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                            <span className="ml-1 text-xs text-gray-500">
                              (Vol:{" "}
                              {opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                null &&
                              opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                undefined
                                ? opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()
                                : "N/A"}
                              )
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-gray-600">
                            <ul className="space-y-0.5">
                              {opp.keywordGroup?.aiPrimaryKeyword && (
                                <li>
                                  <strong>AI:</strong>{" "}
                                  {opp.keywordGroup.aiPrimaryKeyword}
                                  {opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                    null &&
                                    opp.keywordGroup?.aiPrimaryKeywordVolume !==
                                      undefined && (
                                      <span className="ml-1 text-gray-500">
                                        {" "}
                                        (Vol:{" "}
                                        {opp.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()}
                                        )
                                      </span>
                                    )}
                                </li>
                              )}
                              {opp.keywordGroup?.aiRelatedKeyword1 &&
                                opp.keywordGroup.aiRelatedKeyword1 !==
                                  "N/A" && (
                                  <li>
                                    <strong>R1:</strong>{" "}
                                    {opp.keywordGroup.aiRelatedKeyword1}
                                    {opp.keywordGroup
                                      .aiRelatedKeyword1Volume !== null &&
                                    opp.keywordGroup.aiRelatedKeyword1Volume !==
                                      undefined &&
                                    typeof opp.keywordGroup
                                      .aiRelatedKeyword1Volume === "number" ? (
                                      <span className="ml-1 text-gray-500">
                                        {" "}
                                        (Vol:{" "}
                                        {opp.keywordGroup.aiRelatedKeyword1Volume.toLocaleString()}
                                        )
                                      </span>
                                    ) : (
                                      <span className="ml-1 text-gray-500">
                                        {" "}
                                        (Vol: N/A)
                                      </span>
                                    )}
                                  </li>
                                )}
                              {opp.keywordGroup?.aiRelatedKeyword2 &&
                                opp.keywordGroup.aiRelatedKeyword2 !==
                                  "N/A" && (
                                  <li>
                                    <strong>R2:</strong>{" "}
                                    {opp.keywordGroup.aiRelatedKeyword2}
                                    {opp.keywordGroup
                                      .aiRelatedKeyword2Volume !== null &&
                                    opp.keywordGroup.aiRelatedKeyword2Volume !==
                                      undefined &&
                                    typeof opp.keywordGroup
                                      .aiRelatedKeyword2Volume === "number" ? (
                                      <span className="ml-1 text-gray-500">
                                        {" "}
                                        (Vol:{" "}
                                        {opp.keywordGroup.aiRelatedKeyword2Volume.toLocaleString()}
                                        )
                                      </span>
                                    ) : (
                                      <span className="ml-1 text-gray-500">
                                        {" "}
                                        (Vol: N/A)
                                      </span>
                                    )}
                                  </li>
                                )}
                              <li>
                                <strong>CSV:</strong> {opp.originalCsvKeyword}
                                {typeof opp.csvVolume === "number" && (
                                  <span className="ml-1 text-gray-500">
                                    {" "}
                                    (Vol: {opp.csvVolume.toLocaleString()})
                                  </span>
                                )}
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
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="text-xs p-0 h-auto text-blue-600 hover:underline"
                                  >
                                    <Info className="h-3 w-3 mr-1" /> Show GSC (
                                    {opp.gscKeywords.length})
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>
                                      GSC Keywords for:{" "}
                                      {opp.scrapedTitle ||
                                        decodeURIComponent(opp.url)}
                                    </DialogTitle>
                                    <DialogDescription>
                                      Top {opp.gscKeywords.length} keywords from
                                      Google Search Console.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <ul className="mt-2 list-disc space-y-1 text-xs text-gray-800 max-h-60 overflow-y-auto scrollbar-thin pr-2 pl-5">
                                    {opp.gscKeywords.map(
                                      (kw: GscKeywordMetric, idx: number) => (
                                        <li
                                          key={idx}
                                        >{`"${kw.keyword}" (Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks})`}</li>
                                      )
                                    )}
                                  </ul>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-xs italic text-gray-500">
                                No GSC kw data
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-1 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="View Details"
                            >
                              <Link
                                href={`/opportunity/${opp.id}`}
                                legacyBehavior={false}
                              >
                                <Eye className="h-4 w-4 text-blue-600" />
                              </Link>
                            </Button>
                            {opp.status !== "marked_unavailable" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Mark Unavailable"
                                onClick={() => handleMarkUnavailable(opp.url)}
                                disabled={
                                  isUpdatingStatus || isProcessingLottery
                                }
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
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
          latestAttemptOutcome.status === "author_ignored" ||
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
                : latestAttemptOutcome.status === "author_limit_deferred" ||
                    latestAttemptOutcome.status === "author_ignored"
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
