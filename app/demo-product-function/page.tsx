'use client' // Needed for useState, event handlers

import * as React from "react"
import { useState, useEffect, use } from "react" // Added useEffect, use
import Image from 'next/image' // Use next/image for optimization

import { Button } from "@/components/ui/button" // Assuming Shadcn UI setup
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog" // Assuming Shadcn UI setup
import { Input } from "@/components/ui/input" // Assuming Shadcn UI setup
import { Label } from "@/components/ui/label" // Assuming Shadcn UI setup
import { Loader2 } from "lucide-react" // Assuming lucide-react is installed
// Import Shadcn Table components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Assuming the image is placed in the /public directory
const backgroundImageUrl = '/image.png' // Path relative to the /public folder

// Define type for searchParams according to Next.js 15 (Promise-based)
// We expect keywords like kw1, kw2, etc.
type SearchParams = {
  [key: string]: string | string[] | undefined;
}

// Define type for the props including the searchParams Promise
interface SeoFitPageProps {
  searchParams: Promise<SearchParams>; // Keep for potential future use or standard structure
}

// Define type for a keyword combination
interface KeywordCombination {
  id: number; // For React key prop
  combination: string;
}

// --- Mock Data ---
const mockKeywordCombinations: KeywordCombination[] = [
  { id: 1, combination: "simulated keyword one" },
  { id: 2, combination: "ai analysis result" },
  { id: 3, combination: "demo table data" },
  { id: 4, combination: "another example phrase" },
];

// Helper function to generate keyword combinations (Keep for reference or other uses, but not called by default now)
const generateKeywordCombinations = (params: SearchParams): KeywordCombination[] => {
  // Group keywords by their key (kw1, kw2, etc.)
  const keywordGroups: { [key: string]: string[] } = {};
  Object.entries(params).forEach(([key, value]) => {
    if (key.startsWith('kw') && value) {
      const groupKey = key; // Use the original key like kw1, kw2
      if (!keywordGroups[groupKey]) {
        keywordGroups[groupKey] = [];
      }
      const values = Array.isArray(value) ? value : [value];
      values.forEach(v => {
          if (typeof v === 'string' && v.trim() !== '') {
              keywordGroups[groupKey].push(v.trim());
          }
      });
    }
  });

  const groups = Object.values(keywordGroups).filter(group => group.length > 0);

  console.log("Keyword Groups:", groups);

  if (groups.length === 0) {
    return [];
  }

  // Cartesian product function
  const cartesian = <T,>(...arrays: T[][]): T[][] => {
    return arrays.reduce<T[][]>(
      (acc, curr) => {
        return acc.flatMap(a => curr.map(c => [...a, c]));
      },
      [[]] // Start with an array containing an empty array
    );
  };

  // Generate combinations
  const combinationsArrays = cartesian(...groups);

  console.log("Raw Combinations Arrays:", combinationsArrays);

  // Format the combinations
  const formattedCombinations: KeywordCombination[] = combinationsArrays
      .filter(combo => combo.length > 0) // Ensure no empty combinations if input was weird
      .map((combo, index) => ({
          id: index,
          combination: combo.join(' '), // Join keywords with a space
      }));

  console.log("Formatted Combinations:", formattedCombinations);

  return formattedCombinations;
};

// --- Component Definition ---
export default function SeoFitPage({ searchParams: searchParamsProp }: SeoFitPageProps) {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [keywordCombinations, setKeywordCombinations] = useState<KeywordCombination[]>([]);

  const handleAnalysis = async () => {
    if (!url) return;
    setIsLoading(true);
    setResult(null);
    setKeywordCombinations([]); // Reset table before new analysis

    await new Promise(resolve => setTimeout(resolve, 2500));

    const isFit = Math.random() > 0.3;
    setResult(
      isFit
        ? "✅ This page appears to be SEO-fit!"
        : "❌ This page may need SEO improvements."
    );
    // Set mock data after analysis completes
    setKeywordCombinations(mockKeywordCombinations);
    setIsLoading(false);
  }

  const handleOpenChange = (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
          setUrl("");
          setIsLoading(false);
          setResult(null);
          setKeywordCombinations([]); // Reset table when dialog closes
      }
  }

  return (
    <div
      // Changed to center content on the page
      className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900" 
    >
      {/* Content Card - Increased width */}
      <div className="relative z-10 bg-white dark:bg-gray-950 rounded-lg shadow-xl p-6 max-w-2xl w-full flex flex-col items-center">

        {/* Dialog Trigger Button - Moved to top-right */}
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              // Positioned absolute top-right relative to the card
              className="absolute top-4 right-4 z-20 shadow-lg" 
            >
              Check SEO Fitness (Demo)
            </Button>
          </DialogTrigger>

          {/* Image Container within the Card - Increased height */}
          <div className="relative w-full h-64 mb-6 overflow-hidden rounded-md">
            <Image
              src={backgroundImageUrl}
              alt="SEO Analysis Background"
              fill
              priority
              className="object-cover object-center" // Removed -z-10
            />
          </div>

          {/* Dialog Content is nested within Dialog, but trigger is above */}
          {/* The structure implies DialogContent remains associated */} 
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-950 rounded-lg shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">SEO Fitness Analysis</DialogTitle>
              <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                Enter a website URL to simulate an AI-powered SEO fitness check.
              </DialogDescription>
            </DialogHeader>
            {/* Input Section */}
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="url" className="text-right text-sm font-medium">
                  URL
                </Label>
                <Input
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="col-span-3"
                  disabled={isLoading} // Disable input during analysis
                />
              </div>
            </div>
            {/* Result/Loading Area */}
            <div className="min-h-[40px] flex items-center justify-center text-center px-6 py-2">
              {isLoading ? (
                 <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                   <Loader2 className="h-5 w-5 animate-spin" />
                   <span>Analyzing URL... Please wait...</span>
                 </div>
              ) : result ? (
                // Display result with appropriate color
                <p className={`text-base font-medium ${result.startsWith('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {result}
                </p>
              ) : (
                // Placeholder when no result or loading
                <span className="text-sm text-gray-400 dark:text-gray-500">Enter a URL and run analysis.</span>
              )}
            </div>
            
            {/* Keyword Combinations Table - RE-INSERTED inside DialogContent */}
            {keywordCombinations.length > 0 && (
              <div className="mt-4 pt-4 border-t"> {/* Add margin and top border for separation */}
                <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200 text-center">Simulated Keyword Combinations</h2> {/* Adjusted heading size/margin */}
                <div className="max-h-[200px] overflow-y-auto px-2"> {/* Scrollable area */}                
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">ID</TableHead> {/* Smaller ID column */}
                        <TableHead>Combination</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keywordCombinations.map((item) => (
                        // Wrap TableRow in React Fragment to potentially help with hydration issues
                        <React.Fragment key={item.id}>
                          <TableRow>
                            <TableCell className="font-medium">{item.id}</TableCell>
                            <TableCell>{item.combination}</TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Dialog Footer with Action Button */}
            <DialogFooter>
              <Button
                type="button" // Use button type to prevent default form submission
                onClick={handleAnalysis}
                disabled={isLoading || !url.trim()} // Disable if loading or URL is empty/whitespace
                className="w-full sm:w-auto" // Adjust button width
              >
                {isLoading ? (
                    // Show loading state in button
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                    </>
                 ) : (
                    // Default button text
                    "Run Analysis"
                 )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
