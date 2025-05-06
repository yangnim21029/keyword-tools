'use client';

import { FirebaseOnPageResultObject } from '@/app/services/firebase/data-onpage-result';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  GitMerge,
  Lightbulb,
  Tags,
  Target
} from 'lucide-react';

// Removed V1 and Recommendation buttons
import {
  AnalyzeContentSummaryButton,
  AnalyzeRankingFactorsRecommendationButton,
  // AnalyzeRankingFactorsButton, // Removed V1
  AnalyzeRankingFactorsV2Button, // Restore import
  GenerateGraphButton,
  OrganizeTextContentButton // Import the new button
} from '@/app/actions/actions-buttons';

// Define a type for the data expected by the client component
// Convert server Timestamps to client-safe strings (e.g., ISO strings)
export type ClientSafeScrapeData = Omit<
  FirebaseOnPageResultObject,
  'createdAt' | 'updatedAt'
> & {
  createdAt: string | null;
  updatedAt: string | null;
  originalTextContent?: string | null; // Add the new field
  // --- Use the new text field name ---
  onPageContentAnalysisText?: string | null;
  // onPageRankingFactorAnalysisText?: string | null; // Removed V1 field
  // --- Add the new V2 analysis field ---
  onPageRankingFactorAnalysisV2Text?: string | null;
  // --- Add the new recommendation field ---
  onPageRankingFactorRecommendationText?: string | null;
  // --- Add the paragraph graph field ---
  paragraphGraphText?: string | null;
};

interface ScrapeResultDisplayProps {
  scrapeData: ClientSafeScrapeData | null;
  scrapeId: string;
}

