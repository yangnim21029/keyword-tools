import * as fs from "fs/promises";
import * as path from "path";
import { parse } from "csv-parse/sync";
import { db, COLLECTIONS } from "./db-config"; // Ensure db-config.ts exports db and COLLECTIONS
import { Timestamp, FieldValue } from "firebase-admin/firestore"; // FieldValue and Timestamp are fine.
import { KeywordGroup } from "@/app/actions/actions-ai-audit"; // Assuming KeywordGroup is defined here
import { z } from "zod";
import {
  FirestoreTimestampSchema,
  GscKeywordMetricsSchema,
  type GscKeywordMetrics,
} from "./schema"; // Import the shared timestamp schema and GscKeywordMetrics type

// Raw data from CSV
export interface OpportunityFromCsv {
  keyword: string;
  url: string;
  volume?: number;
}

export type OppourtunityStatus =
  | "available" // This status might be conceptual for CSV items not yet processed/excluded
  | "processing" // Actively being worked on
  | "analyzed" // Successfully processed and stored in Firestore
  | "error_scraping"
  | "error_analysis"
  | "marked_unavailable"; // User marked or system marked (e.g. author limit)

// Base Zod schema for KeywordGroup if not already defined and imported
// Assuming KeywordGroup from actions-ai-audit is just an interface, define a Zod schema for it.
const KeywordGroupSchema = z.object({
  csvKeyword: z.string(),
  aiPrimaryKeyword: z.string(),
  aiRelatedKeyword1: z.string(),
  aiRelatedKeyword2: z.string(),
  aiPrimaryKeywordVolume: z.number().nullable().optional(),
});

// Zod schema for FirebaseOppourtunity, including timestamp transformations
export const FirebaseOppourtunitySchema = z.object({
  id: z.string(),
  url: z.string().url(),
  originalCsvKeyword: z.string(),
  csvVolume: z.number().int().optional(),
  status: z.enum([
    "available",
    "processing",
    "analyzed",
    "error_scraping",
    "error_analysis",
    "marked_unavailable",
  ]),
  onPageResultId: z.string().optional(),
  scrapedTitle: z.string().optional().describe("Title of the scraped article"),
  scrapedExcerpt: z
    .string()
    .optional()
    .describe("Excerpt of the scraped article"),
  scrapedSiteName: z
    .string()
    .optional()
    .describe("Site name from the scraped article"),
  keywordGroup: KeywordGroupSchema.optional(),
  gscKeywords: z
    .array(GscKeywordMetricsSchema)
    .optional()
    .describe("Raw GSC keyword metrics for the URL"),
  author: z.string().optional(),
  lastAttemptError: z.string().optional(),
  researchId: z.string().optional(),
  processedAt: FirestoreTimestampSchema, // Transforms to Date
  createdAt: FirestoreTimestampSchema, // Transforms to Date
  updatedAt: FirestoreTimestampSchema, // Transforms to Date
});

// This interface is what the functions will return (with Date objects)
export type ProcessedFirebaseOppourtunity = z.infer<
  typeof FirebaseOppourtunitySchema
>;

