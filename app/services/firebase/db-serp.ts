import {
  FieldValue,
  FirestoreDataConverter,
  Timestamp
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { COLLECTIONS, db } from './db-config';
// --- NEW: Import specific JSON schemas ---

// Helper for normalizing keywords for querying
const normalizeKeyword = (keyword: string): string => {
  return keyword.trim().toLowerCase();
};

// --- Detailed Zod Schemas based on Apify Structure ---

const searchQuerySchema = z
  .object({
    term: z.string().optional().nullable(),
    url: z.string().url().optional().nullable(),
    device: z.string().optional().nullable(),
    page: z.number().int().optional().nullable(),
    type: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
    countryCode: z.string().optional().nullable(),
    languageCode: z.string().optional().nullable(),
    locationUule: z.string().optional().nullable(),
    resultsPerPage: z.string().optional().nullable() // Often a string like "100"
  })
  .optional()
  .nullable();

const relatedQuerySchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable()
});

const aiOverviewSourceSchema = z.object({
  // Define structure if known, otherwise keep flexible
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable()
});

const aiOverviewSchema = z
  .object({
    type: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    sources: z.array(aiOverviewSourceSchema).optional().nullable()
  })
  .optional()
  .nullable();

// Basic schemas for potentially empty or unknown structures
const paidResultSchema = z.record(z.any()).optional().nullable(); // Allow any structure
const paidProductSchema = z.record(z.any()).optional().nullable();
const peopleAlsoAskSchema = z.record(z.any()).optional().nullable();

const siteLinkSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable() // Added based on organicResults example
});

const productInfoSchema = z.record(z.any()).optional().nullable(); // Keep flexible

// Renamed and expanded schema for Organic Results
const organicResultSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional().nullable(),
  displayedUrl: z.string().optional().nullable(),
  emphasizedKeywords: z.array(z.string()).optional().nullable(),
  siteLinks: z.array(siteLinkSchema).optional().nullable(),
  productInfo: productInfoSchema,
  type: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // Keep as string, parsing can be complex
  views: z.string().optional().nullable(),
  lastUpdated: z.string().optional().nullable(),
  commentsAmount: z.string().optional().nullable(),
  followersAmount: z.string().optional().nullable(),
  likes: z.string().optional().nullable(),
  channelName: z.string().optional().nullable()
});

// --- Main Document Schema (Reverted to z.any()) ---
const serpAnalysisSchema = z.object({
  originalKeyword: z.string().min(1),
  normalizedKeyword: z.string().min(1),
  timestamp: z.instanceof(Timestamp),

  // Added top-level fields from Apify response
  searchQuery: searchQuerySchema,
  resultsTotal: z.number().int().optional().nullable(),
  relatedQueries: z.array(relatedQuerySchema).optional().nullable(),
  aiOverview: aiOverviewSchema,
  paidResults: z.array(paidResultSchema).optional().nullable(), // Use array of basic schema
  paidProducts: z.array(paidProductSchema).optional().nullable(), // Use array of basic schema
  peopleAlsoAsk: z.array(peopleAlsoAskSchema).optional().nullable(), // Use array of basic schema

  // Renamed field to use the expanded organic result schema
  organicResults: z.array(organicResultSchema).optional().nullable(), // Use new detailed schema

  // --- REVERTED: Keep analysis fields as z.any() for now ---
  contentTypeAnalysis: z.any().optional().nullable(),
  userIntentAnalysis: z.any().optional().nullable(),
  titleAnalysis: z.any().optional().nullable(),
  contentTypeAnalysisText: z.string().optional().nullable(),
  userIntentAnalysisText: z.string().optional().nullable()
});

// Type for data stored in Firestore (without id)
export type FirebaseSerpAnalysisDoc = z.infer<typeof serpAnalysisSchema>;
// Type for data returned from functions (including id)
export type SerpAnalysisData = FirebaseSerpAnalysisDoc & { id: string };

