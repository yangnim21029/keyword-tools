import { NextResponse } from 'next/server';
import { generateReaseachPrompt } from '../../../../actions/writing-actions';

export async function POST(req: Request) {
    try {
        // Expects the full JSON output from Step 1
        const intermediateData = await req.json(); 
        const { keyword, mediaSiteName } = intermediateData; // Extract needed identifiers

        if (!keyword || !mediaSiteName || !intermediateData.serpString) { // Check for essential data from step 1
            return NextResponse.json({ error: 'Missing required data from Step 1' }, { status: 400 });
        }

        // Call the action with step 2, passing intermediate data
        const step2Result = await generateReaseachPrompt(keyword, mediaSiteName, 2, intermediateData);

        // Return the intermediate JSON data from step 2
        return NextResponse.json(step2Result, { status: 200 });

    } catch (error: any) {
        console.error("[API Step 2 Plan] Error:", error);
        return NextResponse.json(
            { error: "Failed during step 2 planning", details: error.message }, 
            { status: 500 }
        );
    }
} 