// The Firestore document might still use raw Timestamps before transformation
// This interface remains for internal use if needed, but return types will be ProcessedFirebaseOppourtunity
export interface FirebaseOppourtunity {
  id: string;
  url: string;
  originalCsvKeyword: string;
  csvVolume?: number;
  status: OppourtunityStatus;
  onPageResultId?: string;
  scrapedTitle?: string;
  scrapedExcerpt?: string;
  scrapedSiteName?: string;
  keywordGroup?: KeywordGroup;
  gscKeywords?: GscKeywordMetrics[];
  author?: string;
  lastAttemptError?: string;
  researchId?: string;
  processedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const CSV_FILE_PATH = path.join(
  process.cwd(),
  "app/oppourtunity/oppurtunity_keywords_for_editor.csv"
);

// Define new collection names
const PROCESSED_OPPORTUNITIES_COLLECTION_NAME =
  COLLECTIONS?.PROCESSED_OPPORTUNITY || "processed_opportunities";
const UNAVAILABLE_URLS_COLLECTION_NAME =
  COLLECTIONS?.UNAVAILABLE_URLS || "unavailable_urls";

/**
 * Parses the CSV file.
 */
export const getOpportunitiesFromCsv = async (): Promise<
  OpportunityFromCsv[]
> => {
  try {
    const fileContent = await fs.readFile(CSV_FILE_PATH, {
      encoding: "utf16le",
    });
    const records = parse(fileContent, {
      delimiter: "\t",
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
    return records
      .map((record: any) => ({
        keyword: record["Keyword"],
        url: record["Current URL"],
        volume: record["Volume"] ? parseInt(record["Volume"], 10) : undefined,
      }))
      .filter((op: any) => op.url && op.keyword);
  } catch (error) {
    console.error("Error reading or parsing CSV file:", error);
    return [];
  }
};

/**
 * Fetches URLs that should be excluded from processing.
 * This includes URLs already processed or explicitly marked as unavailable.
 */
const getExcludedUrls = async (): Promise<Set<string>> => {
  if (!db) throw new Error("Firestore not initialized for getExcludedUrls");
  const excludedUrls = new Set<string>();

  try {
    // Get URLs from processed opportunities
    const processedSnapshot = await db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .select("url")
      .get();
    processedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.url) excludedUrls.add(data.url);
    });

    // Get URLs from explicitly unavailable list
    const unavailableSnapshot = await db
      .collection(UNAVAILABLE_URLS_COLLECTION_NAME)
      .select("url")
      .get();
    unavailableSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.url) excludedUrls.add(data.url);
    });
  } catch (error) {
    console.error("Error fetching excluded URLs:", error);
    // Depending on desired behavior, might want to return empty or throw
  }
  return excludedUrls;
};

// Helper function for shuffling (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Swap elements
  }
  return array;
}

/**
 * Gets opportunities from CSV that are not yet processed or marked unavailable.
 * Now shuffles the list to provide random candidates.
 */
export const getNewAvailableOpportunitiesFromCsv = async (
  limit: number = 1 // Default to 1 as processRandomOppourtunityAction takes one
): Promise<OpportunityFromCsv[]> => {
  let allCsvOpportunities = await getOpportunitiesFromCsv();
  if (allCsvOpportunities.length === 0) return [];

  // Shuffle the opportunities before filtering and limiting
  allCsvOpportunities = shuffleArray(allCsvOpportunities);

  const excludedUrls = await getExcludedUrls();

  const availableForProcessing: OpportunityFromCsv[] = [];
  for (const csvOpp of allCsvOpportunities) {
    if (!excludedUrls.has(csvOpp.url)) {
      availableForProcessing.push(csvOpp);
      if (availableForProcessing.length >= limit) {
        break;
      }
    }
  }
  console.log(
    `Found ${availableForProcessing.length} new (randomized) available opportunities from CSV.`
  );
  return availableForProcessing;
};

/**
 * Saves a successfully processed opportunity to Firestore.
 * Returns the processed data with Date objects for timestamps.
 */
