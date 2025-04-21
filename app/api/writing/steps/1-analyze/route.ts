import { NextResponse } from 'next/server';
import { generateReaseachPrompt } from '../../../../actions/writing-actions';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { keyword, mediaSiteName, fineTuneNames } = body;

        if (!keyword || !mediaSiteName) {
            return NextResponse.json({ error: 'Missing keyword or mediaSiteName' }, { status: 400 });
        }

        // Call the action with step 1, passing fineTuneNames
        const step1Result = await generateReaseachPrompt(keyword, mediaSiteName, 1, null, fineTuneNames);

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