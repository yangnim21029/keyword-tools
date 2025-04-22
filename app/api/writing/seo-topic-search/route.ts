import { NextResponse } from 'next/server';
import { generateH2HeadingsList } from '../../../actions/writing-actions';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Extract keyword, language, region, and optional targetWebsites
        const { keyword, language, region, targetWebsites } = body;

        // --- Input Validation ---
        if (!keyword) {
            return NextResponse.json({ error: 'Missing keyword' }, { status: 400 });
        }
        if (!language) {
            return NextResponse.json({ error: 'Missing language' }, { status: 400 });
        }
        if (!region) {
            return NextResponse.json({ error: 'Missing region' }, { status: 400 });
        }
        if (targetWebsites !== undefined && 
            (!Array.isArray(targetWebsites) || !targetWebsites.every(item => typeof item === 'string'))) {
            return NextResponse.json({ error: 'Invalid targetWebsites format. It should be an array of strings.' }, { status: 400 });
        }

        console.log(`[API SEO Topic Search] Received: keyword=${keyword.substring(0, 50)}..., lang=${language}, region=${region}, targets=${targetWebsites ? targetWebsites.join('|') : 'N/A'}`);

        // Call the dedicated action function
        const headingsList = await generateH2HeadingsList(keyword, language, region, targetWebsites);

        console.log(`[API SEO Topic Search] Received H2 headings list from action.`);

        // Return the result as plain text
        return new Response(headingsList, { 
            status: 200, 
            headers: { 'Content-Type': 'text/plain' } 
        });

    } catch (error: any) {
        console.error("[API SEO Topic Search] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate H2 headings list", details: error.message }, 
            { status: 500 }
        );
    }
}
