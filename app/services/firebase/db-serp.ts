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

// --- NEW: Schemas for Analysis JSON structures ---
const pageReferenceSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url()
});

const contentTypeAnalysisJsonSchema = z.object({
  analysisTitle: z.string(),
  reportDescription: z.string(),
  usageHint: z.string(),
  contentTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().nonnegative(),
      pages: z.array(pageReferenceSchema)
    })
  )
});
// Export inferred type for use in actions if needed elsewhere, though maybe not strictly necessary if actions re-define
export type ContentTypeAnalysisJson = z.infer<
  typeof contentTypeAnalysisJsonSchema
>;

const userIntentAnalysisJsonSchema = z.object({
  analysisTitle: z.string(),
  reportDescription: z.string(),
  usageHint: z.string(),
  intents: z.array(
    z.object({
      category: z.enum([
        'Navigational',
        'Informational',
        'Commercial',
        'Transactional'
      ]),
      specificIntent: z.string(),
      count: z.number().int().nonnegative(),
      pages: z.array(pageReferenceSchema)
    })
  ),
  relatedKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        searchVolume: z.number().nullable()
      })
    )
    .optional()
});
// Export inferred type for use in actions if needed elsewhere
export type UserIntentAnalysisJson = z.infer<
  typeof userIntentAnalysisJsonSchema
>;

// Schema for Title Analysis JSON structure (No rename needed)
const titleAnalysisOutputSchema = z.object({
  title: z.string(),
  analysis: z.string(),
  recommendations: z.array(z.string())
});
export type TitleAnalysisJson = z.infer<typeof titleAnalysisOutputSchema>; // Export inferred type

// --- Main Document Schema (REVERTED) ---
const serpAnalysisSchema = z.object({
  originalKeyword: z.string().min(1),
  normalizedKeyword: z.string().min(1),
  timestamp: z.instanceof(Timestamp),

  // Added top-level fields from Apify response
  searchQuery: searchQuerySchema,
  resultsTotal: z.number().int().optional().nullable(),
  relatedQueries: z.array(relatedQuerySchema).optional().nullable(),
  aiOverview: aiOverviewSchema,
  paidResults: z.array(paidResultSchema).optional().nullable(),
  paidProducts: z.array(paidProductSchema).optional().nullable(),
  peopleAlsoAsk: z.array(peopleAlsoAskSchema).optional().nullable(),

  // Renamed field to use the expanded organic result schema
  organicResults: z.array(organicResultSchema).optional().nullable(),

  // --- REVERTED: Keep both Text and JSON analysis fields --- 
  contentTypeAnalysis: contentTypeAnalysisJsonSchema.optional().nullable(), 
  userIntentAnalysis: userIntentAnalysisJsonSchema.optional().nullable(), 
  titleAnalysis: titleAnalysisOutputSchema.optional().nullable(),
  // --- RE-ADD Text fields --- 
  contentTypeAnalysisText: z.string().optional().nullable(),
  userIntentAnalysisText: z.string().optional().nullable()
});

// Type for data stored in Firestore (without id)
// --- UPDATED: Type reflects schema changes ---
export type FirebaseSerpAnalysisDoc = z.infer<typeof serpAnalysisSchema>;
// Type for data returned from functions (including id)
export type SerpAnalysisData = FirebaseSerpAnalysisDoc & { id: string };

