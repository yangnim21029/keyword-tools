"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
// Shadcn UI Select components import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, AlertTriangle, Copy, CheckCircle2, ChevronRight, Search, TerminalSquare, Settings2, Check, ChevronsUpDown, Layers } from "lucide-react"
import { MEDIASITE_DATA } from "@/app/config/constants"
import { THEME_FINE_TUNE_DATA, MEDIA_SITE_FINE_TUNE_DATA, LANGUAGE_FINE_TUNE_DATA } from "@/app/prompt/fine-tune"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import Image from 'next/image'
import { cn } from "@/lib/utils"
import { useClientStorage } from "@/components/hooks/use-client-storage"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { fetchKeywordResearchSummaryAction, fetchKeywordResearchDetail } from "@/app/actions/keyword-research-action";
import type { KeywordResearchSummaryItem } from '@/app/services/firebase/db-keyword-research';

// Define API endpoints
const STEP1_URL = "/api/writing/steps/1-analyze"
const STEP2_URL = "/api/writing/steps/2-plan"
const STEP3_URL = "/api/writing/steps/3-finalize"

// Combine all fine-tune data names
const allFineTuneNames = [
    ...THEME_FINE_TUNE_DATA.map(item => item.name),
    ...MEDIA_SITE_FINE_TUNE_DATA.map(item => item.name),
    ...LANGUAGE_FINE_TUNE_DATA.map(item => item.name)
];

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

// Define a constant for the "All Clusters" value
const ALL_CLUSTERS_VALUE = "__ALL_CLUSTERS__";

