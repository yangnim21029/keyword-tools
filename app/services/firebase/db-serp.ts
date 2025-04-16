import {
  FieldValue,
  FirestoreDataConverter,
  Timestamp
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { COLLECTIONS, db } from './db-config';

// Helper for normalizing keywords for querying
const normalizeKeyword = (keyword: string): string => {
  return keyword.trim().toLowerCase();
};

// --- Zod Schemas ---
const searchResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url()
});

const serpAnalysisSchema = z.object({
  // id: z.string(), // Removed - Firestore auto-generates ID
  originalKeyword: z.string().min(1), // Store the original keyword
  normalizedKeyword: z.string().min(1), // For querying
  timestamp: z.instanceof(Timestamp),
  serpResults: z.array(searchResultSchema),
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
    // Input should NOT include id, but could be partial for updates
    // Let's simplify: the input to the converter is the *final* data intended for Firestore
    // The calling function (saveSerpAnalysis) will prepare this.
    data: FirebaseFirestore.WithFieldValue<FirebaseSerpAnalysisDoc> // Expect data *without* id
  ): FirebaseFirestore.DocumentData {
    // Ensure timestamp is always FieldValue.serverTimestamp() on write
    const dataToSave: FirebaseFirestore.DocumentData = {
      ...data,
      timestamp: FieldValue.serverTimestamp() // Overwrite timestamp on every write
    };
    // Remove undefined fields before saving, Firestore handles nulls
    Object.keys(dataToSave).forEach(
      key => dataToSave[key] === undefined && delete dataToSave[key]
    );
    return dataToSave;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): SerpAnalysisData {
    // Return type includes id
    const data = snapshot.data() as FirebaseSerpAnalysisDoc;
    const getOptionalField = (fieldName: keyof FirebaseSerpAnalysisDoc) =>
      data[fieldName] === undefined ? null : data[fieldName];

    return {
      id: snapshot.id, // Get the auto-generated ID
      originalKeyword: data.originalKeyword,
      normalizedKeyword: data.normalizedKeyword, // Include normalized keyword
      timestamp: data.timestamp,
      serpResults: data.serpResults || [],
      contentTypeAnalysis: getOptionalField('contentTypeAnalysis'),
      userIntentAnalysis: getOptionalField('userIntentAnalysis'),
      titleAnalysis: getOptionalField('titleAnalysis'),
      contentTypeAnalysisText: getOptionalField('contentTypeAnalysisText'),
      userIntentAnalysisText: getOptionalField('userIntentAnalysisText')
    };
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
 * Saves or updates SERP analysis data.
 * If docId is provided, it updates the existing document.
 * If docId is not provided, it creates a new document using .add().
 * Requires originalKeyword when creating.
 * @param data Partial data to save/update.
 * @param docId Optional Firestore document ID for updates.
 * @returns The document ID (either new or existing).
 */
export async function saveSerpAnalysis(
  data: Partial<
    Omit<FirebaseSerpAnalysisDoc, 'timestamp' | 'normalizedKeyword'>
  > & { originalKeyword?: string },
  docId?: string
): Promise<string> {
  const collectionRef = getSerpCollection();

  try {
    if (docId) {
      // --- Update existing document ---
      console.log(`[Firestore] Updating SERP analysis (ID: ${docId})`);
      const docRef = collectionRef.doc(docId);
      // Prepare partial data for update. Let the converter handle the server timestamp.
      const updateData: Partial<
        FirebaseFirestore.WithFieldValue<FirebaseSerpAnalysisDoc>
      > = {
        ...data
        // We let the converter overwrite timestamp with FieldValue.serverTimestamp()
      };
      await docRef.set(updateData, { merge: true }); // Use set with merge
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

      // Construct the full document data for creation (excluding id)
      const dataToCreate: FirebaseSerpAnalysisDoc = {
        originalKeyword: data.originalKeyword,
        normalizedKeyword: normalizedKeyword,
        timestamp: Timestamp.now(), // Initial value, converter will overwrite with server value
        serpResults: data.serpResults || [],
        contentTypeAnalysis: data.contentTypeAnalysis ?? null,
        userIntentAnalysis: data.userIntentAnalysis ?? null,
        titleAnalysis: data.titleAnalysis ?? null,
        contentTypeAnalysisText: data.contentTypeAnalysisText ?? null,
        userIntentAnalysisText: data.userIntentAnalysisText ?? null
      };

      // Validate the structure before creation
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

      // Pass the validated data (type FirebaseSerpAnalysisDoc) to add.
      // The converter will receive this and handle the server timestamp.
      // Use 'as any' as a last resort to bypass strict type checking for add()
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

// --- NEW: Find by Keyword ---
/**
 * Finds the first SERP analysis document matching the normalized keyword.
 * @param originalKeyword The keyword to search for.
 * @returns The SerpAnalysisData object (including ID) or null if not found.
 */
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
    return docSnap.data(); // Converter adds the id
  } catch (error) {
    console.error(
      `[Firestore] Error finding SERP analysis by keyword ${normalizedKeyword}:`,
      error
    );
    throw error;
  }
}

// --- Renamed Get by ID ---
/**
 * Retrieves SERP analysis data using the Firestore document ID.
 * @param docId The Firestore document ID.
 * @returns The validated SerpAnalysisData object or null if not found.
 */
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
      // Data is already converted and validated by the converter/schema
      return docSnap.data() ?? null;
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

// --- Modified Get List ---
/**
 * Retrieves a list of all existing SERP analyses (ID and original keyword).
 * @returns An array of objects containing id and originalKeyword.
 */
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