// --- Firestore Converter (REVERTED) ---
const serpAnalysisConverter: FirestoreDataConverter<SerpAnalysisData> = {
  toFirestore(
    data: FirebaseFirestore.WithFieldValue<Partial<FirebaseSerpAnalysisDoc>> // Use Partial for updates
  ): FirebaseFirestore.DocumentData {
    const dataToSave: FirebaseFirestore.DocumentData = {
      ...data, // Spread the partial data
      timestamp: FieldValue.serverTimestamp() // Always set/update timestamp
    };

    // --- UPDATED: Handle optional fields (both JSON and Text) --- 
    if (data.contentTypeAnalysis !== undefined) {
      dataToSave.contentTypeAnalysis = data.contentTypeAnalysis; 
    }
    if (data.userIntentAnalysis !== undefined) {
      dataToSave.userIntentAnalysis = data.userIntentAnalysis; 
    }
    if (data.titleAnalysis !== undefined) {
      dataToSave.titleAnalysis = data.titleAnalysis; 
    }
    if (data.contentTypeAnalysisText !== undefined) {
      dataToSave.contentTypeAnalysisText = data.contentTypeAnalysisText;
    }
    if (data.userIntentAnalysisText !== undefined) {
      dataToSave.userIntentAnalysisText = data.userIntentAnalysisText;
    }
    // Keep existing conditional logic for other fields
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
    if (data.searchQuery !== undefined)
      dataToSave.searchQuery = data.searchQuery;
    if (data.resultsTotal !== undefined)
      dataToSave.resultsTotal = data.resultsTotal;
    // --- End Update ---

    // Remove undefined properties
    Object.keys(dataToSave).forEach(
      key => dataToSave[key] === undefined && delete dataToSave[key]
    );
    return dataToSave;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): SerpAnalysisData {
    const data = snapshot.data();
    const getOptionalField = (
      obj: any,
      fieldName: string,
      defaultValue: any = null 
    ) => (obj?.[fieldName] === undefined ? defaultValue : obj[fieldName]);

    // --- UPDATED: Map all fields (Text and JSON) --- 
    const returnData: SerpAnalysisData = {
      id: snapshot.id,
      originalKeyword: data.originalKeyword,
      normalizedKeyword: data.normalizedKeyword,
      timestamp: data.timestamp,

      // Map top-level fields
      searchQuery: getOptionalField(data, 'searchQuery'),
      resultsTotal: getOptionalField(data, 'resultsTotal'),
      relatedQueries: getOptionalField(data, 'relatedQueries', []),
      aiOverview: getOptionalField(data, 'aiOverview'),
      paidResults: getOptionalField(data, 'paidResults', []),
      paidProducts: getOptionalField(data, 'paidProducts', []),
      peopleAlsoAsk: getOptionalField(data, 'peopleAlsoAsk', []),

      // Map organic results
      organicResults: getOptionalField(data, 'organicResults', []).map(
        (res: any) => ({
          position: getOptionalField(res, 'position', 0), 
          title: getOptionalField(res, 'title', ''), 
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

      // Map analysis fields (JSON and Text)
      contentTypeAnalysis: getOptionalField(data, 'contentTypeAnalysis'), 
      userIntentAnalysis: getOptionalField(data, 'userIntentAnalysis'), 
      titleAnalysis: getOptionalField(data, 'titleAnalysis'),
      contentTypeAnalysisText: getOptionalField(data, 'contentTypeAnalysisText'), 
      userIntentAnalysisText: getOptionalField(data, 'userIntentAnalysisText')
    };

    return returnData;
  }
};

// --- Firestore Collection Reference (REVERTED) ---
// Remove getSerpCollectionRef
const getSerpCollection = () => {
  if (!db) throw new Error('Firestore is not initialized.');
  // Use converter directly
  return db
    // Use the correct collection name
    .collection(COLLECTIONS.SERP_DATA) 
    .withConverter(serpAnalysisConverter);
};

// --- Modified saveSerpAnalysis (REVERTED) ---
/**
 * Saves or updates SERP analysis data.
 * Handles partial updates with merge.
 * Initializes new documents with null analysis fields.
 * @param data Partial data matching FirebaseSerpAnalysisDoc structure.
 * @param docId Optional Firestore document ID for updates.
 * @returns The document ID (either new or existing).
 */
export async function saveSerpAnalysis(
  data: Partial<FirebaseSerpAnalysisDoc> & { originalKeyword?: string },
  docId?: string
): Promise<string> {
  const collectionRef = getSerpCollection(); // Use the direct converted ref

  try {
    if (docId) {
      // --- Update existing document ---
      console.log(`[Firestore] Updating SERP analysis (ID: ${docId})`);
      const docRef = collectionRef.doc(docId);
      const updateData: FirebaseFirestore.WithFieldValue<
        Partial<FirebaseSerpAnalysisDoc>
      > = {
        ...data 
        // Timestamp handled by converter on update
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

      // --- REVERTED: Initialize Text and JSON fields to null ---
      const dataToCreate: FirebaseSerpAnalysisDoc = {
        originalKeyword: data.originalKeyword,
        normalizedKeyword: normalizedKeyword,
        timestamp: Timestamp.now(), // Placeholder, converter handles final timestamp

        // Map Apify fields
        searchQuery: data.searchQuery ?? null,
        resultsTotal: data.resultsTotal ?? null,
        relatedQueries: data.relatedQueries ?? [],
        aiOverview: data.aiOverview ?? null,
        paidResults: data.paidResults ?? [],
        paidProducts: data.paidProducts ?? [],
        peopleAlsoAsk: data.peopleAlsoAsk ?? [],
        organicResults: data.organicResults ?? [],

        // Initialize ALL analysis fields to null
        contentTypeAnalysis: null,
        userIntentAnalysis: null,
        titleAnalysis: null,
        contentTypeAnalysisText: null,
        userIntentAnalysisText: null
      };

      // Merge any analysis data provided in the input (e.g., if fetched data included it)
      // This allows initiating with fetched Apify data AND potentially pre-existing analysis
      Object.assign(dataToCreate, data); 

      // Validate the final structure for creation
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

      // --- REVERTED: Use collectionRef.add directly, converter handles types/timestamp ---
      // Type assertion might be needed if TS inference struggles
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

// --- Find by Keyword (Reverted to use getSerpCollection) ---
export async function findSerpAnalysisByKeyword(
  originalKeyword: string
): Promise<SerpAnalysisData | null> {
  const normalizedKeyword = normalizeKeyword(originalKeyword);
  console.log(
    `[Firestore] Querying for normalized keyword: ${normalizedKeyword}`
  );
  try {
    const querySnapshot = await getSerpCollection() // Use reverted function
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

// --- Get by ID (Reverted to use getSerpCollection) ---
export async function getSerpAnalysisById(
  docId: string
): Promise<SerpAnalysisData | null> {
  if (!docId) throw new Error('Document ID cannot be empty.');
  console.log(`[Firestore] Fetching analysis by ID: ${docId}`);
  try {
    const docRef = getSerpCollection().doc(docId); // Use reverted function
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

// --- Get List (Reverted to use getSerpCollection) ---
export async function getSerpAnalysisList(): Promise<
  { id: string; keyword: string }[]
> {
  console.log('[Firestore] Fetching SERP analysis list (ID and Keyword)...');
  try {
    const snapshot = await getSerpCollection() // Use reverted function
      .orderBy('timestamp', 'desc') 
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

// --- Delete by ID (Reverted to use getSerpCollection) ---
/**
 * Deletes a SERP analysis document by its Firestore ID.
 * @param docId The Firestore document ID to delete.
 * @returns Promise<void>
 */
export async function deleteSerpAnalysisById(docId: string): Promise<void> {
  if (!docId) throw new Error('Document ID cannot be empty for deletion.');
  console.log(`[Firestore] Attempting to delete analysis by ID: ${docId}`);
  try {
    const docRef = getSerpCollection().doc(docId); // Use reverted function
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