// --- Firestore Converter ---
const serpAnalysisConverter: FirestoreDataConverter<SerpAnalysisData> = {
  toFirestore(
    data: FirebaseFirestore.WithFieldValue<FirebaseSerpAnalysisDoc>
  ): FirebaseFirestore.DocumentData {
    // Pass through validated data, ensure server timestamp
    const dataToSave: FirebaseFirestore.DocumentData = {
      ...data,
      // --- UPDATED: Avoid spread types for conditional properties ---
      timestamp: FieldValue.serverTimestamp() // Overwrite timestamp
    };
    // Conditionally add fields instead of using spread
    if (data.relatedQueries !== undefined)
      dataToSave.relatedQueries = data.relatedQueries;
    if (data.aiOverview !== undefined) dataToSave.aiOverview = data.aiOverview;
    if (data.paidResults !== undefined)
      dataToSave.paidResults = data.paidResults;
    if (data.paidProducts !== undefined)
      dataToSave.paidProducts = data.paidProducts;
    if (data.peopleAlsoAsk !== undefined)
      dataToSave.peopleAlsoAsk = data.peopleAlsoAsk;
    if (data.organicResults !== undefined)
      dataToSave.organicResults = data.organicResults;
    // --- End Update ---

    // Remove undefined fields explicitly (optional, Firestore might handle it)
    Object.keys(dataToSave).forEach(
      key => dataToSave[key] === undefined && delete dataToSave[key]
    );
    return dataToSave;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): SerpAnalysisData {
    const data = snapshot.data();
    // Helper function to safely get potentially missing optional fields
    const getOptionalField = (
      obj: any,
      fieldName: string,
      defaultValue: any = null
    ) => (obj?.[fieldName] === undefined ? defaultValue : obj[fieldName]);

    // Construct the returned object, mapping all fields
    const returnData: SerpAnalysisData = {
      id: snapshot.id,
      originalKeyword: data.originalKeyword,
      normalizedKeyword: data.normalizedKeyword,
      timestamp: data.timestamp,

      // Map new top-level fields
      searchQuery: getOptionalField(data, 'searchQuery'),
      resultsTotal: getOptionalField(data, 'resultsTotal'),
      relatedQueries: getOptionalField(data, 'relatedQueries', []),
      aiOverview: getOptionalField(data, 'aiOverview'),
      paidResults: getOptionalField(data, 'paidResults', []),
      paidProducts: getOptionalField(data, 'paidProducts', []),
      peopleAlsoAsk: getOptionalField(data, 'peopleAlsoAsk', []),

      // Map organic results using its detailed structure (handle potential missing fields inside map if needed)
      organicResults: getOptionalField(data, 'organicResults', []).map(
        (res: any) => ({
          position: getOptionalField(res, 'position', 0), // Default to 0 or throw error if required
          title: getOptionalField(res, 'title', ''), // Default to empty string
          url: getOptionalField(res, 'url', ''),
          description: getOptionalField(res, 'description'),
          displayedUrl: getOptionalField(res, 'displayedUrl'),
          emphasizedKeywords: getOptionalField(res, 'emphasizedKeywords', []),
          siteLinks: getOptionalField(res, 'siteLinks', []),
          productInfo: getOptionalField(res, 'productInfo', {}),
          type: getOptionalField(res, 'type'),
          date: getOptionalField(res, 'date'),
          views: getOptionalField(res, 'views'),
          lastUpdated: getOptionalField(res, 'lastUpdated'),
          commentsAmount: getOptionalField(res, 'commentsAmount'),
          followersAmount: getOptionalField(res, 'followersAmount'),
          likes: getOptionalField(res, 'likes'),
          channelName: getOptionalField(res, 'channelName')
        })
      ),

      // Map existing analysis fields
      contentTypeAnalysis: getOptionalField(data, 'contentTypeAnalysis'),
      userIntentAnalysis: getOptionalField(data, 'userIntentAnalysis'),
      titleAnalysis: getOptionalField(data, 'titleAnalysis'),
      contentTypeAnalysisText: getOptionalField(
        data,
        'contentTypeAnalysisText'
      ),
      userIntentAnalysisText: getOptionalField(data, 'userIntentAnalysisText')
    };
    return returnData;
  }
};

