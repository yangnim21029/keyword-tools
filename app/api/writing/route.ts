import { generateReaseachPrompt } from "../../actions/writing-actions";
import { MEDIASITE_DATA } from "../../config/constants";
import { NextResponse } from 'next/server'; // Import NextResponse for standard responses

// GET method returns the curl command for guiding the user on API usage
export async function GET(req: Request) {
    // Use the request URL to determine the base URL (origin)
    const url = new URL(req.url);
    let baseUrl = url.origin; // e.g., http://localhost:3000 or https://yourdomain.com
    console.log(`[API Route GET] Using derived base URL: ${baseUrl}`);

    // Construct the API path directly
    const apiUrl = `${baseUrl}/api/writing`; // Corrected API path if this is the intended endpoint
    const curlCommand = `curl -X POST -H "Content-Type: application/json" -d '{"keyword": "credit card", "mediaSiteName": "BF"}' ${apiUrl}`; // Example using a valid name and English keyword
    
    // Return as plain text
    return new Response(curlCommand, { headers: { 'Content-Type': 'text/plain' } });
}

// POST method handles the generation of the research prompt
export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Extract only keyword and mediaSiteName
        const { keyword, mediaSiteName } = body;

        // Basic validation for required fields
        if (!keyword || !mediaSiteName) {
            console.error('[API Route POST] Missing keyword or mediaSiteName in request body:', body);
            return NextResponse.json({ error: 'Missing keyword or mediaSiteName in request body' }, { status: 400 });
        }

        // Validate mediaSiteName is a non-empty string
        if (typeof mediaSiteName !== 'string' || mediaSiteName.trim() === '') {
            console.error('[API Route POST] Invalid mediaSiteName provided:', mediaSiteName);
            return NextResponse.json({ error: 'Invalid mediaSiteName provided' }, { status: 400 });
        }

        // No normalization needed for name
        const siteName = mediaSiteName.trim(); // Trim whitespace just in case

        // === Validation: Check if mediaSiteName exists in MEDIASITE_DATA ===
        const isValidMediaSite = MEDIASITE_DATA.some(site => site.name === siteName);
        if (!isValidMediaSite) {
            console.error(`[API Route POST] Invalid mediaSiteName: ${siteName}. Not found in predefined list.`);
            return NextResponse.json({ error: `Invalid mediaSiteName provided. '${siteName}' is not a recognized site name.` }, { status: 400 });
        }
        // === End Validation ===

        console.log(`[API Route POST] Received POST for keyword: '${keyword}', mediaSiteName: '${siteName}'`);
        
        // Pass keyword and siteName to generateReaseachPrompt
        const researchPrompt = await generateReaseachPrompt(keyword, siteName);
        console.log(`[API Route POST] Successfully generated research prompt for keyword: '${keyword}'`);

        // Return the generated prompt as plain text
        return new Response(researchPrompt, { 
            status: 200, 
            headers: { 'Content-Type': 'text/plain' } 
        });

    } catch (error) {
        console.error("[API Route POST] Error processing POST request:", error);
        
        // Determine if it's a known error type or generic
        let errorMessage = "An unknown error occurred";
        let errorDetails: any = error; // Keep original error for details

        if (error instanceof Error) {
            errorMessage = error.message;
            // If the error has a specific structure (like from the action), use it
            if ('details' in error) {
                 errorMessage = (error as any).details || error.message;
            } else if (error.cause) {
                 // Include cause if available
                 errorMessage += ` (Cause: ${error.cause})`;
            }
        }
        
        console.error("[API Route POST] Detailed Error:", errorDetails);

        // Return a structured JSON error response
        return NextResponse.json({ error: "Failed to generate research prompt", details: errorMessage }, { status: 500 });
    }
} 