export const saveProcessedOpportunity = async (
  // Input data might not have id or full Timestamps yet
  opportunityDataToSave: Omit<
    FirebaseOppourtunity, // Uses the interface with Timestamp type for stricter internal type before save
    "id" | "createdAt" | "updatedAt" | "processedAt"
  > & { status: OppourtunityStatus } // Ensure status is part of the input to save
): Promise<ProcessedFirebaseOppourtunity | null> => {
  if (!db)
    throw new Error("Firestore not initialized for saveProcessedOpportunity");
  try {
    const now = Timestamp.now();
    // Construct the full document data that will be written to Firestore
    const docDataForFirestore: Omit<FirebaseOppourtunity, "id"> = {
      ...opportunityDataToSave,
      // status is already in opportunityDataToSave
      processedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .add(docDataForFirestore);

    // Construct the object to be validated and returned, including the new ID and raw Timestamps
    const savedDataWithRawTimestamps: FirebaseOppourtunity = {
      id: docRef.id,
      ...docDataForFirestore, // This includes the raw Timestamps (processedAt, createdAt, updatedAt)
    };

    // Validate and transform to ProcessedFirebaseOppourtunity (with Date objects)
    const validationResult = FirebaseOppourtunitySchema.safeParse(
      savedDataWithRawTimestamps
    );

    if (!validationResult.success) {
      console.error(
        `Failed to validate/transform saved opportunity ${docRef.id}:`,
        validationResult.error.flatten()
      );
      return null; // Or throw an error, depending on desired handling
    }

    console.log(
      `Saved and validated processed opportunity ${validationResult.data.id} for URL ${validationResult.data.url}`
    );
    return validationResult.data; // This is ProcessedFirebaseOppourtunity
  } catch (error) {
    console.error(
      `Error saving processed opportunity for URL ${opportunityDataToSave.url}:`,
      error
    );
    return null;
  }
};

/**
 * Fetches all PROCESSED opportunities from Firestore.
 * Returns an array of processed data with Date objects for timestamps.
 */
export const getAllProcessedOpportunities = async (
  limit: number = 100
): Promise<ProcessedFirebaseOppourtunity[]> => {
  if (!db)
    throw new Error(
      "Firestore not initialized for getAllProcessedOpportunities"
    );
  try {
    const snapshot = await db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .orderBy("processedAt", "desc")
      .limit(limit)
      .get();

    const validatedOpportunities: ProcessedFirebaseOppourtunity[] = [];
    for (const doc of snapshot.docs) {
      const rawData = doc.data();
      // Combine rawData with the document ID before validation
      const dataWithId = { ...rawData, id: doc.id };
      const validationResult = FirebaseOppourtunitySchema.safeParse(dataWithId);

      if (validationResult.success) {
        validatedOpportunities.push(validationResult.data);
      } else {
        console.warn(
          `[getAllProcessedOpportunities] Firestore data validation/transformation failed for doc ID ${doc.id}:`,
          validationResult.error.flatten()
        );
        // Skip invalid/untransformable documents
      }
    }
    return validatedOpportunities;
  } catch (error) {
    console.error("Error fetching all processed opportunities:", error);
    return [];
  }
};

/**
 * Updates details of a PROCESSED opportunity in Firestore.
 * Note: This function assumes the document ALREADY EXISTS in PROCESSED_OPPORTUNITIES_COLLECTION_NAME.
 */
export const updateProcessedOppourtunity = async (
  // Renamed for clarity
  docId: string,
  updates: Partial<
    Omit<
      FirebaseOppourtunity, // Internal type might be raw FirebaseOppourtunity
      "id" | "createdAt" | "url" | "originalCsvKeyword" | "processedAt"
    > & { updatedAt?: FieldValue }
  >
): Promise<boolean> => {
  if (!db)
    throw new Error(
      "Firestore not initialized for updateProcessedOppourtunity"
    );
  try {
    const docRef = db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .doc(docId);
    await docRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(
      `Updated processed opportunity ${docId} with status ${updates.status}`
    );
    return true;
  } catch (error) {
    console.error(`Error updating processed opportunity ${docId}:`, error);
    return false;
  }
};

/**
 * Marks an opportunity URL as unavailable.
 * This adds it to the 'unavailable_urls' collection and, if it exists as a processed opportunity,
 * updates its status there to 'marked_unavailable'.
 */
export const markUrlAsUnavailable = async (
  // Renamed for clarity
  urlToMark: string,
  reason?: string
): Promise<boolean> => {
  if (!db)
    throw new Error("Firestore not initialized for markUrlAsUnavailable");
  const success = true;
  try {
    // Add to unavailable_urls collection
    // Check if it's already there to avoid duplicates, or just overwrite. Overwriting is simpler.
    await db
      .collection(UNAVAILABLE_URLS_COLLECTION_NAME)
      .doc(Buffer.from(urlToMark).toString("base64"))
      .set({
        url: urlToMark,
        markedAt: Timestamp.now(),
        ...(reason && { reason }),
      });
    console.log(`Marked URL ${urlToMark} as unavailable in dedicated list.`);

    // Check if it exists in processed opportunities and update its status
    const snapshot = await db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .where("url", "==", urlToMark)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      const updateSuccess = await updateProcessedOppourtunity(docId, {
        status: "marked_unavailable",
      });
      if (!updateSuccess) {
        console.warn(
          `Failed to update status for already processed opportunity ${docId} (URL: ${urlToMark})`
        );
        // success = false; // Decide if this constitutes an overall failure
      } else {
        console.log(
          `Also updated status of processed opportunity ${docId} to marked_unavailable.`
        );
      }
    }
    return success;
  } catch (error) {
    console.error(`Error marking URL ${urlToMark} as unavailable:`, error);
    return false;
  }
};

