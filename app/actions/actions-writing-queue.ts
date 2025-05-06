"use server";

import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";

import { db, COLLECTIONS } from "@/app/services/firebase/db-config";
// Removed unused WritingQueueItemSchema import
// import { WritingQueueItemSchema } from "@/app/services/firebase/data-ai-writing-queue";

const WRITING_QUEUE_LIST_TAG = "writingQueueList"; // Ensure this matches the tag in data-ai-writing-queue.ts

// Schema now expects a potentially multi-line string
const CreateTasksInputSchema = z.object({
  keywords: z.string().min(1, "Keywords cannot be empty."), // Renamed field
});

// Define return type for batch operation summary
interface BatchActionResult {
  successCount: number;
  errorCount: number;
  errors: { keyword: string; error: string }[];
}

export async function createWritingQueueTaskAction(
  formData: FormData
): Promise<BatchActionResult> {
  const initialResult: BatchActionResult = {
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!db) {
    console.error(
      "[DB Error] Firestore not initialized in createWritingQueueTaskAction."
    );
    // Return a general error summary if DB fails
    return {
      ...initialResult,
      errorCount: 1,
      errors: [{ keyword: "N/A", error: "Database connection failed." }],
    };
  }

  const rawKeywords = formData.get("keywords"); // Get the multi-line string

  const validationResult = CreateTasksInputSchema.safeParse({
    keywords: rawKeywords,
  });

  if (!validationResult.success) {
    console.warn(
      "[Validation Error] Invalid keywords input provided:",
      validationResult.error.flatten()
    );
    return {
      ...initialResult,
      errorCount: 1,
      errors: [
        {
          keyword: "N/A",
          error:
            validationResult.error.flatten().fieldErrors.keywords?.[0] ??
            "Invalid input.",
        },
      ],
    };
  }

  const { keywords: keywordsInput } = validationResult.data;

  // Split by newline, trim whitespace, and filter out empty lines
  const keywordsToAdd = keywordsInput
    .split(/\r?\n/)
    .map((kw) => kw.trim())
    .filter((kw) => kw.length > 0);

  if (keywordsToAdd.length === 0) {
    return {
      ...initialResult,
      errors: [
        { keyword: "N/A", error: "No valid keywords provided after cleaning." },
      ],
    };
  }

  console.log(
    `[Action] Attempting to add ${keywordsToAdd.length} keywords to queue:`,
    keywordsToAdd
  );

  const results: BatchActionResult = { ...initialResult };
  const collectionRef = db.collection(COLLECTIONS.AI_WRITING_QUEUE);

  // Process each keyword individually
  for (const keyword of keywordsToAdd) {
    try {
      const newTaskData = {
        keyword: keyword,
        status: "pending" as const,
        mediaSiteName: "urbanlife",
        resultPrompt: null,
        errorMessage: null,
        createdAt: Timestamp.now(),
      };

      // Check if keyword already exists (optional, prevents duplicates)
      // const existingDocs = await collectionRef.where('keyword', '==', keyword).limit(1).get();
      // if (!existingDocs.empty) {
      //   console.warn(`[Action] Keyword "${keyword}" already exists in the queue. Skipping.`);
      //   results.errorCount++;
      //   results.errors.push({ keyword, error: "Keyword already exists." });
      //   continue; // Skip to next keyword
      // }

      const docRef = await collectionRef.add(newTaskData);
      console.log(
        `[Action Success] Keyword "${keyword}" added with ID: ${docRef.id}`
      );
      results.successCount++;
    } catch (error) {
      console.error(
        `[Action Error] Failed to add keyword "${keyword}":`,
        error
      );
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";
      results.errorCount++;
      results.errors.push({ keyword, error: message });
    }
  }

  // Revalidate the cache tag once after all additions
  if (results.successCount > 0) {
    revalidateTag(WRITING_QUEUE_LIST_TAG);
    console.log(`[Action] Revalidated cache tag: ${WRITING_QUEUE_LIST_TAG}`);
  }

  console.log(
    `[Action Result] Added: ${results.successCount}, Failed: ${results.errorCount}`
  );
  return results;
}

// --- NEW SERVER ACTIONS ---

// Helper function for single field updates
async function updateTaskField(
  taskId: string,
  fieldName: string, // Field name to update
  value: string | null, // Value to set (or null to clear)
  validationSchema?: z.ZodTypeAny // Optional schema for value validation
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    console.error(
      `[DB Error] Firestore not initialized in updateTaskField (${fieldName}).`
    );
    return { success: false, error: "Database connection failed." };
  }

  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  // Validate the value if a schema is provided
  if (validationSchema) {
    const validationResult = validationSchema.safeParse(value);
    if (!validationResult.success) {
      console.warn(
        `[Validation Error] Invalid ${fieldName}:`,
        validationResult.error.flatten()
      );
      // Use the first error message
      const errorMessage =
        validationResult.error.errors[0]?.message ?? `Invalid ${fieldName}.`;
      return { success: false, error: errorMessage };
    }
    // Use the parsed value (e.g., for trimming or type coercion if schema does that)
    value = validationResult.data;
  }

  console.log(
    `[Action] Attempting to update ${fieldName} for task ID: ${taskId}`
  );

  try {
    const taskRef = db.collection(COLLECTIONS.AI_WRITING_QUEUE).doc(taskId);

    await taskRef.update({
      [fieldName]: value, // Use computed property name
      updatedAt: Timestamp.now(),
    });

    console.log(`[Action Success] Updated ${fieldName} for task ${taskId}`);
    revalidateTag(WRITING_QUEUE_LIST_TAG);
    return { success: true };
  } catch (error) {
    console.error(
      `[Action Error] Failed to update ${fieldName} for task ${taskId}:`,
      error
    );
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return {
      success: false,
      error: `Failed to update ${fieldName}: ${message}`,
    };
  }
}

