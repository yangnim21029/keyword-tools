import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './db-config';
import type { FirebaseSerpResultObject } from './schema';

export async function saveSerpDataDoc(
  dataToSave: Omit<FirebaseSerpResultObject, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Database not initialized');
  console.log('[DB-SERP-DATA] Saving new SERP data document...');
  try {
    const docData = {
      ...dataToSave,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      // Ensure nullable fields are handled correctly for Firestore
      urlOutline: dataToSave.urlOutline ?? null,
      contentTypeAnalysisText: dataToSave.contentTypeAnalysisText ?? null,
      userIntentAnalysisText: dataToSave.userIntentAnalysisText ?? null,
      contentTypeAnalysis: dataToSave.contentTypeAnalysis ?? null,
      userIntentAnalysis: dataToSave.userIntentAnalysis ?? null,
      titleAnalysis: dataToSave.titleAnalysis ?? null,
      organicResults: dataToSave.organicResults ?? null,
      peopleAlsoAsk: dataToSave.peopleAlsoAsk ?? null,
      relatedQueries: dataToSave.relatedQueries ?? null,
      paidResults: dataToSave.paidResults ?? null,
      paidProducts: dataToSave.paidProducts ?? null,
      aiOverview: dataToSave.aiOverview ?? null,
      searchQuery: dataToSave.searchQuery ?? null,
      resultsTotal: dataToSave.resultsTotal ?? null
    };
    const docRef = await db.collection(COLLECTIONS.SERP_RESULT).add(docData);
    console.log(`[DB-SERP-DATA] Saved document with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('[DB-SERP-DATA] Error saving SERP data document:', error);
    throw new Error(
      `Failed to save SERP data document: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Finds an existing SERP Data document based on query, region, and language.
 * Returns the newest match if multiple exist.
 * @param query
 * @param region
 * @param language
 * @returns The document data (including ID) or null if not found.
 */
export async function findSerpDataDoc(
  query: string,
  region: string,
  language: string
): Promise<(FirebaseSerpResultObject & { id: string }) | null> {
  if (!db) throw new Error('Database not initialized');
  console.log(
    `[DB-SERP-DATA] Searching for existing doc: Q=${query}, R=${region}, L=${language}`
  );
  try {
    const snapshot = await db
      .collection(COLLECTIONS.SERP_RESULT)
      .where('query', '==', query)
      .where('region', '==', region)
      .where('language', '==', language)
      .orderBy('createdAt', 'desc') // Get the most recent one
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log('[DB-SERP-DATA] No existing document found.');
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as FirebaseSerpResultObject;
    console.log(`[DB-SERP-DATA] Found existing document: ${doc.id}`);
    return { ...data, id: doc.id };
  } catch (error) {
    console.error('[DB-SERP-DATA] Error finding SERP data document:', error);
    throw new Error(
      `Failed to find SERP data document: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Updates a specific field in a SERP data document.
 * @param docId The ID of the document to update.
 * @param fieldName The name of the field to update (must be a key of FirebaseSerpResultObject).
 * @param value The new value for the field.
 * @returns True if update was successful.
 */
export async function updateSerpDataField<
  K extends keyof FirebaseSerpResultObject
>(
  docId: string,
  fieldName: K,
  value: FirebaseSerpResultObject[K]
): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!docId) throw new Error('Document ID is required for update');
  console.log(
    `[DB-SERP-DATA] Updating field '${String(fieldName)}' for doc: ${docId}`
  );
  try {
    await db
      .collection(COLLECTIONS.SERP_RESULT)
      .doc(docId)
      .update({
        [fieldName]: value,
        updatedAt: Timestamp.now()
      });
    console.log(
      `[DB-SERP-DATA] Successfully updated field '${String(
        fieldName
      )}' for doc: ${docId}`
    );
    return true;
  } catch (error) {
    console.error(
      `[DB-SERP-DATA] Error updating field '${String(
        fieldName
      )}' for doc ${docId}:`,
      error
    );
    throw new Error(
      `Failed to update field '${String(fieldName)}' for doc ${docId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Updates the urlOutline field of a specific SERP data document using updateSerpDataField.
 * @param docId The ID of the document to update.
 * @param outline The scraped outline string.
 * @returns True if update was successful.
 */
export async function updateSerpDataOutline(
  docId: string,
  outline: string | null // Allow null to clear it
): Promise<boolean> {
  return updateSerpDataField(docId, 'urlOutline', outline);
}

/**
 * Retrieves a specific SERP Data document by its ID.
 * @param docId The ID of the document to retrieve.
 * @returns The document data (including ID) or null if not found.
 */
export async function getSerpDataDocById(
  docId: string
): Promise<(FirebaseSerpResultObject & { id: string }) | null> {
  if (!db) throw new Error('Database not initialized');
  if (!docId) throw new Error('Document ID is required');
  console.log(`[DB-SERP-DATA] Getting document by ID: ${docId}`);
  try {
    const docSnap = await db
      .collection(COLLECTIONS.SERP_RESULT)
      .doc(docId)
      .get();
    if (!docSnap.exists) {
      console.log(`[DB-SERP-DATA] Document not found: ${docId}`);
      return null;
    }
    const data = docSnap.data() as FirebaseSerpResultObject;
    console.log(`[DB-SERP-DATA] Successfully retrieved document: ${docId}`);
    return { ...data, id: docSnap.id };
  } catch (error) {
    console.error(
      `[DB-SERP-DATA] Error getting document by ID ${docId}:`,
      error
    );
    throw new Error(
      `Failed to get document by ID ${docId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Deletes a specific SERP data document from Firestore.
 * @param docId The ID of the document to delete.
 * @returns True if deletion was successful.
 * @throws Throws error if deletion fails.
 */
export async function deleteSerpDataDocById(docId: string): Promise<boolean> {
  if (!db) throw new Error('Database not initialized');
  if (!docId) throw new Error('Document ID is required for deletion');
  console.log(`[DB-SERP-DATA] Deleting SERP data document: ${docId}`);
  try {
    await db.collection(COLLECTIONS.SERP_RESULT).doc(docId).delete();
    console.log(`[DB-SERP-DATA] Successfully deleted document: ${docId}`);
    return true;
  } catch (error) {
    console.error(`[DB-SERP-DATA] Error deleting document ${docId}:`, error);
    throw new Error(
      `Failed to delete document ${docId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
