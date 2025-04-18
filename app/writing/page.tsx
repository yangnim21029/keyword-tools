"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, Copy, CheckCircle2, ChevronRight, Search, Globe, Sparkles, TerminalSquare } from "lucide-react"
import { MEDIASITE_DATA } from "@/app/config/constants"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import Image from 'next/image'
import { cn } from "@/lib/utils"
import { useClientStorage } from "@/components/hooks/use-client-storage"

// Define API endpoints
const STEP1_URL = "/api/writing/steps/1-analyze"
const STEP2_URL = "/api/writing/steps/2-plan"
const STEP3_URL = "/api/writing/steps/3-finalize"

// Refined Step Indicator with progress bar
const StepIndicator = ({ current, total, message }: { current: number; total: number; message: string }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium">{message}</span>
      </div>
      <span className="font-semibold">
        {current}/{total}
      </span>
    </div>
    <Progress value={(current / total) * 100} className="h-2" />
  </div>
)

export default function WritingPage() {
  // Use useClientStorage for persistent state
  const [keyword, setKeyword] = useClientStorage("writing:keyword", "")
  const [mediaSiteName, setMediaSiteName] = useClientStorage("writing:mediaSiteName", "")
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>("writing:researchPrompt", null)

  // Keep local state for UI elements like loading, error, copied status, and visibility toggle
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0) // Initial step is 0
  const [copied, setCopied] = useState(false)
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false)

  // Effect to set the initial step based on persisted researchPrompt
  useEffect(() => {
    // If a researchPrompt exists in localStorage, jump to the final step view
    if (researchPrompt) {
      setCurrentStep(4)
    } else {
      // Otherwise, ensure we are at step 0 if there's no prompt
      // This handles cases where the component might re-render without a full page reload
      // after the prompt was cleared.
      setCurrentStep(0)
    }
    // Only re-run this effect if the researchPrompt value changes (e.g., loaded, set, or cleared)
  }, [researchPrompt])

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return "Analyzing SERP and existing content..."
      case 2:
        return "Developing content strategy and outline..."
      case 3:
        return "Generating final research prompt..."
      default:
        return ""
    }
  }

  // Updated function to handle copy with delay and async/await
  const handleCopyToClipboard = async () => { // Make the function async
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt); // Use await
        setCopied(true);

        // Show toast with countdown message
        const redirectDelaySeconds = 3;
        toast.success(`Prompt copied! Redirecting to ChatGPT in ${redirectDelaySeconds} seconds...`);

        // Set a timeout for the redirection
        setTimeout(() => {
          window.location.href = 'https://chatgpt.com/';
        }, redirectDelaySeconds * 1000);

        // Optional: Reset copied state after a slightly longer delay if needed,
        // but redirection will happen first.
        // setTimeout(() => setCopied(false), (redirectDelaySeconds + 2) * 1000);

      } catch (err) {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy prompt.");
        // Ensure copied state is false if copy fails
        setCopied(false);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setResearchPrompt(null)
    setCurrentStep(0)

    if (!keyword || !mediaSiteName) {
      setError("Please provide both a keyword and select a media site.")
      setIsLoading(false)
      return
    }

    console.log(`Submitting: Keyword=${keyword}, MediaSiteName=${mediaSiteName}`)

    try {
      // API call sequence
      setCurrentStep(1)
      const step1Response = await fetch(STEP1_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, mediaSiteName }),
      })
      if (!step1Response.ok)
        throw new Error(
          (await step1Response.json().catch(() => ({}))).details || `Step 1 Failed: ${step1Response.statusText}`,
        )
      const step1Result = await step1Response.json()
      console.log("[Step 1] Success.")

      setCurrentStep(2)
      const step2Response = await fetch(STEP2_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step1Result),
      })
      if (!step2Response.ok)
        throw new Error(
          (await step2Response.json().catch(() => ({}))).details || `Step 2 Failed: ${step2Response.statusText}`,
        )
      const step2Result = await step2Response.json()
      console.log("[Step 2] Success.")

      setCurrentStep(3)
      const step3Response = await fetch(STEP3_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step2Result),
      })
      if (!step3Response.ok) {
        const errorText = await step3Response.text()
        let errorJson
        try {
          errorJson = JSON.parse(errorText)
        } catch (e) {
          /* ignore */
        }
        throw new Error(
          errorJson?.details || errorJson?.error || `Step 3 Failed: ${step3Response.statusText || errorText}`,
        )
      }
      const finalPromptText = await step3Response.text()
      setResearchPrompt(finalPromptText)
      setCurrentStep(4)
      console.log("[Step 3] Success. Final Research Prompt Generated.")
    } catch (err) {
      console.error("Multi-step form submission error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred during generation.")
      setCurrentStep(0)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        <div className="space-y-8">

          {/* Input Form Section - Replaces Card */}
          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            {/* Header like dev page */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">INPUT_PARAMETERS</span>
              </div>
              {/* Optional: Add a version or status text on the right */}
              {/* <span className="text-gray-600 text-xs font-mono">v1.0</span> */}
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              {/* <h2 className="text-2xl font-semibold flex items-center gap-2 mb-1">
                <Search className="h-5 w-5 text-primary" />
                Input Parameters
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Provide a keyword and select a target media site to generate your research prompt
              </p> */}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="keyword" className="text-base font-medium">
                    Keyword
                  </Label>
                  {/* Remove outer flex container, Input container is now just relative */}
                  <div className="relative">
                    <Input
                      id="keyword"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="e.g., Passive income strategies"
                      required
                      disabled={isLoading}
                      // Adjust right padding for the button group container
                      className="h-12 pl-10 pr-52 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary w-full"
                    />
                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                    
                    {/* Wrapper div for buttons inside input */}
                    <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
                      {/* Generate Button */} 
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                          "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full", 
                          "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700"
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TerminalSquare className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </Button>

                      {/* Conditional Placeholder OR Selected Site Button INSIDE input */}
                      {mediaSiteName && !showMediaSiteOptions ? (
                        // Display Selected Site Button
                        (() => {
                          const site = MEDIASITE_DATA.find(s => s.name === mediaSiteName);
                          let hostname = "";
                          try { hostname = new URL(site?.url || ".").hostname; } catch (e) { /* ignore */ }
                          const faviconUrl = hostname && hostname !== "." ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}` : null;
                          return (
                              <Button
                                  type="button"
                                  onClick={() => setShowMediaSiteOptions(true)} // Click this to show options below
                                  disabled={isLoading}
                                  title={`Selected: ${mediaSiteName}`}
                                  className={cn(
                                      "flex items-center gap-1.5 px-2 text-xs font-mono transition-colors border h-full", // Tag style
                                      "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700"
                                  )}
                              >
                                  {faviconUrl && <Image src={faviconUrl} alt="" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />}
                                  <span className="truncate max-w-[80px]">{mediaSiteName}</span>
                              </Button>
                          );
                        })()
                      ) : !showMediaSiteOptions ? (
                        // Display Placeholder Button INSIDE if no site selected and options hidden
                        <Button
                          type="button"
                          onClick={() => setShowMediaSiteOptions(true)}
                          disabled={isLoading}
                          className={cn(
                            "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full", // Style similar to Generate button
                            "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-gray-400 dark:border-neutral-700 dark:hover:bg-neutral-800"
                          )}
                        >
                          [Select Site...]
                        </Button>
                      ) : null} {/* Don't render button here if options are shown below */}
                    </div>
                  </div>
                </div>

                {/* Media Site Selection Area - Renders ONLY Options List BELOW input */}
                <div className="space-y-2 pt-1">
                  {/* Show Options List only when toggled */}
                  {showMediaSiteOptions && (
                    <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-2 bg-white dark:bg-neutral-900">
                       <p className="text-xs font-mono text-gray-500 dark:text-gray-400">SELECT_MEDIA_SITE:</p>
                       <div className="flex flex-wrap gap-2">
                          {MEDIASITE_DATA.map((site) => {
                             let hostname = "";
                             try { hostname = new URL(site.url).hostname; } catch (e) { /* Ignore invalid URLs */ }
                             const faviconUrl = hostname ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}` : null;
                             return (
                                <Button
                                   key={site.name}
                                   type="button"
                                   onClick={() => {
                                      setMediaSiteName(site.name);
                                      setShowMediaSiteOptions(false); // Collapse list on selection
                                   }}
                                   disabled={isLoading}
                                   className={cn(
                                      "flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors border",
                                      // Use default unselected style for options
                                      "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                                   )}
                                >
                                   {faviconUrl && <Image src={faviconUrl} alt="" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />}
                                   {site.name}
                                </Button>
                             );
                          })}
                       </div>
                    </div>
                  )}
                </div>

                {/* Progress Indicator - Replaces Card */}
                {isLoading && currentStep > 0 && currentStep < 4 && (
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">GENERATING_PROMPT</span>
                      </div>
                      {/* Optional: Add status */}
                    </div>
                    {/* Content Area */}
                    <div className="p-6">
                      {/* Title/Description removed, StepIndicator handles it */}
                      {/* <h2 className="text-2xl font-semibold mb-1">Generating Your Prompt</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Please wait while we analyze and create your optimized research prompt
                      </p> */}
                      <StepIndicator current={currentStep} total={3} message={getStepDescription()} />
                    </div>
                  </div>
                )}

                {/* Error Display - Replaces Card */}
                {error && !isLoading && (
                  // Keep left border accent for error
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-red-500">
                    {/* Header */}
                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-red-600 dark:text-red-400 uppercase">ERROR_OCCURRED</span>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500" /> 
                    </div>
                    {/* Content Area */}
                    <div className="p-6">
                      {/* Title/Description removed */}
                      {/* <h2 className="text-2xl font-semibold flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                        <AlertTriangle className="h-5 w-5" />
                        Error Occurred
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        We encountered a problem while generating your prompt
                      </p> */} 
                      <div className="bg-red-50 dark:bg-red-900/10 p-4 text-red-800 dark:text-red-300 text-sm mb-4">
                        {error}
                      </div>
                      <Button
                        onClick={() => setError(null)}
                        className={cn(
                            // Remove rounded-md, adjust unselected colors
                            "px-3 py-1.5 text-xs font-mono transition-colors border",
                            // Unselected state with red hover accents
                            "bg-gray-50 text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50/50 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:border-red-600 dark:hover:bg-red-900/20"
                        )}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {/* Result Display - Replaces Card */}
                {!isLoading && researchPrompt && currentStep === 4 && (
                  // Keep left border accent for success
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-green-500">
                    {/* Header */}
                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-green-600 dark:text-green-400 uppercase">PROMPT_GENERATED</span>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    {/* Content Area */}
                    <div className="p-6">
                      {/* Title/Description removed */}
                      {/* <h2 className="text-2xl font-semibold flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                        <CheckCircle2 className="h-5 w-5" />
                        Prompt Generated
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Your research prompt is ready to use
                      </p> */}
                      <div className="relative mb-4">
                        <Textarea
                          readOnly
                          value={researchPrompt}
                          className={cn(
                            "min-h-[300px] font-mono text-sm leading-relaxed p-5 resize-none border",
                            "bg-gray-50 dark:bg-neutral-950 border-gray-300 dark:border-neutral-800"
                          )}
                        />
                        <Button
                          onClick={handleCopyToClipboard}
                          className={cn(
                            "absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                          )}
                        >
                          {copied ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                      {/* Footer Buttons */}
                      <div className="flex justify-between">
                        <Button
                          onClick={() => {
                            setResearchPrompt(null) // This will clear localStorage via useClientStorage
                            setMediaSiteName("") // This will clear localStorage via useClientStorage
                            setCurrentStep(0) // Reset step locally
                            // No need to remove from sessionStorage
                            // sessionStorage.removeItem("researchPrompt") // Clear prompt from storage
                            // sessionStorage.removeItem("mediaSiteName") // Clear media site from storage
                          }}
                          className={cn(
                              "px-3 py-1.5 text-xs font-mono transition-colors border",
                              "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                          )}
                        >
                          Start Over
                        </Button>
                        <Button 
                          onClick={handleCopyToClipboard}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-700 text-white border-gray-700 hover:bg-gray-600 dark:bg-primary dark:text-primary-foreground dark:border-primary dark:hover:bg-primary/90"
                          )}
                        >
                          Use This Prompt <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