// Action to update Generated Article Text
const ArticleSchema = z.string().nullable(); // Can be empty or null
export async function updateGeneratedArticleAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const taskId = formData.get("taskId") as string;
  const articleText = formData.get("articleText") as string | null;
  return updateTaskField(taskId, "generatedArticleText", articleText);
}

// Action to update Refine URL
const UrlSchema = z
  .string()
  .url("Invalid URL format.")
  .or(z.literal(""))
  .nullable(); // Allow empty string or null
export async function updateRefineUrlAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const taskId = formData.get("taskId") as string;
  const url = formData.get("url") as string | null;
  // Parse empty string as null before validation/saving
  const valueToSave = url?.trim() === "" ? null : url;
  return updateTaskField(taskId, "refineUrl", valueToSave, UrlSchema);
}

// Action to update Post URL
export async function updatePostUrlAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const taskId = formData.get("taskId") as string;
  const url = formData.get("url") as string | null;
  // Parse empty string as null before validation/saving
  const valueToSave = url?.trim() === "" ? null : url;
  return updateTaskField(taskId, "postUrl", valueToSave, UrlSchema);
}

// --- NEW ACTION: Update Result Prompt ---
const PromptSchema = z.string().min(1, "Prompt cannot be empty.").nullable(); // Prompt should likely not be empty if generated
export async function updateResultPromptAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  // Add DB check
  if (!db) {
    console.error(
      `[DB Error] Firestore not initialized in updateResultPromptAction.`
    );
    return { success: false, error: "Database connection failed." };
  }
  const taskId = formData.get("taskId") as string;
  const prompt = formData.get("prompt") as string | null;
  // Note: We update status to completed here as well, assuming prompt generation IS the completion criteria for now.
  // If other steps need to happen, this logic might need adjustment.
  const result = await updateTaskField(
    taskId,
    "resultPrompt",
    prompt,
    PromptSchema
  );
  if (result.success) {
    // Also update status to completed upon successful prompt save
    try {
      const taskRef = db.collection(COLLECTIONS.AI_WRITING_QUEUE).doc(taskId);
      await taskRef.update({
        status: "completed" as const,
        updatedAt: Timestamp.now(),
      });
      console.log(
        `[Action Success] Also updated status to completed for task ${taskId}`
      );
      revalidateTag(WRITING_QUEUE_LIST_TAG); // Revalidate again after status update
      return { success: true };
    } catch (statusError) {
      console.error(
        `[Action Error] Failed to update status to completed for task ${taskId} after saving prompt:`,
        statusError
      );
      // Return success=true because prompt *was* saved, but log the status error
      return {
        success: true,
        error: "Prompt saved, but failed to update status.",
      };
    }
  } else {
    return result; // Return the original error from updateTaskField
  }
}

// --- NEW ACTION: Refine Article using Graph Action ---
import { generateRevisionFromInputTextAndUrlGraph } from "./actions-ai-graph"; // Import the graph action
import type { WritingQueueItem } from "@/app/services/firebase/data-ai-writing-queue"; // Import type for fetching

export async function refineArticleAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    console.error(
      `[DB Error] Firestore not initialized in refineArticleAction.`
    );
    return { success: false, error: "Database connection failed." };
  }
  const taskId = formData.get("taskId") as string;
  if (!taskId) {
    return { success: false, error: "Task ID is required." };
  }

  console.log(`[Action] Starting Refine Article for Task ID: ${taskId}`);

  try {
    // 1. Fetch the task data
    const taskRef = db.collection(COLLECTIONS.AI_WRITING_QUEUE).doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      return { success: false, error: "Task not found." };
    }
    // Cast or validate taskData - validation is safer
    const taskData = taskSnap.data();
    if (!taskData) {
      return { success: false, error: "Task data is empty." };
    }

    // 2. Validate required fields
    const inputText = taskData.generatedArticleText; // Use the initial/edited article as input
    const targetUrl = taskData.refineUrl;

    if (!inputText || inputText.trim().length === 0) {
      return {
        success: false,
        error: "Initial article text (generatedArticleText) is missing.",
      };
    }
    if (!targetUrl || targetUrl.trim().length === 0) {
      return { success: false, error: "Refine URL is missing." };
    }

    // 3. Call the graph refinement action
    console.log(`[Action] Calling generateRevisionFromInputTextAndUrlGraph...`);
    const refinementResult = await generateRevisionFromInputTextAndUrlGraph({
      inputText,
      targetUrl,
    });

    if (!refinementResult.success || !refinementResult.refinedArticle) {
      throw new Error(refinementResult.error || "Article refinement failed.");
    }

    // 4. Save the refined article to the *new* field
    console.log(
      `[Action] Saving refined article to 'refinedArticleText' for task ${taskId}...`
    );
    // Use the helper function to save to the specific field, using the correct property name
    const saveResult = await updateTaskField(
      taskId,
      "refinedArticleText",
      refinementResult.refinedArticle
    );

    if (!saveResult.success) {
      // Log error but consider the overall action potentially successful if refinement worked
      console.error(
        `[Action] Refinement successful, but failed to save refined article: ${saveResult.error}`
      );
      // Perhaps return a specific error indicating save failure but generation success?
      // For now, let's return success=false as the final state isn't saved.
      return {
        success: false,
        error: `Refined article generated but failed to save: ${saveResult.error}`,
      };
    }

    console.log(
      `[Action Success] Article refined and saved to refinedArticleText for task ${taskId}`
    );
    return { success: true };
  } catch (error) {
    console.error(
      `[Action Error] Failed to refine article for task ${taskId}:`,
      error
    );
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { success: false, error: `Failed to refine article: ${message}` };
  }
}