// --- Firestore Collection Reference ---
const getSerpCollection = () => {
  if (!db) throw new Error('Firestore is not initialized.');
  return db
    .collection(COLLECTIONS.SERP_ANALYSIS)
    .withConverter(serpAnalysisConverter);
};

// --- Modified saveSerpAnalysis ---
/**
 * Saves or updates SERP analysis data including full Apify results.
 * If docId is provided, it updates the existing document.
 * If docId is not provided, it creates a new document using .add().
 * Requires originalKeyword when creating.
 * @param data Partial data including potential full Apify structure.
 * @param docId Optional Firestore document ID for updates.
 * @returns The document ID (either new or existing).
 */
export async function saveSerpAnalysis(
  // Input type now reflects the possibility of including the full Apify structure
  data: Partial<FirebaseSerpAnalysisDoc> & { originalKeyword?: string },
  docId?: string
): Promise<string> {
  const collectionRef = getSerpCollection();

  try {
    if (docId) {
      // --- Update existing document ---
      console.log(`[Firestore] Updating SERP analysis (ID: ${docId})`);
      const docRef = collectionRef.doc(docId);
      // Prepare update data - ensure nested structures are handled if present in partial data
      // The converter's toFirestore handles the main structure and timestamp.
      const updateData: FirebaseFirestore.WithFieldValue<
        Partial<FirebaseSerpAnalysisDoc>
      > = {
        ...data
        // No specific mapping needed here unless transforming data before save
      };
      await docRef.set(updateData, { merge: true });
      console.log(
        `[Firestore] Successfully updated SERP analysis (ID: ${docId})`
      );
      return docId;
    } else {
      // --- Create new document ---
      if (!data.originalKeyword) {
        throw new Error(
          'Original keyword is required to create a new SERP analysis.'
        );
      }
      const normalizedKeyword = normalizeKeyword(data.originalKeyword);
      console.log(
        `[Firestore] Creating new SERP analysis for keyword: ${data.originalKeyword} (Normalized: ${normalizedKeyword})`
      );

      // Construct the full document data for creation, mapping all fields from input
      const dataToCreate: FirebaseSerpAnalysisDoc = {
        originalKeyword: data.originalKeyword,
        normalizedKeyword: normalizedKeyword,
        timestamp: Timestamp.now(), // Will be overwritten by converter

        // Map all new fields, providing defaults
        searchQuery: data.searchQuery ?? null,
        resultsTotal: data.resultsTotal ?? null,
        relatedQueries: data.relatedQueries ?? [],
        aiOverview: data.aiOverview ?? null,
        paidResults: data.paidResults ?? [],
        paidProducts: data.paidProducts ?? [],
        peopleAlsoAsk: data.peopleAlsoAsk ?? [],
        organicResults: data.organicResults ?? [], // Assume input `data.organicResults` has the full structure

        // Existing analysis fields default to null
        contentTypeAnalysis: data.contentTypeAnalysis ?? null,
        userIntentAnalysis: data.userIntentAnalysis ?? null,
        titleAnalysis: data.titleAnalysis ?? null,
        contentTypeAnalysisText: data.contentTypeAnalysisText ?? null,
        userIntentAnalysisText: data.userIntentAnalysisText ?? null
      };

      // Validate the structure before creation using the updated full schema
      const validationResult = serpAnalysisSchema.safeParse(dataToCreate);
      if (!validationResult.success) {
        console.error(
          `[Firestore] Zod validation failed before creating SERP data:`,
          validationResult.error.flatten()
        );
        throw new Error(
          `Invalid data format for creating SERP analysis: ${validationResult.error.message}`
        );
      }

      // Pass the validated data to add(), use type assertion `as any`
      const docRef = await collectionRef.add(validationResult.data as any);
      console.log(
        `[Firestore] Successfully created SERP analysis (ID: ${docRef.id})`
      );
      return docRef.id;
    }
  } catch (error) {
    console.error(
      `[Firestore] Error saving SERP analysis (ID: ${docId || 'New'}):`,
      error
    );
    throw new Error(
      `Failed to save SERP analysis data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Find by Keyword (No change needed in logic) ---
export async function findSerpAnalysisByKeyword(
  originalKeyword: string
): Promise<SerpAnalysisData | null> {
  const normalizedKeyword = normalizeKeyword(originalKeyword);
  console.log(
    `[Firestore] Querying for normalized keyword: ${normalizedKeyword}`
  );
  try {
    const querySnapshot = await getSerpCollection()
      .where('normalizedKeyword', '==', normalizedKeyword)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      console.log(
        `[Firestore] No analysis found for normalized keyword: ${normalizedKeyword}`
      );
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    console.log(
      `[Firestore] Found analysis ID: ${docSnap.id} for normalized keyword: ${normalizedKeyword}`
    );
    return docSnap.data(); // Converter adds the id and handles mapping
  } catch (error) {
    console.error(
      `[Firestore] Error finding SERP analysis by keyword ${normalizedKeyword}:`,
      error
    );
    throw error;
  }
}

// --- Get by ID (No change needed in logic) ---
export async function getSerpAnalysisById(
  docId: string
): Promise<SerpAnalysisData | null> {
  if (!docId) throw new Error('Document ID cannot be empty.');
  console.log(`[Firestore] Fetching analysis by ID: ${docId}`);
  try {
    const docRef = getSerpCollection().doc(docId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      console.log(`[Firestore] Found SERP analysis for ID: ${docId}`);
      return docSnap.data() ?? null; // Converter handles mapping
    } else {
      console.log(`[Firestore] No SERP analysis found for ID: ${docId}`);
      return null;
    }
  } catch (error) {
    console.error(
      `[Firestore] Error fetching SERP analysis for ID ${docId}:`,
      error
    );
    throw error; // Re-throw or handle as needed
  }
}

// --- Get List (No change needed) ---
export async function getSerpAnalysisList(): Promise<
  { id: string; keyword: string }[]
> {
  console.log('[Firestore] Fetching SERP analysis list (ID and Keyword)...');
  try {
    const snapshot = await getSerpCollection()
      .orderBy('timestamp', 'desc') // Order by timestamp perhaps?
      // Select only necessary fields for the list
      .select('originalKeyword')
      .get();

    const list: { id: string; keyword: string }[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data?.originalKeyword) {
        // Ensure keyword exists
        list.push({ id: doc.id, keyword: data.originalKeyword });
      }
    });
    console.log(
      `[Firestore] Fetched ${list.length} existing SERP analysis entries.`
    );
    return list;
  } catch (error) {
    console.error('[Firestore] Error fetching SERP analysis list:', error);
    throw error;
  }
}

// --- NEW: Delete by ID ---
/**
 * Deletes a SERP analysis document by its Firestore ID.
 * @param docId The Firestore document ID to delete.
 * @returns Promise<void>
 */
export async function deleteSerpAnalysisById(docId: string): Promise<void> {
  if (!docId) throw new Error('Document ID cannot be empty for deletion.');
  console.log(`[Firestore] Attempting to delete analysis by ID: ${docId}`);
  try {
    const docRef = getSerpCollection().doc(docId);
    await docRef.delete();
    console.log(
      `[Firestore] Successfully deleted SERP analysis for ID: ${docId}`
    );
  } catch (error) {
    console.error(
      `[Firestore] Error deleting SERP analysis for ID ${docId}:`,
      error
    );
    throw new Error(
      `Failed to delete SERP analysis data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
