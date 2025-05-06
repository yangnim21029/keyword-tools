import { getWritingQueueItems } from "@/app/services/firebase/data-ai-writing-queue";
import { WritingQueueTable } from "./writing-queue-table"; // Import the new client component

// Removed client-side imports like useState, useEffect, toast, UI components, etc.

// Removed API/Step constants (logic moved to client component)

// Removed KeywordTaskState interface (defined in client component)

export default async function WritingQueuePage() {
  // Make component async
  // Fetch data on the server
  let tasks = null;
  let error = null;
  try {
    tasks = await getWritingQueueItems({ limit: 200 }); // Fetch initial data
  } catch (err) {
    console.error(
      "[Server Page Error] Failed to fetch writing queue items:",
      err
    );
    error = err instanceof Error ? err.message : "Failed to load tasks.";
  }

  // Removed all client-side state, effects, and handlers

  // --- Render --- Pass data to the client component
  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
          AI Writing Queue - UrbanLife
        </h1>
        <div className="space-y-8">
          {/* Render the client component with initial data */}
          <WritingQueueTable initialTasks={tasks} initialError={error} />
        </div>
      </div>
    </div>
  );
}
