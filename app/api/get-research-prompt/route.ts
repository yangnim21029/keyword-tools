import { generateReaseachPrompt } from "../../actions/writing-actions";
import { NextResponse } from 'next/server'; // Import NextResponse for standard responses

// get method return the curl command for guide user to use the api
export async function GET(req: Request) {
    // Determine base URL based on environment
    let baseUrl: string;
    if (process.env.NODE_ENV === 'development') {
        baseUrl = process.env.DEV_API_URL || 'http://localhost:3000/api/';
        console.log(`[API Route GET] Using DEV_API_URL: ${baseUrl}`);
    } else {
        baseUrl = process.env.NEXT_PUBLIC_API_URL || '[YOUR_PRODUCTION_API_URL_HERE]/'; // Use production URL, provide a fallback placeholder
        console.log(`[API Route GET] Using NEXT_PUBLIC_API_URL: ${baseUrl}`);
    }
    
    // Ensure the base URL ends with a slash
    if (!baseUrl.endsWith('/')) {
        baseUrl += '/';
    }

    const apiUrl = `${baseUrl}get-research-prompt`; // Append the specific route
    const curlCommand = `curl -X POST -H "Content-Type: application/json" -d '{\"keyword\": \"your_keyword\", \"mediaSite\": \"media_site_url\"}' ${apiUrl}`;
    
    // Return as plain text
    return new Response(curlCommand, { headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Extract keyword, mediaSite, and optional region/language
        const { keyword, mediaSite, region, language } = body;

        // Basic validation for required fields
        if (!keyword || !mediaSite) {
            return NextResponse.json({ error: 'Missing keyword or mediaSite in request body' }, { status: 400 });
        }
        
        // Optional: Add validation for region/language if needed (e.g., check if they are strings if provided)

        console.log(`[API Route] Received POST for keyword: ${keyword}, mediaSite: ${mediaSite}, region: ${region || 'N/A'}, language: ${language || 'N/A'}`);
        // Pass all parameters to generateReaseachPrompt
        const researchPrompt = await generateReaseachPrompt(keyword, mediaSite, region, language);
        console.log(`[API Route] Successfully generated research prompt for: ${keyword}`);

        // Return the generated prompt as plain text
        return new Response(researchPrompt, { 
            status: 200, 
            headers: { 'Content-Type': 'text/plain' } 
        });

    } catch (error) {
        console.error("[API Route] Error processing POST request:", error);
        
        // Determine if it's a known error type or generic
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        
        // Return a structured JSON error response
        return NextResponse.json({ error: "Failed to generate research prompt", details: errorMessage }, { status: 500 });
    }
}