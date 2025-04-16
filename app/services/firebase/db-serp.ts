import { sanitizeKeywordForId } from '@/lib/utils';
import {
  FieldValue,
  FirestoreDataConverter,
  Timestamp
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { COLLECTIONS, db } from './db-config';

// --- Zod Schemas (no changes needed) ---
const searchResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url()
});
const serpAnalysisSchema = z.object({
  id: z.string(), // Document ID (will be the sanitized ID)
  keyword: z.string().min(1), // Original keyword
  timestamp: z.instanceof(Timestamp),
  serpResults: z.array(searchResultSchema),
  contentTypeAnalysis: z.any().optional().nullable(),
  userIntentAnalysis: z.any().optional().nullable(),
  titleAnalysis: z.any().optional().nullable(),
  contentTypeAnalysisText: z.string().optional().nullable(),
  userIntentAnalysisText: z.string().optional().nullable()
});
export type SerpAnalysisData = z.infer<typeof serpAnalysisSchema>;

// --- Firestore Converter (no changes needed in logic) ---
const serpAnalysisConverter: FirestoreDataConverter<SerpAnalysisData> = {
  toFirestore(
    // Use WithFieldValue for potential FieldValue types like serverTimestamp
    dataWithId: FirebaseFirestore.WithFieldValue<SerpAnalysisData>
  ): FirebaseFirestore.DocumentData {
    // Exclude the id field, as it's the document ID
    const { id, ...data } = dataWithId;

    // Create a new object containing only defined, non-null values from data,
    // preserving FieldValue instances (like serverTimestamp).
    const dataToSave: FirebaseFirestore.DocumentData = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key as keyof typeof data]; // Type assertion
        if (value !== undefined && value !== null) {
          // Check if it's a FieldValue instance (like serverTimestamp)
          if (
            value instanceof FieldValue ||
            typeof value !== 'object' ||
            Array.isArray(value)
          ) {
            dataToSave[key] = value;
          } else if (value instanceof Timestamp) {
            // Explicitly handle Timestamp
            dataToSave[key] = value;
          } else if (typeof value === 'object') {
            // Handle nested objects (like serpResults)
            // Ensure nested objects/arrays are also handled correctly if needed
            // For serpResults, it's an array of objects, which Firestore handles
            dataToSave[key] = value;
          }
          // Add more specific checks if other complex types are present
        }
      }
    }

    // Ensure the timestamp is always set or updated on save/update
    dataToSave.timestamp = FieldValue.serverTimestamp();

    return dataToSave;
  },
  fromFirestore(
    snapshot: FirebaseFirestore.QueryDocumentSnapshot
  ): SerpAnalysisData {
    const data = snapshot.data();
    const getOptionalField = (fieldName: string) =>
      data[fieldName] === undefined ? null : data[fieldName];

    return {
      id: snapshot.id,
      keyword: data.keyword,
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

// --- Firestore Collection Reference (no changes needed) ---
const getSerpCollection = () => {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }
  return db
    .collection(COLLECTIONS.SERP_ANALYSIS)
    .withConverter(serpAnalysisConverter);
};

// --- Modified saveSerpAnalysis ---
/**
 * Saves or updates SERP analysis data using a sanitized ID derived from the keyword.
 * @param rawKeyword The original keyword string.
 * @param data Partial data to save.
 */
export async function saveSerpAnalysis(
  rawKeyword: string,
  data: Partial<Omit<SerpAnalysisData, 'id' | 'timestamp' | 'keyword'>> // Exclude keyword as it comes from rawKeyword
): Promise<void> {
  const trimmedKeyword = rawKeyword?.trim();
  if (!trimmedKeyword) {
    throw new Error('Keyword cannot be empty.');
  }

  const sanitizedId = sanitizeKeywordForId(trimmedKeyword);
  if (!sanitizedId) {
    throw new Error(
      'Failed to generate a valid sanitized ID from the keyword.'
    );
  }

  // Prepare the object to validate (add original keyword and sanitized id for validation)
  const dataToValidate = { id: sanitizedId, keyword: trimmedKeyword, ...data };

  // Validate using the full schema, but make fields partial for merge
  const validationResult = serpAnalysisSchema
    .partial()
    .safeParse(dataToValidate);

  if (!validationResult.success) {
    console.error(
      `[Firestore] Zod validation failed for saving SERP data (ID: ${sanitizedId}, Keyword: ${trimmedKeyword}):`,
      validationResult.error.flatten()
    );
    throw new Error(
      `Invalid data format for saving SERP analysis: ${validationResult.error.message}`
    );
  }

  // Get the validated data, ensuring the original keyword is included
  const validatedDataToSave = {
    ...validationResult.data,
    keyword: trimmedKeyword // Ensure original keyword is explicitly set
  };

  try {
    const docRef = getSerpCollection().doc(sanitizedId); // Use sanitized ID for the document
    console.log(
      `[Firestore] Saving SERP analysis (ID: ${sanitizedId}, Keyword: ${trimmedKeyword})`
    );

    // Pass the validated data (converter handles id/timestamp)
    await docRef.set(validatedDataToSave as any, { merge: true });

    console.log(
      `[Firestore] Successfully saved SERP analysis (ID: ${sanitizedId})`
    );
  } catch (error) {
    console.error(
      `[Firestore] Error saving SERP analysis (ID: ${sanitizedId}, Keyword: ${trimmedKeyword}):`,
      error
    );
    throw new Error(
      `Failed to save SERP analysis data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// --- Renamed getSerpAnalysis to getSerpAnalysisBySanitizedId ---
/**
 * Retrieves SERP analysis data using the sanitized keyword ID.
 * @param sanitizedId The sanitized keyword string used as document ID.
 * @returns The validated SerpAnalysisData object or null if not found or validation fails.
 */
export async function getSerpAnalysisBySanitizedId(
  sanitizedId: string
): Promise<SerpAnalysisData | null> {
  if (!sanitizedId || sanitizedId.trim() === '') {
    // Changed error message to reflect sanitized ID
    throw new Error('Sanitized ID cannot be empty.');
  }
  try {
    const docRef = getSerpCollection().doc(sanitizedId); // Use sanitized ID
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      console.log(
        `[Firestore] Found existing SERP analysis for ID: ${sanitizedId}`
      );
      const convertedData = docSnap.data();
      if (!convertedData) {
        console.error(
          `[Firestore] Document exists but data is null for ID ${sanitizedId}.`
        );
        return null;
      }

      // Validate the data retrieved from Firestore
      const validationResult = serpAnalysisSchema.safeParse(convertedData);
      if (!validationResult.success) {
        console.error(
          `[Firestore] Zod validation failed for retrieved SERP data (ID: ${sanitizedId}):`,
          validationResult.error.flatten()
        );
        return null;
      }

      console.log(
        `[Firestore] Zod validation successful for ID ${sanitizedId}.`
      );
      return validationResult.data;
    } else {
      console.log(
        `[Firestore] No existing SERP analysis found for ID: ${sanitizedId}`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[Firestore] Error fetching SERP analysis for ID ${sanitizedId}:`,
      error
    );
    throw new Error(
      `Failed to fetch SERP analysis data: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ... (Keep getSerpAnalysisList function - it returns raw keywords/IDs)
// Modify getSerpAnalysisList to return original keywords if needed, or keep IDs?
// Let's keep it returning IDs (sanitized IDs) for consistency with how data is fetched by ID.
/**
 * Retrieves a list of all sanitized IDs (document IDs) that have SERP analysis data.
 * @returns An array of sanitized ID strings.
 */
export async function getSerpAnalysisList(): Promise<string[]> {
  try {
    if (!db) {
      throw new Error('Firestore is not initialized.');
    }
    const collectionRef = db.collection(COLLECTIONS.SERP_ANALYSIS);
    const snapshot = await collectionRef.select().get();
    const ids: string[] = [];
    snapshot.forEach(doc => {
      ids.push(doc.id);
    });
    console.log(
      `[Firestore] Fetched ${ids.length} existing SERP analysis IDs.`
    );
    return ids;
  } catch (error) {
    console.error('[Firestore] Error fetching SERP analysis list:', error);
    throw new Error(
      `Failed to fetch SERP analysis list: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