export default function ScrapeResultDisplay({
  scrapeData,
  scrapeId
}: ScrapeResultDisplayProps) {
  if (!scrapeData) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" /> Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Could not load scrape data for ID: {scrapeId}. It might not exist or
            there was an error fetching it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'complete':
        return (
          <Badge variant="secondary">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" /> Processing
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Header Card --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl break-words">
            {scrapeData.title || 'No Title Extracted'}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
            <span>
              URL:{' '}
              <a
                href={scrapeData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {scrapeData.url}
              </a>
            </span>
            <Separator orientation="vertical" className="h-4 hidden md:block" />
            <span>Status: {getStatusBadge(scrapeData.status)}</span>
            {scrapeData.siteName && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-4 hidden md:block"
                />
                <span>Site: {scrapeData.siteName}</span>
              </>
            )}
            {scrapeData.byline && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-4 hidden md:block"
                />
                <span>Author: {scrapeData.byline}</span>
              </>
            )}
            {typeof scrapeData.length === 'number' && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-4 hidden md:block"
                />
                <span>Length: {scrapeData.length.toLocaleString()} chars</span>
              </>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* --- Extracted Text Content --- */}
      <Card>
        <CardHeader>
          <CardTitle>Extracted Text Content</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 dark:bg-neutral-800 p-4 rounded border border-gray-200 dark:border-neutral-700 max-h-[60vh] overflow-y-auto">
            {scrapeData.textContent || 'No text content extracted.'}
          </pre>
          {/* Add the Organize Text button below the content */}
          <div className="mt-4">
            <OrganizeTextContentButton
              docId={scrapeId}
              variant="outline"
              size="sm"
              hasTextContent={
                !!scrapeData?.textContent || !!scrapeData?.originalTextContent
              } // Enable if either current or original text exists
              hasOriginalTextContent={!!scrapeData?.originalTextContent} // Base button text on whether original exists
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* --- Extracted HTML Content (Optional Display) --- */}
      {/* Consider adding a toggle or separate section for HTML if needed */}
      {/*
      <Card>
        <CardHeader>
          <CardTitle>Cleaned HTML Content</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-xs font-mono bg-gray-50 dark:bg-neutral-800 p-4 rounded border border-gray-200 dark:border-neutral-700 max-h-[60vh] overflow-y-auto">
            {scrapeData.htmlContent || 'No HTML content extracted.'}
          </pre>
        </CardContent>
      </Card>
      */}

      {/* --- On-Page AI Analysis Section --- */}
      <Card>
        <CardHeader>
          <CardTitle>On-Page AI Analysis</CardTitle>
          <CardDescription>
            Run AI analyses on the extracted text content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* --- Content Summary Analysis --- */}
          <div className="space-y-2">
            <h4 className="font-semibold text-md mb-2 flex items-center">
              <Lightbulb className="h-4 w-4 mr-2 text-blue-500" /> Content
              Summary & <Tags className="h-4 w-4 ml-1 mr-2 text-green-600" />
              Keywords Analysis
            </h4>

            {/* Display analysis results if available */}
            {scrapeData?.onPageContentAnalysisText ? (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30 mb-3">
                {/* Display Raw Text Output */}
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {scrapeData.onPageContentAnalysisText}
                </pre>
              </div>
            ) : (
              // Show message if analysis hasn't run or failed
              scrapeData?.textContent && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  Analysis not yet run. Click the button below.
                </p>
              )
            )}

            {/* Add the button to trigger the analysis */}
            <AnalyzeContentSummaryButton
              docId={scrapeId}
              variant="outline"
              size="sm"
              // Only disable if no text content
              disabled={!scrapeData?.textContent}
              // Pass whether results exist to change button text
              hasExistingResult={!!scrapeData?.onPageContentAnalysisText}
              className="text-xs"
            />
            {!scrapeData?.textContent && (
              <p className="text-xs text-destructive mt-1">
                Cannot run analysis: No text content available.
              </p>
            )}
          </div>

          <Separator />

          {/* --- Ranking Factor Analysis (V1) --- REMOVED --- */}
          {/* 
          <div className="space-y-2">
             <h4 className="font-semibold text-md mb-2 flex items-center"><ListChecks className="h-4 w-4 mr-2 text-purple-600"/> Ranking Factor Analysis</h4>
             {scrapeData?.onPageRankingFactorAnalysisText ? (
               // ... display V1 results ...
             ) : (
               // ... V1 not run message ...
             )}
             <AnalyzeRankingFactorsButton 
               // ... V1 button props ...
             />
          </div> 
          <Separator/>
          */}

          {/* --- Ranking Factor Analysis V2 --- */}
          <div className="space-y-2">
            <h4 className="font-semibold text-md mb-2 flex items-center">
              <FileCheck className="h-4 w-4 mr-2 text-blue-700" /> Ranking
              Factor Analysis (V2)
            </h4>

            {/* Display V2 analysis results if available */}
            {scrapeData?.onPageRankingFactorAnalysisV2Text ? (
              <div className="p-4 border rounded-md bg-muted/30 mb-3">
                {/* Display V2 Raw Text Output */}
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {scrapeData.onPageRankingFactorAnalysisV2Text}
                </pre>
              </div>
            ) : (
              // Show message if analysis hasn't run
              scrapeData?.textContent && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  V2 Analysis not yet run. Click the button below.
                </p>
              )
            )}

            {/* V2 Button (triggers ONLY analysis now) */}
            <AnalyzeRankingFactorsV2Button
              docId={scrapeId}
              variant="outline"
              size="sm"
              disabled={!scrapeData?.textContent}
              // Base Re-analyze label on V2 analysis text existing
              hasExistingResult={
                !!scrapeData?.onPageRankingFactorAnalysisV2Text
              }
              className="text-xs"
            />
            {!scrapeData?.textContent && (
              <p className="text-xs text-destructive mt-1">
                Cannot run analysis: No text content available.
              </p>
            )}
          </div>

          <Separator />

          {/* --- Editing Tips Section (Formerly Recommendation) --- */}
          <div className="space-y-2">
            <h4 className="font-semibold text-md mb-2 flex items-center">
              <Target className="h-4 w-4 mr-2 text-green-600" /> Specific
              Improvement Recommendations
            </h4>

            {/* Display tips list if available */}
            {scrapeData?.onPageRankingFactorRecommendationText ? (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30 mb-3">
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {scrapeData.onPageRankingFactorRecommendationText}
                </pre>
              </div>
            ) : (
              // Show message if recommendation hasn't run
              scrapeData?.onPageRankingFactorAnalysisV2Text && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  Recommendation not yet generated. Click the button below.
                </p>
              )
            )}

            {/* Add the button to trigger the recommendation */}
            <AnalyzeRankingFactorsRecommendationButton
              docId={scrapeId}
              variant="outline"
              size="sm"
              // Disable if V2 analysis text is missing
              disabled={!scrapeData?.onPageRankingFactorAnalysisV2Text}
              hasPrerequisite={!!scrapeData?.onPageRankingFactorAnalysisV2Text}
              hasExistingResult={
                !!scrapeData?.onPageRankingFactorRecommendationText
              }
              className="text-xs"
            />
            {!scrapeData?.onPageRankingFactorAnalysisV2Text && (
              <p className="text-xs text-destructive mt-1">
                Run V2 Analysis first to generate recommendations.
              </p>
            )}
          </div>

          {/* --- Placeholder for other analyses --- */}
          {/* Add sections for other on-page analyses here */}

          <Separator />

          {/* --- Paragraph Graph Generation --- */}
          <div className="space-y-2">
            <h4 className="font-semibold text-md mb-2 flex items-center">
              <GitMerge className="h-4 w-4 mr-2 text-indigo-600" /> Paragraph
              Structure Graph
            </h4>

            {/* Display graph result if available */}
            {scrapeData?.paragraphGraphText ? (
              <div className="space-y-3 p-4 border rounded-md bg-muted/30 mb-3">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {scrapeData.paragraphGraphText}
                </pre>
              </div>
            ) : (
              // Show message if graph hasn't been generated
              scrapeData?.textContent && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  Graph not yet generated. Click the button below.
                </p>
              )
            )}

            {/* Add the button to trigger the graph generation */}
            {scrapeData?.textContent && (
              <GenerateGraphButton
                docId={scrapeId}
                textContent={scrapeData.textContent}
                hasExistingResult={!!scrapeData?.paragraphGraphText}
                variant="outline"
                size="sm"
                disabled={!scrapeData?.textContent}
                className="text-xs"
              />
            )}
            {!scrapeData?.textContent && (
              <p className="text-xs text-destructive mt-1">
                Cannot generate graph: No text content available.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
