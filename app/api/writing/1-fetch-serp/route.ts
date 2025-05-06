import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
// Import the specific step function from actions
import { submitCreateSerp } from "@/app/actions/actions-ai-serp-result";
import { MEDIASITE_DATA } from "@/app/global-config";
// Input schema should match the expected input for fetchSerpStep
const inputSchema = z.object({
  keyword: z.string().min(1, "Keyword is required"),
  mediaSiteName: z.string().min(1, "Media site name is required"),
});

export async function POST(request: NextRequest) {
  console.log("[API /writing/1-fetch-serp] Received request");
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error(
        "[API /writing/1-fetch-serp] Invalid input:",
        validation.error.errors,
      );
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.format() },
        { status: 400 },
      );
    }

    const inputData = validation.data;

    // Call the imported action function
    // 取得 MEDIATSITE 的語言和地區
    const selectedSite = MEDIASITE_DATA.find(
      (site) => site.name === inputData.mediaSiteName,
    );
    // --- Validate Media Site --- START ---
    const language = selectedSite?.language;
    const region = selectedSite?.region;
    if (!language || !region) {
      console.error(
        "[API /writing/1-fetch-serp] Language or region not found for site:",
        inputData.mediaSiteName,
      );
      return NextResponse.json(
        {
          error: "Invalid input",
          details: `Configuration error: Language or region not found for media site '${inputData.mediaSiteName}'.`,
        },
        { status: 400 },
      );
    }
    // --- Validate Media Site --- END ---

    // --- Directly call the updated submitCreateSerp action --- START ---
    console.log(
      `[API /writing/1-fetch-serp] Calling submitCreateSerp for Keyword: "${inputData.keyword}", Site: "${inputData.mediaSiteName}" (Lang: ${language}, Region: ${region})`,
    );
    const createOrFindResult = await submitCreateSerp({
      query: inputData.keyword,
      region,
      language,
    });

    if (
      createOrFindResult.success &&
      createOrFindResult.id &&
      createOrFindResult.originalKeyword
    ) {
      console.log(
        `[API /writing/1-fetch-serp] Successfully found/created SERP. Doc ID: ${createOrFindResult.id}, Keyword: ${createOrFindResult.originalKeyword}`,
      );
      return NextResponse.json(
        {
          id: createOrFindResult.id,
          originalKeyword: createOrFindResult.originalKeyword,
        },
        { status: 200 },
      );
    } else {
      console.error(
        "[API /writing/1-fetch-serp] Failed to find or create SERP via action",
        createOrFindResult,
      );
      // Return a 500 error with details from the action
      return NextResponse.json(
        {
          error: "Failed to find or create SERP",
          details:
            createOrFindResult.error ||
            "Action failed without specific error message.",
        },
        { status: 500 },
      );
    }
    // --- Directly call the updated submitCreateSerp action --- END ---
  } catch (error) {
    console.error(
      "[API /writing/1-fetch-serp] Error calling action step:",
      error,
    );
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed during fetch SERP step", details: errorMessage },
      { status: 500 },
    );
  }
}
