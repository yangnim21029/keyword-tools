import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { COLLECTIONS, db } from "./db-config";

// --- Define Cache Tag --- //
const ONPAGE_DATA_TAG = "onPageData";
const ONPAGE_COLLECTION = COLLECTIONS.ONPAGE_RESULT; // Assuming you add this to db-config

/**
 * Interface representing the content extracted from a webpage.
 */
export interface ScrapedPageContent {
  url: string; // The original URL scraped
  title: string | null | undefined; // Extracted article title - Allow null/undefined
  textContent: string | null | undefined; // Plain text content of the article - Allow null/undefined
  htmlContent: string | null | undefined; // Cleaned HTML content of the article - Allow null/undefined
  excerpt?: string | null | undefined; // Article excerpt/summary - Allow undefined
  byline?: string | null | undefined; // Author information - Allow undefined
  length?: number | null; // Estimated length (e.g., characters or words)
  siteName?: string | null | undefined; // Name of the site - Allow undefined
  // extractedAt is handled by Firestore timestamps
}

// Schema/structure for storing in Firestore
export interface FirebaseOnPageResultObject extends ScrapedPageContent {
  id: string; // Firestore document ID
  status?: "pending" | "processing" | "complete" | "failed"; // Status of extraction/analysis
  createdAt: Timestamp;
  updatedAt: Timestamp;
  originalTextContent?: string | null | undefined; // Backup of the original text before AI organization
  // --- Add On-Page Analysis fields ---
  onPageContentAnalysisText?: string | null | undefined; // Stores raw text output of summary/keywords analysis
  onPageRankingFactorAnalysisV2Text?: string | null | undefined; // Stores raw text output of V2 ranking factor analysis
  onPageRankingFactorRecommendationText?: string | null | undefined; // Stores raw text output of V2 recommendation
  paragraphGraphText?: string | null | undefined; // Stores raw text output of paragraph graph generation
  refinedTextContent?: string | null | undefined; // Stores the AI-refined article based on the graph
  // Add future analysis fields here, e.g.:
  // keywordAnalysis?: any;
  // structureAnalysis?: any;
}

/**
 * Adds scraped page content to Firestore.
 */
