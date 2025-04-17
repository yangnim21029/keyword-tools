'use client' // Needed for useState, event handlers

import * as React from "react"
import { useState } from "react"
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

// Assuming the image is placed in the /public directory
const backgroundImageUrl = '/image.png' // Path relative to the /public folder

export default function SeoFitPage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false) // Control dialog state

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
      className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden" // Added overflow-hidden
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

      {/* Content Container - positioned above the overlay */}
      <div className="relative z-10 w-full h-full flex flex-col">

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

        {/* You can add other page content here if needed, make sure it's visible against the background/overlay */}
        {/* Example:
           <div className="flex-grow flex items-center justify-center text-center p-8">
             <h1 className="text-4xl font-bold text-white drop-shadow-lg">
               Welcome to the SEO Fitness Checker
             </h1>
           </div>
        */}
      </div>
    </div>
  )
}
