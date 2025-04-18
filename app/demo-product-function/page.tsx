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
  searchParams: Promise<SearchParams>;
}

// Define type for a keyword combination
interface KeywordCombination {
  id: number; // For React key prop
  combination: string;
}

// Helper function to generate keyword combinations
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
// Use Promise<SearchParams> for Next.js 15
export default function SeoFitPage({ searchParams: searchParamsProp }: SeoFitPageProps) {
  // Resolve the searchParams promise
  // Note: Using `use` hook requires the component to be async or be inside Suspense
  // Since this is 'use client', we'll resolve it in useEffect or similar pattern.
  // Let's try resolving directly and managing state.

  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false) // Control dialog state
  const [keywordCombinations, setKeywordCombinations] = useState<KeywordCombination[]>([]);
  const [resolvedParams, setResolvedParams] = useState<SearchParams | null>(null);

  // Effect to resolve searchParams and generate keywords
  useEffect(() => {
    const resolveParams = async () => {
      try {
        const params = await searchParamsProp;
        setResolvedParams(params); // Store resolved params
        console.log("Resolved searchParams:", params);
        const combinations = generateKeywordCombinations(params);
        setKeywordCombinations(combinations);
      } catch (error) {
        console.error("Failed to resolve searchParams:", error);
        // Handle error appropriately, maybe set an error state
      }
    };
    resolveParams();
  }, [searchParamsProp]); // Re-run if the promise prop changes (though unlikely)

  const handleAnalysis = async () => {
    if (!url) return // Basic validation
    setIsLoading(true)
    setResult(null) // Clear previous result

    // Simulate AI analysis delay to feel realistic
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Simulate result (can be randomized or based on URL for demo)
    const isFit = Math.random() > 0.3 // Simple random result for demo purposes
    setResult(
      isFit
        ? "✅ This page appears to be SEO-fit!"
        : "❌ This page may need SEO improvements."
    )
    setIsLoading(false)

    // Keep dialog open to show result. User can close it manually.
  }

  // Reset state when dialog is closed
  const handleOpenChange = (open: boolean) => {
      setDialogOpen(open);
      if (!open) {
          // Reset state when dialog is closed manually or via overlay click
          setUrl("");
          setIsLoading(false);
          setResult(null);
      }
  }

  return (
    <div
      className="relative flex flex-col items-center justify-start min-h-screen overflow-hidden pt-20" // Added pt-20 for spacing from top
    >
      {/* Background Image using next/image */}
      <Image
        src={backgroundImageUrl}
        alt="SEO Analysis Background"
        fill // Makes the image cover the div
        priority // Load the image eagerly as it's the background
        className="object-cover object-center -z-10" // Position behind content, cover area
      />

      {/* Overlay for better text/component visibility - Temporarily Commented Out for Debugging */}
      {/* <div className="absolute inset-0 bg-black bg-opacity-40 z-0"></div> */}

      {/* Content Container */}
      <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center"> {/* Centered content */}

        {/* Dialog for SEO Analysis */}
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
          {/* Button to trigger the Dialog */}
          <DialogTrigger asChild>
            <Button
              variant="secondary" // A less prominent variant for the trigger
              className="absolute top-4 right-4 md:top-6 md:right-6 z-20 shadow-lg" // Ensure button is clickable
            >
              Check SEO Fitness (Demo)
            </Button>
          </DialogTrigger>

          {/* Dialog Content */}
          <DialogContent className="sm:max-w-[425px] bg-white dark:bg-gray-950 rounded-lg shadow-xl"> {/* Style the dialog */}
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

        {/* Keyword Combinations Table */}
        {keywordCombinations.length > 0 && (
          <div className="w-full mt-8 bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Generated Keyword Combinations</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Combination</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywordCombinations.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.id + 1}</TableCell> {/* Display 1-based ID */}
                    <TableCell>{item.combination}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Optional: Add a message if no keywords are found */}
        {resolvedParams && keywordCombinations.length === 0 && (
           <div className="w-full mt-8 bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md text-center">
               <p className="text-gray-600 dark:text-gray-400">No keyword parameters (e.g., ?kw1=term1&kw2=term2) found in the URL to generate combinations.</p>
            </div>
        )}

        {/* Placeholder for other content if needed */}
        {/* <div className="flex-grow flex items-center justify-center text-center p-8 mt-8">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Keyword Tool Area
          </h1>
        </div> */}
      </div>
    </div>
  )
}
