import { Timestamp } from 'firebase-admin/firestore';
import { unstable_cache } from 'next/cache';
import { COLLECTIONS, db } from './db-config';
import {
  FirebaseSerpResultObject,
  FirebaseSerpResultObjectSchema
} from './schema';

// --- Define Cache Tags Here --- //
const SERP_DATA_LIST_TAG = 'serpDataList';
const SERP_COLLECTION = COLLECTIONS.SERP_RESULT;

/**
 * Finds an existing SERP data document based on keyword, region, and language.
 * @returns The document data (including ID) or null if not found.
 */
export const findSerpResultObjects = unstable_cache(
  async ({
    query,
    region,
    language
  }: {
    query: string;
    region: string;
    language: string;
  }): Promise<FirebaseSerpResultObject | null> => {
    if (!db) throw new Error('Firestore is not initialized.');

    console.log(
      `[Firestore CACHED] Querying for SERP data: K=${query}, R=${region}, L=${language}`
    );
    try {
      const collectionRef = db.collection(SERP_COLLECTION);

      const querySnapshot = await collectionRef
        .where('originalKeyword', '==', query)
        .where('region', '==', region)
        .where('language', '==', language)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        console.log(
          `[Firestore CACHED] No analysis found for K: ${query}, R: ${region}, L: ${language}`
        );
        return null;
      }

      const docSnap = querySnapshot.docs[0];
      console.log(
        `[Firestore CACHED] Found analysis ID: ${docSnap.id} for K: ${query}, R: ${region}, L: ${language}`
      );

      const data = {
        ...docSnap.data(),
        id: docSnap.id
      };
      // Basic validation before returning from cache if needed, or rely on schema parsing on use
      return data as FirebaseSerpResultObject;
    } catch (error) {
      console.error(
        `[Firestore CACHED] Error finding SERP data by keyword/region/language (${query}, ${region}, ${language}):`,
        error
      );
      // Re-throw or return null based on desired cache behavior on error
      throw error;
    }
  },
  ['findSerpResultObjects'], // Base key segment
  {
    // Key parts ensure unique cache entry per query/region/lang combination
    // Tags allow revalidation when lists change
    tags: [SERP_DATA_LIST_TAG]
    // Consider revalidate time if needed: revalidate: 3600 // e.g., 1 hour
  }
);

/**
 * Fetches a specific SERP data document by its Firestore ID.
 * @param docId Firestore document ID.
 * @returns The document data (including ID) or null if not found.
 */
export const getSerpResultById = async (
  docId: string
): Promise<FirebaseSerpResultObject | null> => {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!docId) {
    console.warn(
      '[Firestore CACHED] getSerpResultById called with empty docId.'
    );
    return null; // Return null for empty ID
  }

  console.log(`[Firestore CACHED] Fetching SERP data by ID: ${docId}`);
  try {
    const docRef = db.collection(SERP_COLLECTION).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.log(`[Firestore CACHED] No SERP data found for ID: ${docId}`);
      return null;
    }
    const data = {
      ...docSnap.data(),
      id: docSnap.id
    };

    const validatedData = FirebaseSerpResultObjectSchema.safeParse(data);
    if (!validatedData.success) {
      console.error(
        `[Firestore CACHED] Invalid SERP data for ID ${docId}:`,
        validatedData.error
      );
      // Decide how to handle invalid data in cache: return null or throw?
      // Returning null might be safer for consumers.
      return null;
    }
    return validatedData.data;
  } catch (error) {
    console.error(
      `[Firestore CACHED] Error fetching SERP data for ID ${docId}:`,
      error
    );
    // Re-throw or return null based on desired cache behavior on error
    throw error;
  }
};

/**
 * Fetches a list of SERP data entries (ID, keyword, region, lang, timestamp).
 * @returns Array of list items.
 */
export const getSerpResultList = unstable_cache(
  async (
    limit = 50,
    offset = 0
  ): Promise<
    {
      id: string;
      keyword: string;
      region: string | null;
      language: string | null;
      timestamp: Timestamp;
    }[]
  > => {
    if (!db) throw new Error('Firestore is not initialized.');
    console.log(
      `[Firestore CACHED] Fetching SERP data list (limit: ${limit}, offset: ${offset})...`
    );
    try {
      const snapshot = await db
        .collection(SERP_COLLECTION)
        .orderBy('updatedAt', 'desc')
        .select('originalKeyword', 'region', 'language', 'updatedAt')
        .limit(limit)
        .offset(offset)
        .get();

      const list: {
        id: string;
        keyword: string;
        region: string | null;
        language: string | null;
        timestamp: Timestamp;
      }[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data?.originalKeyword && data?.updatedAt instanceof Timestamp) {
          list.push({
            id: doc.id,
            keyword: data.originalKeyword,
            region: data.region ?? null,
            language: data.language ?? null,
            timestamp: data.updatedAt
          });
        } else {
          console.warn(
            `[Firestore List CACHED] Skipping doc ${doc.id} due to missing fields or invalid timestamp`
          );
        }
      });
      console.log(
        `[Firestore CACHED] Fetched ${list.length} SERP data list entries.`
      );
      return list;
    } catch (error) {
      console.error('[Firestore CACHED] Error fetching SERP data list:', error);
      throw error;
    }
  },
  ['getSerpResultList'], // Base key segment
  {
    // Key parts depend on limit and offset
    tags: [SERP_DATA_LIST_TAG]
    // revalidate: 3600 // Example revalidation time
  }
);

/**
 * Gets the total count of SERP data documents in the database.
 * @returns Promise<number> The total count.
 */
export const getTotalSerpDataCount = unstable_cache(
  async (): Promise<number> => {
    if (!db) throw new Error('Firestore is not initialized.');
    console.log(
      '[Firestore CACHED] Getting total count of SERP data documents...'
    );
    try {
      const snapshot = await db.collection(SERP_COLLECTION).count().get();
      const count = snapshot.data().count;
      console.log(`[Firestore CACHED] Total SERP documents count: ${count}`);
      return count;
    } catch (error) {
      console.error(
        '[Firestore CACHED] Error getting total SERP count:',
        error
      );
      // Return 0 or throw based on desired behavior on error
      return 0;
    }
  },
  ['getTotalSerpDataCount'], // Base key segment
  {
    tags: [SERP_DATA_LIST_TAG]
    // revalidate: 3600 // Example revalidation time
  }
);