export const addOnPageResult = async (
  data: ScrapedPageContent
): Promise<string | null> => {
  if (!db) throw new Error("Firestore is not initialized.");
  console.log(`[Firestore] Adding OnPage Result for URL: ${data.url}`);
  try {
    const collectionRef = db.collection(ONPAGE_COLLECTION);
    const dataToSave = {
      ...data,
      status: "complete", // Assuming scrape itself is complete
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const docRef = await collectionRef.add(dataToSave);
    console.log(`[Firestore] Added OnPage Result with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error(
      `[Firestore] Error adding OnPage Result for ${data.url}:`,
      error
    );
    return null;
  }
};

/**
 * Fetches a specific OnPage result document by its Firestore ID.
 */
export const getOnPageResultById = async (
  docId: string
): Promise<FirebaseOnPageResultObject | null> => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!docId) {
    console.warn("[Firestore] getOnPageResultById called with empty docId.");
    return null;
  }
  console.log(`[Firestore] Fetching OnPage Result by ID: ${docId}`);
  try {
    const docRef = db.collection(ONPAGE_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`[Firestore] No OnPage Result found for ID: ${docId}`);
      return null;
    }
    // Basic validation/casting - consider Zod schema for robustness later
    const data = {
      ...docSnap.data(),
      id: docSnap.id,
    } as FirebaseOnPageResultObject;
    console.log(`[Firestore] Found OnPage Result ID: ${docSnap.id}`);
    return data;
  } catch (error) {
    console.error(
      `[Firestore] Error fetching OnPage Result for ID ${docId}:`,
      error
    );
    throw error; // Re-throw for server components
  }
};

/**
 * Fetches a list of OnPage results (ID, URL, title, timestamp).
 */
export const getOnPageResultList = unstable_cache(
  async (
    limit = 50,
    offset = 0
  ): Promise<
    {
      id: string;
      url: string | null;
      title: string | null;
      timestamp: Timestamp;
    }[]
  > => {
    if (!db) throw new Error("Firestore is not initialized.");
    console.log(
      `[Firestore CACHED] Fetching OnPage list (limit: ${limit}, offset: ${offset})...`
    );
    try {
      const snapshot = await db
        .collection(ONPAGE_COLLECTION)
        .orderBy("updatedAt", "desc")
        .select("url", "title", "updatedAt")
        .limit(limit)
        .offset(offset)
        .get();

      const list: {
        id: string;
        url: string | null;
        title: string | null;
        timestamp: Timestamp;
      }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure timestamp exists and is valid
        if (data?.updatedAt instanceof Timestamp) {
          list.push({
            id: doc.id,
            url: data.url ?? null,
            title: data.title ?? null,
            timestamp: data.updatedAt,
          });
        } else {
          console.warn(
            `[Firestore List CACHED] Skipping OnPage doc ${doc.id} due to missing/invalid timestamp`
          );
        }
      });
      console.log(
        `[Firestore CACHED] Fetched ${list.length} OnPage list entries.`
      );
      return list;
    } catch (error) {
      console.error("[Firestore CACHED] Error fetching OnPage list:", error);
      throw error;
    }
  },
  ["getOnPageResultList"], // Cache key
  {
    tags: [ONPAGE_DATA_TAG],
    // revalidate: 3600 // Optional revalidation time
  }
);

/**
 * Gets the total count of OnPage result documents.
 */
export const getTotalOnPageResultCount = unstable_cache(
  async (): Promise<number> => {
    if (!db) throw new Error("Firestore is not initialized.");
    console.log(
      "[Firestore CACHED] Getting total count of OnPage documents..."
    );
    try {
      const snapshot = await db.collection(ONPAGE_COLLECTION).count().get();
      const count = snapshot.data().count;
      console.log(`[Firestore CACHED] Total OnPage documents count: ${count}`);
      return count;
    } catch (error) {
      console.error(
        "[Firestore CACHED] Error getting total OnPage count:",
        error
      );
      return 0; // Return 0 on error
    }
  },
  ["getTotalOnPageResultCount"], // Cache key
  {
    tags: [ONPAGE_DATA_TAG],
    // revalidate: 3600 // Optional revalidation time
  }
);

/**
 * Fetches OnPage results by a specific author within the last week.
 * @param author The author's name (byline).
 * @param researchId Optional researchId, currently unused in query but passed for context.
 * @returns A promise that resolves to an array of FirebaseOnPageResultObject.
 */
export const getOnPageResultsByAuthorAndWeek = async (
  author: string,
  researchId: string // researchId is not used in this specific query but kept for consistency
): Promise<FirebaseOnPageResultObject[]> => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!author) {
    console.warn(
      "[Firestore] getOnPageResultsByAuthorAndWeek called with empty author."
    );
    return [];
  }

  console.log(
    `[Firestore] Fetching OnPage Results for author: ${author} within the last week (Research ID: ${researchId}).`
  );

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoTimestamp = Timestamp.fromDate(oneWeekAgo);

  try {
    const querySnapshot = await db
      .collection(ONPAGE_COLLECTION)
      .where("byline", "==", author)
      .where("createdAt", ">=", oneWeekAgoTimestamp)
      // .orderBy("createdAt", "desc") // Optional: order by creation date
      .get();

    if (querySnapshot.empty) {
      console.log(
        `[Firestore] No OnPage Results found for author: ${author} in the last week.`
      );
      return [];
    }

    const results: FirebaseOnPageResultObject[] = [];
    querySnapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...(doc.data() as Omit<FirebaseOnPageResultObject, "id">),
      });
    });

    console.log(
      `[Firestore] Found ${results.length} OnPage Results for author: ${author} in the last week.`
    );
    return results;
  } catch (error) {
    console.error(
      `[Firestore] Error fetching OnPage Results for author ${author} in the last week: `,
      error
    );
    // Depending on error handling strategy, you might want to throw or return empty array
    return [];
  }
};

/**
 * Deletes a specific OnPage result document by its Firestore ID.
 * @param docId The ID of the document to delete.
 * @returns A promise that resolves to true if deletion was successful, false otherwise.
 */
export const deleteOnPageResultById = async (
  docId: string
): Promise<boolean> => {
  if (!db) throw new Error("Firestore is not initialized.");
  if (!docId) {
    console.warn("[Firestore] deleteOnPageResultById called with empty docId.");
    return false;
  }
  console.log(`[Firestore] Deleting OnPage Result by ID: ${docId}`);
  try {
    const docRef = db.collection(ONPAGE_COLLECTION).doc(docId);
    await docRef.delete();
    console.log(`[Firestore] Successfully deleted OnPage Result ID: ${docId}`);
    return true;
  } catch (error) {
    console.error(
      `[Firestore] Error deleting OnPage Result for ID ${docId}:`,
      error
    );
    return false;
  }
};

// TODO: Define COLLECTIONS.ONPAGE_RESULT in db-config.ts
// e.g., export const COLLECTIONS = { ..., ONPAGE_RESULT: 'onPageResults' };
