"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getProcessedOpportunityByIdAction } from "@/app/actions/actions-oppourtunity";
import { ProcessedFirebaseOppourtunity } from "@/app/services/firebase/data-oppourtunity";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  ExternalLink,
  AlertCircle,
  Loader2,
  Tag,
  Users,
  CalendarDays,
  Type,
  Link2,
  Info,
  Globe,
  FileText,
  Brain,
} from "lucide-react";

export default function OpportunityDetailPage() {
  const params = useParams<{ oppourtunityId: string }>();
  const { oppourtunityId } = params;
  // const router = useRouter(); // If needed for navigation
  const [opportunity, setOpportunity] =
    useState<ProcessedFirebaseOppourtunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (oppourtunityId) {
      const fetchOpportunity = async () => {
        setLoading(true);
        setError(null);
        try {
          const result = await getProcessedOpportunityByIdAction(
            oppourtunityId as string
          );
          if (result.error) {
            setError(result.error);
            setOpportunity(null);
          } else if (result.opportunity) {
            setOpportunity(result.opportunity);
          } else {
            setError("Opportunity data is missing in the response.");
            setOpportunity(null);
          }
        } catch (e) {
          console.error("Failed to fetch opportunity details:", e);
          setError(
            e instanceof Error ? e.message : "An unknown error occurred."
          );
          setOpportunity(null);
        }
        setLoading(false);
      };
      fetchOpportunity();
    }
  }, [oppourtunityId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="ml-4 text-lg text-gray-700">
          Loading opportunity details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/oppourtunity">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Opportunities
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Opportunity</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/oppourtunity">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Opportunities
          </Link>
        </Button>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Opportunity Not Found</AlertTitle>
          <AlertDescription>
            The requested opportunity could not be found. It might have been
            deleted or the ID is incorrect.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const DetailItem = ({
    icon: Icon,
    label,
    value,
    isLink,
    linkHref,
  }: {
    icon: React.ElementType;
    label: string;
    value?: string | number | null;
    isLink?: boolean;
    linkHref?: string;
  }) => {
    if (value === null || typeof value === "undefined" || value === "")
      return null;
    return (
      <div className="flex items-start space-x-3 py-2">
        <Icon className="h-5 w-5 text-gray-500 mt-1 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          {isLink && linkHref ? (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {value}
            </a>
          ) : (
            <p className="text-sm text-gray-900 break-words">{String(value)}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-100 py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        <Button
          variant="outline"
          asChild
          className="mb-6 bg-white shadow-sm hover:bg-gray-50"
        >
          <Link href="/oppourtunity">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>

        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-800 text-white p-6">
            <CardTitle className="text-2xl font-bold">
              {opportunity.scrapedTitle || "Opportunity Details"}
            </CardTitle>
            {opportunity.scrapedTitle && opportunity.url && (
              <CardDescription className="text-slate-300 pt-1">
                <a
                  href={opportunity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {decodeURIComponent(opportunity.url)}{" "}
                  <ExternalLink className="inline h-4 w-4 ml-1" />
                </a>
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="p-6 space-y-4 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <DetailItem
                icon={Tag}
                label="Original CSV Keyword"
                value={opportunity.originalCsvKeyword}
              />
              {opportunity.csvVolume && (
                <DetailItem
                  icon={Info}
                  label="CSV Volume"
                  value={opportunity.csvVolume}
                />
              )}
              <DetailItem
                icon={Users}
                label="Author"
                value={opportunity.author}
              />
              <DetailItem
                icon={CalendarDays}
                label="Processed At"
                value={
                  opportunity.processedAt
                    ? new Date(opportunity.processedAt).toLocaleString()
                    : "N/A"
                }
              />
              <DetailItem
                icon={Type}
                label="Status"
                value={opportunity.status}
              />
              {opportunity.scrapedSiteName && (
                <DetailItem
                  icon={Globe}
                  label="Scraped Site Name"
                  value={opportunity.scrapedSiteName}
                />
              )}
              <DetailItem
                icon={Link2}
                label="Full URL"
                value={decodeURIComponent(opportunity.url)}
                isLink
                linkHref={opportunity.url}
              />
              {opportunity.researchId && (
                <DetailItem
                  icon={Info}
                  label="Research ID (Batch Identifier)"
                  value={opportunity.researchId}
                />
              )}
              {opportunity.onPageResultId && (
                <DetailItem
                  icon={FileText}
                  label="OnPage Result ID"
                  value={opportunity.onPageResultId}
                />
              )}
            </div>

            {opportunity.scrapedExcerpt && (
              <>
                <Separator className="my-4" />
                <DetailItem
                  icon={FileText}
                  label="Scraped Excerpt"
                  value={opportunity.scrapedExcerpt}
                />
              </>
            )}

            {opportunity.keywordGroup && (
              <>
                <Separator className="my-4" />
                <h3 className="text-md font-semibold text-gray-700 flex items-center">
                  <Brain className="h-5 w-5 mr-2 text-purple-600" />
                  AI Keyword Group
                </h3>
                <div className="pl-7 text-sm space-y-1 mt-1">
                  <p>
                    <strong>AI Primary:</strong>{" "}
                    {opportunity.keywordGroup.aiPrimaryKeyword}
                    {opportunity.keywordGroup?.aiPrimaryKeywordVolume !==
                      null &&
                      opportunity.keywordGroup?.aiPrimaryKeywordVolume !==
                        undefined && (
                        <span className="ml-2 text-xs text-gray-500">
                          (
                          {opportunity.keywordGroup.aiPrimaryKeywordVolume.toLocaleString()}
                          )
                        </span>
                      )}
                  </p>
                  <p>
                    <strong>AI Related 1:</strong>{" "}
                    {opportunity.keywordGroup.aiRelatedKeyword1}
                  </p>
                  <p>
                    <strong>AI Related 2:</strong>{" "}
                    {opportunity.keywordGroup.aiRelatedKeyword2}
                  </p>
                  <p className="text-xs text-gray-500 pt-1">
                    (Original CSV Keyword: {opportunity.keywordGroup.csvKeyword}
                    )
                  </p>
                </div>
              </>
            )}

            {opportunity.gscKeywords && opportunity.gscKeywords.length > 0 && (
              <>
                <Separator className="my-4" />
                <h3 className="text-md font-semibold text-gray-700 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-teal-600" />
                  Google Search Console Keywords (
                  {opportunity.gscKeywords.length})
                </h3>
                <ul className="mt-1 pl-7 list-disc space-y-1 text-sm text-gray-800 max-h-60 overflow-y-auto scrollbar-thin pr-2">
                  {opportunity.gscKeywords.map((kw, idx) => (
                    <li key={idx}>
                      <span className="font-medium">{`"${kw.keyword}"`}</span>
                      {` (Pos: ${kw.mean_position.toFixed(1)}, Impr: ${kw.total_impressions}, Clicks: ${kw.total_clicks})`}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {opportunity.lastAttemptError && (
              <>
                <Separator className="my-4" />
                <Alert
                  variant="default"
                  className="border-orange-400 bg-orange-50 text-orange-700"
                >
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <AlertTitle className="font-semibold text-orange-800">
                    Last Processing Error
                  </AlertTitle>
                  <AlertDescription>
                    {opportunity.lastAttemptError}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>

          <CardFooter className="bg-gray-50 p-4 border-t">
            <p className="text-xs text-gray-500">
              Opportunity ID: {opportunity.id}
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
