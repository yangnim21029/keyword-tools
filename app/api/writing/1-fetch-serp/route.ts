import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { fetchSerpStep } from '@/app/actions/writing-actions';
import type { ClientSafeSerpDataDoc } from '@/app/actions/serp-action'; // Type for result

// Input schema should match the expected input for fetchSerpStep
const inputSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  mediaSiteName: z.string().min(1, 'Media site name is required'),
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/1-fetch-serp] Received request');
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error('[API /writing/1-fetch-serp] Invalid input:', validation.error.errors);
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
    }

    const inputData = validation.data;
    console.log(`[API /writing/1-fetch-serp] Calling action step for Keyword: "${inputData.keyword}", Site: "${inputData.mediaSiteName}"`);

    // Call the imported action function
    const result: ClientSafeSerpDataDoc = await fetchSerpStep(inputData);

    console.log(`[API /writing/1-fetch-serp] Action step completed. Doc ID: ${result.id}`);
    // Return the result from the action step
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /writing/1-fetch-serp] Error calling action step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed during fetch SERP step', details: errorMessage }, { status: 500 });
  }
} 