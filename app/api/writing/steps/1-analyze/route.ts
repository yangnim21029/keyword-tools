import { NextResponse } from 'next/server';
import { generateReaseachPrompt } from '../../../../actions/writing-actions';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Destructure all expected fields from the body
        const { keyword, mediaSiteName, fineTuneNames, keywordReport, selectedClusterName } = body;

        if (!keyword || !mediaSiteName) {
            return NextResponse.json({ error: 'Missing keyword or mediaSiteName' }, { status: 400 });
        }

        console.log(`[API Step 1] Received: keyword=${keyword}, mediaSite=${mediaSiteName}, cluster=${selectedClusterName ?? 'none'}`);

        // Call the action with step 1, passing all relevant data
        const step1Result = await generateReaseachPrompt(
            keyword,
            mediaSiteName,
            1,
            null, // No prior intermediate data for step 1
            fineTuneNames,
            keywordReport, // Pass the report object
            selectedClusterName // Pass the selected cluster name (can be null)
        );

        // Return the intermediate JSON data from step 1
        return NextResponse.json(step1Result, { status: 200 });

    } catch (error: any) {
        console.error("[API Step 1 Analyze] Error:", error);
        return NextResponse.json(
            { error: "Failed during step 1 analysis", details: error.message }, 
            { status: 500 }
        );
    }
} 