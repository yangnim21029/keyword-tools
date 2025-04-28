import { submitAiAnalysisSerpContentType } from '@/app/actions/actions-ai-serp-result';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

// --- Define Input Schema ---
const inputSchema = z.object({
  serpDocId: z.string().min(1, 'serpDocId is required')
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/2-analyze-content-type] Received request');
  try {
    const body = await request.json();
    // --- Validate Input ---
    const validation = inputSchema.safeParse(body);
    if (!validation.success) {
      console.error(
        '[API /writing/2-analyze-content-type] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }
    // --- End Validation ---

    const { serpDocId } = validation.data; // Get validated ID
    const result = await submitAiAnalysisSerpContentType({ docId: serpDocId }); // Pass only ID
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      '[API /writing/2-analyze-content-type] Error calling action step:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    // Provide more specific error message if possible
    return NextResponse.json(
      {
        error: 'Failed during content type analysis step',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