export default function WritingPage() {
  // Use useClientStorage for persistent state
  const [keyword, setKeyword] = useClientStorage("writing:keyword", "")
  const [mediaSiteName, setMediaSiteName] = useClientStorage("writing:mediaSiteName", "")
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>("writing:researchPrompt", null)
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>("writing:selectedFineTunes", [])
  const [selectedKeywordReport, setSelectedKeywordReport] = useClientStorage<Record<string, any> | null>("writing:selectedKeywordReport", null)

  // --- Add State for Cluster Selection --- 
  const [selectedClusterName, setSelectedClusterName] = useState<string>(ALL_CLUSTERS_VALUE);
  const [useClusterSelection, setUseClusterSelection] = useState<boolean>(false);
  // --- End Cluster State --- 

  // --- State for real data ---
  const [realKeywordList, setRealKeywordList] = useState<KeywordResearchSummaryItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(true); // Start loading initially
  const [listFetchError, setListFetchError] = useState<string | null>(null);
  // --- End State --- 

  // --- State for loading detail ---
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  // --- End State ---

  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);
  // --- End State ---

  // Keep local state for UI elements like loading, error, copied status, and visibility toggle
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0) // Initial step is 0
  const [copied, setCopied] = useState(false)
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false)
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false) // State for Combobox popover

  // Effect to set the initial step based on persisted researchPrompt
  useEffect(() => {
    if (researchPrompt) {
      setCurrentStep(4)
    } else {
      setCurrentStep(0)
    }
  }, [researchPrompt])

  // --- Effect for hydration fix ---
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // --- End Effect ---

  // --- Effect to fetch real keyword data --- 
  useEffect(() => {
    const loadKeywords = async () => {
      setIsListLoading(true);
      setListFetchError(null);
      try {
        const result = await fetchKeywordResearchSummaryAction(); // Fetch summary list
        if (result.error) {
          throw new Error(result.error);
        }
        setRealKeywordList(result.data || []);
      } catch (error) {
        console.error("Failed to fetch keyword research list:", error);
        setListFetchError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setIsListLoading(false);
      }
    };

    loadKeywords();
  }, []); // Run only on mount
  // --- End Fetch Effect --- 

  // --- Effect to reset cluster selection when keyword report changes --- 
  useEffect(() => {
    // Reset to default whenever the report changes (or is cleared)
    setSelectedClusterName(ALL_CLUSTERS_VALUE);
  }, [selectedKeywordReport]);
  // --- End Cluster Reset Effect --- 

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

  const handleCopyToClipboard = async () => {
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt);
        setCopied(true);
        toast.success("Prompt copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy prompt.");
        setCopied(false);
      }
    }
  };

  const handleFineTuneChange = (checked: boolean | string, name: string) => {
    setSelectedFineTunes(prev => {
      if (checked === true) {
        return [...prev, name];
      } else {
        return prev.filter(item => item !== name);
      }
    });
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

    const firstKeyword = keyword.split(",")[0].trim()
    if (!firstKeyword) {
        setError("Please provide a valid keyword.")
        setIsLoading(false)
        return
    }

    // Determine the cluster name to send based on the checkbox state
    const clusterNameToSend = useClusterSelection && selectedClusterName !== ALL_CLUSTERS_VALUE
      ? selectedClusterName
      : null;

    console.log(`Submitting: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName}, FineTunes=${selectedFineTunes.join(', ')}, UseCluster=${useClusterSelection}, ClusterToSend=${clusterNameToSend}`);

    let step1Result: any = null;
    let step2Result: any = null;

    try {
      // --- Step 1 --- 
      setCurrentStep(1)
      const step1Response = await fetch(STEP1_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: firstKeyword,
          mediaSiteName,
          fineTuneNames: selectedFineTunes,
          keywordReport: selectedKeywordReport,
          selectedClusterName: clusterNameToSend
        }),
      })
      // Refactored Error Handling for Step 1
      if (!step1Response.ok) {
        let errorDetails = `Step 1 Failed: ${step1Response.statusText}`;
        try {
          const errorBody = await step1Response.json();
          if (errorBody && errorBody.details) {
            errorDetails = errorBody.details;
          } else if (errorBody && errorBody.error) { // Check for .error property as well
            errorDetails = errorBody.error;
          }
        } catch (jsonError) {
          console.warn("[Step 1] Could not parse error response body as JSON.", jsonError);
          const textError = await step1Response.text().catch(() => null);
          if (textError) errorDetails += ` - ${textError}`;
        }
        throw new Error(errorDetails);
      }
      step1Result = await step1Response.json();
      console.log("[Step 1] Success.")

      // --- Step 2 --- 
      setCurrentStep(2)
      const step2Response = await fetch(STEP2_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step1Result), // Pass result from Step 1
      })
      // Refactored Error Handling for Step 2
      if (!step2Response.ok) {
        let errorDetails = `Step 2 Failed: ${step2Response.statusText}`;
        try {
          const errorBody = await step2Response.json();
          if (errorBody && errorBody.details) {
            errorDetails = errorBody.details;
          } else if (errorBody && errorBody.error) {
            errorDetails = errorBody.error;
          }
        } catch (jsonError) {
          console.warn("[Step 2] Could not parse error response body as JSON.", jsonError);
          const textError = await step2Response.text().catch(() => null);
          if (textError) errorDetails += ` - ${textError}`;
        }
        throw new Error(errorDetails);
      }
      step2Result = await step2Response.json();
      console.log("[Step 2] Success.")

      // --- Step 3 --- 
      setCurrentStep(3)
      const step3Response = await fetch(STEP3_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step2Result), // Pass result from Step 2
      })
      // Refactored Error Handling for Step 3 (expects text response)
      if (!step3Response.ok) {
        let errorDetails = `Step 3 Failed: ${step3Response.statusText}`;
        let errorBody = null; // Initialize errorBody
        try {
          // Try parsing as JSON first, as Vercel might return JSON errors
          errorBody = await step3Response.json(); 
          if (errorBody && errorBody.details) {
            errorDetails = errorBody.details;
          } else if (errorBody && errorBody.error) {
            errorDetails = errorBody.error;
          } else {
             // If JSON parsed but no specific error field, stringify it
             errorDetails += ` - ${JSON.stringify(errorBody)}`; 
          }
        } catch (jsonError) {
          // If JSON parsing fails, try getting text
          console.warn("[Step 3] Could not parse error response body as JSON, trying text().", jsonError);
          try {
            const textError = await step3Response.text(); // Await here
            if (textError) errorDetails += ` - ${textError}`; // Append raw text if available
          } catch (textErrorErr) {
              console.warn("[Step 3] Could not parse error response body as text either.", textErrorErr);
          }
        }
        throw new Error(errorDetails);
      }
      const finalPromptText = await step3Response.text(); // Expecting text on success
      // --- Add Logging Before Final State Update --- 
      console.log("[UI Debug] Final Prompt Text Received from Step 3:", finalPromptText ? `"${finalPromptText.substring(0, 100)}..."` : '<<(EMPTY or NULL)>>');
      console.log("[UI Debug] Setting researchPrompt and currentStep=4");
      // --- End Logging --- 
      setResearchPrompt(finalPromptText);
      setCurrentStep(4);
      console.log("[Step 3] Success. Final Research Prompt Generated.");

    } catch (err) {
      // --- Add Logging Inside Catch Block --- 
      console.error("[UI Debug] Error caught in handleSubmit:", err);
      // --- End Logging ---
      console.error("Multi-step form submission error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred during generation.");
      setCurrentStep(0);
    } finally {
      // --- Add Logging Inside Finally Block --- 
      console.log("[UI Debug] handleSubmit finally block reached. Setting isLoading=false.");
      // --- End Logging ---
      setIsLoading(false);
    }
  }

  // Check if the report has clusters
  const hasClusters = selectedKeywordReport?.clusters && Array.isArray(selectedKeywordReport.clusters) && selectedKeywordReport.clusters.length > 0;
  // Add logging for debugging cluster issues
  useEffect(() => {
    console.log("[UI Debug] selectedKeywordReport updated:", selectedKeywordReport);
    console.log("[UI Debug] hasClusters calculated:", hasClusters);
  }, [selectedKeywordReport, hasClusters]);

  // Add logging for final state before render
  console.log(`[UI Render State] isLoading=${isLoading}, hasResearchPrompt=${!!researchPrompt}, currentStep=${currentStep}`);

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        <div className="space-y-8">

          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                 {/* Window controls */}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">INPUT_PARAMETERS</span>
              </div>
              {/* Right side controls */}
              <div className="flex items-center gap-4"> {/* Increased gap */} 
                {/* Cluster Selection Checkbox - Conditionally render based on mount */}
                {isMounted && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-cluster"
                      checked={useClusterSelection}
                      onCheckedChange={(checked) => setUseClusterSelection(checked === true)} 
                      disabled={!hasClusters || isLoading || isDetailLoading} // Disable if no clusters or loading
                    />
                    <Label
                      htmlFor="use-cluster"
                      className={cn(
                        "text-xs font-mono text-gray-500 dark:text-gray-400",
                        (!hasClusters || isLoading || isDetailLoading) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      Target Cluster
                    </Label>
                  </div>
                )}
                {/* Fine-tune Toggle Button */} 
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFineTuneOptions(!showFineTuneOptions)}
                  className="text-xs font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-2 py-1 h-auto"
                  disabled={isLoading || isDetailLoading}
                >
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  Fine-Tune ({isMounted ? selectedFineTunes.length : 0})
                </Button>
              </div>
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keyword Input Section */}
                <div className="space-y-2">
                  <Label htmlFor="keyword-combobox" className="text-base font-medium">
                    Keyword
                  </Label>
                  <div className="relative">
                     {/* --- Combobox for Keyword Input --- */}
                     <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="keyword-combobox" // Add id for label association
                          variant="outline"
                          role="combobox"
                          aria-expanded={comboboxOpen}
                          disabled={isLoading || isListLoading} // Disable if form is loading OR list is loading
                          className="w-full h-12 justify-between pl-10 pr-52 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800"
                        >
                          <span className="truncate">
                            {!isMounted || !keyword ? "Select or type keyword..." : keyword}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        align="start" 
                        className="p-0" 
                        style={{ width: 'var(--radix-popover-trigger-width)' }}
                      >
                        <Command shouldFilter={false} className="p-0">
                          <CommandInput
                            placeholder="Search keyword or type..."
                            value={keyword}
                            onValueChange={(search: string) => {
                              setKeyword(search);
                              setSelectedKeywordReport(null); // Clear report and cluster
                            }}
                            className="h-11" />
                          <CommandList>
                            {/* Loading State */}
                            {isListLoading && (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                                Loading keywords...
                              </div>
                            )}
                            {/* Error State */}
                            {!isListLoading && listFetchError && (
                              <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
                                Error: {listFetchError}
                              </div>
                            )}
                            {/* Empty State */}
                            {!isListLoading && !listFetchError && realKeywordList.length === 0 && (
                              <CommandEmpty>No keyword research found.</CommandEmpty>
                            )}
                            {/* Real Data */}
                            {!isListLoading && !listFetchError && realKeywordList.length > 0 && (
                              <CommandGroup>
                                {realKeywordList.map((item) => (
                                  <CommandItem
                                    key={item.id}
                                    value={item.query} // Use query for value
                                    onSelect={async (currentValue: string) => { 
                                      const selectedItem = realKeywordList.find(i => i.query.toLowerCase() === currentValue.toLowerCase());
                                      if (!selectedItem) return; 

                                      const selectedQuery = selectedItem.query;
                                      setKeyword(selectedQuery); 
                                      setComboboxOpen(false);
                                      setSelectedKeywordReport(null); // Clear previous report immediately
                                      setIsDetailLoading(true); 

                                      try {
                                        console.log(`[UI] Fetching details for: ${selectedItem.id}`);
                                        const detailResult = await fetchKeywordResearchDetail(selectedItem.id);
                                        // --- Add Detailed Logging --- 
                                        console.log("[UI Debug] Detail Result Received from Action:", detailResult);
                                        if (detailResult) {
                                            console.log("[UI Debug] Clusters in Detail Result:", detailResult.clusters);
                                            console.log("[UI Debug] Is detailResult.clusters an Array?:", Array.isArray(detailResult.clusters));
                                        }
                                        // --- End Detailed Logging ---

                                        if (!detailResult) {
                                          toast.error(`Details not found for "${selectedQuery}".`);
                                          setSelectedKeywordReport(null); 
                                        } else {
                                          console.log(`[UI] Details fetched for "${selectedQuery}", storing report.`);
                                          setSelectedKeywordReport(detailResult); // This triggers the useEffect log above
                                          toast.success(`Loaded details for "${selectedQuery}"`);
                                        }
                                      } catch (error) {
                                        console.error(`[UI] Error fetching details for ${selectedItem.id}:`, error);
                                        toast.error(`Failed to load details for "${selectedQuery}".`);
                                        setSelectedKeywordReport(null); 
                                      } finally {
                                        setIsDetailLoading(false); 
                                      }
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        keyword.toLowerCase() === item.query.toLowerCase() ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {item.query}
                                    {typeof item.totalVolume === 'number' && (
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        Vol: {item.totalVolume.toLocaleString()}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {/* --- End Combobox --- */}

                    {/* Action Buttons in Top Right */} 
                    <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
                      {/* Generate Button */}
                      <Button
                        type="submit"
                        disabled={isLoading || isDetailLoading}
                        className={cn(
                          "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                          "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700",
                          (isLoading || isDetailLoading) && "opacity-50 cursor-not-allowed" 
                        )}
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TerminalSquare className="h-3.5 w-3.5" />}
                        Generate
                      </Button>
                      {/* Media Site Button */} 
                      {!showMediaSiteOptions && (
                        isMounted && mediaSiteName ? (
                          (() => {
                            const site = MEDIASITE_DATA.find(s => s.name === mediaSiteName);
                            let hostname = "";
                            try { hostname = new URL(site?.url || ".").hostname; } catch (e) { /* ignore */ }
                            const faviconUrl = hostname && hostname !== "." ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}` : null;
                            return (
                                <Button
                                    type="button"
                                    onClick={() => setShowMediaSiteOptions(true)}
                                    disabled={isLoading || isDetailLoading}
                                    title={`Selected: ${mediaSiteName}`}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2 text-xs font-mono transition-colors border h-full",
                                        "bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700"
                                    )}
                                >
                                    {faviconUrl && <Image src={faviconUrl} alt="" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />}
                                    <span className="truncate max-w-[80px]">{mediaSiteName}</span>
                                </Button>
                            );
                          })()
                        ) : (
                          <Button
                            type="button"
                            onClick={() => setShowMediaSiteOptions(true)}
                            disabled={isLoading || isDetailLoading} 
                            className={cn(
                              "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                              "bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-gray-400 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            )}
                          >
                            [Select Site...]
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* --- Cluster Selection Dropdown (Now Conditionally Rendered by Checkbox) --- */} 
                {isMounted && hasClusters && useClusterSelection && (
                  <div className="space-y-2">
                    <Label htmlFor="cluster-select" className="text-base font-medium">
                      Target Cluster
                    </Label>
                    <Select
                      value={selectedClusterName}
                      onValueChange={setSelectedClusterName}
                      disabled={isLoading || isDetailLoading}
                    >
                      <SelectTrigger
                        id="cluster-select"
                        className="w-full h-12 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <SelectValue placeholder="Select a cluster..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_CLUSTERS_VALUE}>All Clusters / Main Keyword</SelectItem>
                        {selectedKeywordReport?.clusters.map((cluster: any, index: number) => (
                          <SelectItem key={cluster.clusterName || `cluster-${index}`} value={cluster.clusterName || `Cluster ${index + 1}`}>
                            {cluster.clusterName || `Cluster ${index + 1}`} (Vol: {cluster.totalVolume?.toLocaleString() ?? 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* --- End Cluster Selection --- */}

                {/* Media Site Selection Area */}
                <div className="space-y-2 pt-1">
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
                                      setShowMediaSiteOptions(false);
                                   }}
                                   disabled={isLoading || isDetailLoading} // Also disable if detail is loading
                                   className={cn(
                                      "flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors border",
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

                 {/* Fine-Tune Selection Area */} 
                 {showFineTuneOptions && (
                  <div className="space-y-2 pt-1">
                    <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-3 bg-white dark:bg-neutral-900">
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">SELECT_FINE_TUNE_SETS (Experimental):</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {allFineTuneNames.map((name) => (
                          <div key={name} className="flex items-center space-x-2">
                            <Checkbox
                              id={`fine-tune-${name}`}
                              checked={selectedFineTunes.includes(name)}
                              onCheckedChange={(checked) => handleFineTuneChange(checked, name)}
                              disabled={isLoading || isDetailLoading} // Also disable if detail is loading
                            />
                            <Label
                              htmlFor={`fine-tune-${name}`}
                              className="text-sm font-mono text-gray-700 dark:text-gray-300 cursor-pointer"
                            >
                              {name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Selected sets will be appended to the final prompt for the AI.
                      </p>
                    </div>
                  </div>
                )}


                {/* Progress Indicator */} 
                {isLoading && currentStep > 0 && currentStep < 4 && (
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
                     {/* Header */}
                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1"> {/* Window controls */}
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">GENERATING_PROMPT</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <StepIndicator current={currentStep} total={3} message={getStepDescription()} />
                    </div>
                  </div>
                )}

                {/* Error Display */} 
                {error && !isLoading && (
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-red-500">
                    {/* Header */}
                     <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1"> {/* Window controls */}
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-red-600 dark:text-red-400 uppercase">ERROR_OCCURRED</span>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="p-6">
                      <div className="bg-red-50 dark:bg-red-900/10 p-4 text-red-800 dark:text-red-300 text-sm mb-4">
                        {error}
                      </div>
                      <Button
                        onClick={() => setError(null)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-50 text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50/50 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:border-red-600 dark:hover:bg-red-900/20"
                        )}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {/* Result Display */} 
                {!isLoading && researchPrompt && currentStep === 4 && (
                  <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-green-500">
                    {/* Header */}
                    <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1"> {/* Window controls */}
                          <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                          <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                          <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                        </div>
                        <span className="text-xs font-mono text-green-600 dark:text-green-400 uppercase">PROMPT_GENERATED</span>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="p-6">
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
                          type="button"
                          className={cn(
                            "absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                          )}
                        >
                          {copied ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                        </Button>
                      </div>
                      <div className="flex justify-between">
                        <Button
                          onClick={() => {
                            setResearchPrompt(null)
                            setMediaSiteName("")
                            setSelectedFineTunes([])
                            setSelectedKeywordReport(null) 
                            setUseClusterSelection(false);
                            setCurrentStep(0)
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
