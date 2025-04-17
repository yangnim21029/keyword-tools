import { generateReaseachPrompt } from "../../actions/writing-actions";
import { MEDIASITE_DATA } from "../../config/constants";
import { NextResponse } from 'next/server'; // Import NextResponse for standard responses

// GET method returns the curl command for guiding the user on API usage
export async function GET(req: Request) {
    // Use the request URL to determine the base URL (origin)
    const url = new URL(req.url);
    const baseUrl = url.origin; // e.g., http://localhost:3000 or https://yourdomain.com
    console.log(`[API Route GET] Using derived base URL: ${baseUrl}`);

    // Construct the API path directly
    const apiUrl = `${baseUrl}/api/writing`; // Corrected API path if this is the intended endpoint
    const curlCommand = `curl -X POST -H "Content-Type: application/json" -d '{"keyword": "credit card", "mediaSiteName": "BF"}' ${apiUrl}`; // Example using a valid name and English keyword
    
    // Return as plain text
    return new Response(curlCommand, { headers: { 'Content-Type': 'text/plain' } });
}

// POST method - Performs all 3 steps sequentially
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { keyword, mediaSiteName } = body;

        // --- Input Validation (as before) ---
        if (!keyword || !mediaSiteName) {
            return NextResponse.json({ error: 'Missing keyword or mediaSiteName in request body' }, { status: 400 });
        }
        if (typeof mediaSiteName !== 'string' || mediaSiteName.trim() === '') {
            return NextResponse.json({ error: 'Invalid mediaSiteName provided' }, { status: 400 });
        }
        const siteName = mediaSiteName.trim();
        const isValidMediaSite = MEDIASITE_DATA.some(site => site.name === siteName);
        if (!isValidMediaSite) {
            return NextResponse.json({ error: `Invalid mediaSiteName provided. '${siteName}' is not a recognized site name.` }, { status: 400 });
        }
        console.log(`[API Route POST] Received request for keyword: '${keyword}', mediaSiteName: '${siteName}'`);

        // --- Step 1: Analyze ---
        console.log("[API Route POST] Executing Step 1...");
        const step1Result = await generateReaseachPrompt(keyword, siteName, 1);
        if (typeof step1Result !== 'object' || step1Result === null) {
            throw new Error("Step 1 did not produce expected intermediate data object.");
        }
        console.log("[API Route POST] Step 1 completed.");

        // --- Step 2: Plan ---
        console.log("[API Route POST] Executing Step 2...");
        const step2Result = await generateReaseachPrompt(keyword, siteName, 2, step1Result);
        if (typeof step2Result !== 'object' || step2Result === null) {
            throw new Error("Step 2 did not produce expected intermediate data object.");
        }
        console.log("[API Route POST] Step 2 completed.");

        // --- Step 3: Finalize ---
        console.log("[API Route POST] Executing Step 3...");
        const finalPrompt = await generateReaseachPrompt(keyword, siteName, 3, step2Result);
        if (typeof finalPrompt !== 'string') {
            throw new Error("Step 3 did not produce expected final string prompt.");
        }
        console.log("[API Route POST] Step 3 completed. Successfully generated final prompt.");

        // Return the final prompt as plain text
        return new Response(finalPrompt, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });

    } catch (error) {
        console.error("[API Route POST - Sequential] Error processing request:", error);
        let errorMessage = "An unknown error occurred";
        const errorDetails: any = error;
        if (error instanceof Error) {
            errorMessage = error.message;
            if ('details' in error) { errorMessage = (error as any).details || error.message; }
            else if (error.cause) { errorMessage += ` (Cause: ${error.cause})`; }
        }
        console.error("[API Route POST - Sequential] Detailed Error:", errorDetails);
        // Return a structured JSON error response
        return NextResponse.json({ error: "Failed to generate research prompt sequentially", details: errorMessage }, { status: 500 });
    }
} 