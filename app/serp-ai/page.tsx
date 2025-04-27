import {
  getSerpResultList,
  getTotalSerpDataCount
} from '../services/firebase/data-serp-result';

import Link from 'next/link';

// --- Shadcn UI Imports ---
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Info } from 'lucide-react';
import CreateNewSerpForm from './create-new-serp-form';
// --- End Shadcn UI Imports ---

// import { CreateNewSerpButton } from '../actions/actions-buttons'; // Assuming this button allows setting params later

export default async function SerpAnalysisListPage() {
  const totalAnalyzedCount = await getTotalSerpDataCount();
  const serpResultList = await getSerpResultList(); // Returns { id, keyword, region, language, timestamp }[]

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold mb-6">SERP Analysis History</h1>

      {/* Total Count Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Total Analyses</AlertTitle>
        <AlertDescription>
          You have analyzed a total of{' '}
          <strong>{totalAnalyzedCount.toLocaleString()}</strong> SERP pages.
        </AlertDescription>
      </Alert>

      <CreateNewSerpForm />

      {/* List of SERP Results */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Records</CardTitle>
          <CardDescription>
            List of previously fetched and analyzed SERP results.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="text-right">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serpResultList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No analysis records found.
                  </TableCell>
                </TableRow>
              ) : (
                serpResultList.map(serp => (
                  <TableRow key={serp.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/serp-ai/${serp.id}`}
                        className="hover:underline text-blue-600"
                      >
                        {serp.keyword || 'N/A'}
                      </Link>
                    </TableCell>
                    <TableCell>{serp.region || 'N/A'}</TableCell>
                    <TableCell>{serp.language || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      {serp.timestamp &&
                      typeof serp.timestamp.toDate === 'function'
                        ? serp.timestamp.toDate().toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {serpResultList.length > 0 && (
              <TableCaption>A list of your recent SERP analyses.</TableCaption>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Create New Section - Placeholder: Needs input form + action */}
      {/* Removed the problematic commented-out Card block */}
    </div>
  );
}
