import { NextResponse } from 'next/server';
import { generateReaseachPrompt } from '../../../../actions/writing-actions';

export async function POST(req: Request) {
    try {
        // Expects the full JSON output from Step 2
        const intermediateData = await req.json(); 
        const { keyword, mediaSiteName } = intermediateData; // Extract needed identifiers

        // Check for essential data from step 2
        if (!keyword || !mediaSiteName || !intermediateData.actionPlanText) { 
            return NextResponse.json({ error: 'Missing required data from Step 2' }, { status: 400 });
        }

        // Call the action with step 3, passing intermediate data
        const finalPrompt = await generateReaseachPrompt(keyword, mediaSiteName, 3, intermediateData);

        // Check if the result is a string (as expected from step 3)
        if (typeof finalPrompt !== 'string') {
             console.error("[API Step 3 Finalize] Error: Expected string result from action, got:", typeof finalPrompt);
             throw new Error("Final step did not produce a string output.");
        }

        // Return the final prompt string as plain text
        return new Response(finalPrompt, { 
            status: 200, 
            headers: { 'Content-Type': 'text/plain' } 
        });

    } catch (error: any) {
        console.error("[API Step 3 Finalize] Error:", error);
        return NextResponse.json(
            { error: "Failed during step 3 finalization", details: error.message }, 
            { status: 500 }
        );
    }
} 