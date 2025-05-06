import { unstable_cache } from "next/cache";
import "server-only";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore"; // Import Timestamp

import { COLLECTIONS, db } from "./db-config";

// Define status enum if needed, or use string
const WritingTaskStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "error",
]);

// Schema for a single item in the writing queue
export const WritingQueueItemSchema = z.object({
  id: z.string(),
  keyword: z.string().min(1, "Keyword cannot be empty"),
  status: WritingTaskStatusSchema.default("pending"),
  mediaSiteName: z.string().default("urbanlife"), // Defaulting as per previous logic
  resultPrompt: z.string().nullable().optional(), // To store the final generated prompt
  errorMessage: z.string().nullable().optional(), // To store error messages
  createdAt: z
    .instanceof(Timestamp)
    .or(z.date()) // Allow both Firestore Timestamp and JS Date
    .transform((val) => (val instanceof Timestamp ? val.toDate() : val)), // Convert Timestamp to Date for client
  updatedAt: z
    .instanceof(Timestamp)
    .or(z.date())
    .transform((val) => (val instanceof Timestamp ? val.toDate() : val))
    .optional(), // Optional, might not be set initially
});

// Type definition inferred from the schema
export type WritingQueueItem = z.infer<typeof WritingQueueItemSchema>;

// Schema for data as stored in Firestore (without id, using Timestamps)
const FirestoreWritingQueueItemDataSchema = WritingQueueItemSchema.omit({
  id: true,
}).extend({
  createdAt: z.instanceof(Timestamp), // Expect Timestamp from Firestore
  updatedAt: z.instanceof(Timestamp).optional(),
});

const WRITING_QUEUE_LIST_TAG = "writingQueueList";

// Cached function to get the list of writing queue items
const getWritingQueueItems = unstable_cache(
  async ({
    limit = 100, // Fetch more items for a dashboard view
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  } = {}): Promise<WritingQueueItem[] | null> => {
    if (!db) {
      console.error(
        "[DB Error] Firestore not initialized in getWritingQueueItems."
      );
      return null;
    }
    console.log(
      `[DB Cache Miss] Fetching writing queue items (limit: ${limit}, offset: ${offset})`
    );
    try {
      const querySnapshot = await db
        .collection(COLLECTIONS.AI_WRITING_QUEUE) // Use the correct collection name
        .orderBy("createdAt", "desc") // Show newest first
        .limit(limit)
        .offset(offset)
        .get();

      if (querySnapshot.empty) {
        console.log("[DB Info] No writing queue items found.");
        return []; // Return empty array if no items
      }

      // Parse and validate each document
      const validatedItems = querySnapshot.docs
        .map((doc): WritingQueueItem | null => {
          const rawData = doc.data();
          // 1. Validate the raw data *without* the id, expecting Timestamps
          const validationResult =
            FirestoreWritingQueueItemDataSchema.safeParse(rawData);

          if (!validationResult.success) {
            console.warn(
              `[getWritingQueueItems] Firestore data validation failed for doc ID ${doc.id}:`,
              validationResult.error.flatten()
            );
            return null; // Indicate failure
          }

          // 2. Construct the final validated object *with* the id and converted dates
          const finalItem: WritingQueueItem = {
            ...WritingQueueItemSchema.parse({
              // Parse again with the final schema to ensure correct types (like converted dates)
              ...validationResult.data, // Validated data (with Timestamps)
              id: doc.id, // Add the document ID
            }),
          };
          return finalItem;
        })
        .filter((item): item is WritingQueueItem => item !== null); // Filter out nulls

      console.log(
        `[DB Cache] Returning ${validatedItems.length} writing queue items.`
      );
      return validatedItems;
    } catch (error) {
      console.error("[DB Error] Failed to fetch writing queue items:", error);
      // Depending on requirements, you might want to throw the error
      // or return null/empty array to handle it gracefully upstream.
      return null; // Return null on error for now
    }
  },
  [WRITING_QUEUE_LIST_TAG], // Cache key
  { tags: [WRITING_QUEUE_LIST_TAG] } // Cache tag for revalidation
);

export { getWritingQueueItems };