/**
 * Gets the count of successfully processed opportunities for a specific author within the last week.
 */
export const getProcessedOpportunitiesCountByAuthorAndWeek = async (
  author: string
): Promise<number> => {
  if (!db) {
    console.error(
      "[getProcessedOpportunitiesCountByAuthorAndWeek] Firestore not initialized."
    );
    // Depending on desired error handling, you might throw or return a specific value indicating an error.
    return 0; // Returning 0 as a fallback, consider if this is appropriate for your logic.
  }
  if (!author) {
    console.warn(
      "[getProcessedOpportunitiesCountByAuthorAndWeek] Called with empty author."
    );
    return 0;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoTimestamp = Timestamp.fromDate(oneWeekAgo);

  try {
    const query = db
      .collection(PROCESSED_OPPORTUNITIES_COLLECTION_NAME)
      .where("author", "==", author)
      .where("processedAt", ">=", oneWeekAgoTimestamp);

    // Use getCount() for efficiency if only the count is needed.
    const snapshot = await query.count().get();
    const count = snapshot.data().count;

    console.log(
      `[getProcessedOpportunitiesCountByAuthorAndWeek] Author ${author} has ${count} processed opportunities in the last week.`
    );
    return count;
  } catch (error) {
    console.error(
      `[getProcessedOpportunitiesCountByAuthorAndWeek] Error fetching count for author ${author}:`,
      error
    );
    return 0; // Fallback on error, consider implications.
  }
};

// Refactoring Summary:
// - `getOpportunitiesFromCsv` (reads local CSV) is a core function.
// - `getExcludedUrls` (helper) fetches URLs from processed items and the unavailable list.
// - `getNewAvailableOpportunitiesFromCsv` (replaces the old Firestore-based `getAvailableOpportunities`) uses the above to find new items from CSV.
// - `saveProcessedOpportunity` (new) saves a fully processed item to the `processed_opportunities` collection.
// - `getAllProcessedOpportunities` (replaces `getAllFirestoreOpportunities`) lists items from `processed_opportunities`.
// - `updateProcessedOppourtunity` (replaces `updateOppourtunity`) performs partial updates on items in `processed_opportunities`.
// - `markUrlAsUnavailable` (replaces `markOppourtunityAsUnavailable`) adds to `unavailable_urls` and updates status in `processed_opportunities`.
// - `importOpportunitiesFromCsvToFirestore` (bulk import to Firestore) was removed.

// The function `getAvailableOpportunities` and `updateOppourtunity` that were mentioned
// in the prompt for the original OPPORTUNITIES_COLLECTION_NAME are effectively
// replaced or refactored by the new functions above targeting different collections or logic.
// Specifically, the concept of "available" opportunities is now handled by reading the CSV
// and filtering, not by a status in a pre-populated Firestore collection.
// Updates are now performed on the 'processed_opportunities' collection via 'updateProcessedOppourtunity'.
