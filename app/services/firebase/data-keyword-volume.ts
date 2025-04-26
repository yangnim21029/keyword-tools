import { unstable_cache } from 'next/cache';
import 'server-only';

import { COLLECTIONS, db } from './db-config';
import {
  KeywordVolumeListItem,
  KeywordVolumeListItemSchema,
  KeywordVolumeObject,
  KeywordVolumeObjectSchema
} from './schema';

// Create a schema for the LIST data as it exists in Firestore (without the ID)
const FirestoreListItemDataSchema = KeywordVolumeListItemSchema.omit({
  id: true
});

const getKeywordVolumeList = unstable_cache(
  async ({
    limit = 50,
    offset = 0
  }: {
    limit?: number;
    offset?: number;
  }): Promise<KeywordVolumeListItem[] | null> => {
    if (!db) return null;
    console.log(
      `[DB Cache Miss] Fetching keyword volume LIST (limit: ${limit}, offset: ${offset})`
    );
    const docSnap = await db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      // Select only the necessary fields for the list view
      .select('query', 'createdAt', 'totalVolume', 'region', 'language')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .get();

    // Parse and validate each document, filtering out invalid ones
    const validatedData = docSnap.docs.map(doc => {
      const rawData = doc.data();
      // 1. Validate the raw data *without* the id field, using the list item schema
      const validationResult = FirestoreListItemDataSchema.safeParse(rawData);

      if (!validationResult.success) {
        console.warn(
          `[getKeywordVolumeList] Firestore LIST data validation failed for doc ID ${doc.id}:`,
          validationResult.error.flatten()
        );
        return null; // Indicate failure
      }

      // 2. Construct the final list item object *with* the id
      const finalData: KeywordVolumeListItem = {
        ...validationResult.data,
        id: doc.id
      };

      return finalData;
    });

    // Filter out nulls (failed validations) before returning
    const result = validatedData.filter(
      (item): item is KeywordVolumeListItem => item !== null
    );
    console.log(
      `[DB Cache] Returning ${result.length} items for keyword volume list.`
    );
    return result;
  },
  ['getKeywordVolumeList'],
  { tags: ['getKeywordVolumeList'] }
);

const getKeywordVolumeObj = async ({
  researchId
}: {
  researchId: string;
}): Promise<KeywordVolumeObject | null> => {
  if (!db) return null;
  console.log(`[DB Cache Miss] Fetching detail object for ${researchId}`);
  try {
    const docSnap = await db
      .collection(COLLECTIONS.KEYWORD_VOLUME)
      .doc(researchId)
      .get();

    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的 Keyword Research: ${researchId}`);
      return null;
    }
    const rawData = docSnap.data();
    if (!rawData) return null;

    // Combine rawData with the document ID before validation
    const dataWithId = { ...rawData, id: docSnap.id };

    // Validate data with the consolidated Zod schema
    const validationResult = KeywordVolumeObjectSchema.safeParse(dataWithId);

    if (!validationResult.success) {
      console.error(
        `Firestore data validation failed for ${researchId}:`,
        validationResult.error.errors
      );
      return null;
    }

    console.log(
      `Keyword Research object ${researchId} 載入完成 for cache (Processed for client)`
    );
    // No need to cast if validation passed, Zod handles the type
    return validationResult.data;
  } catch (error) {
    console.error(`獲取 Keyword Research object 失敗: ${researchId}`, error);
    throw error;
  }
};

export { getKeywordVolumeList, getKeywordVolumeObj };
