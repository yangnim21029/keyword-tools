"use client";

import React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MEDIASITE_DATA } from "@/app/global-config";
import Image from "next/image";
import {
  Check,
  ChevronsUpDown,
  Layers,
  Loader2,
  TerminalSquare,
} from "lucide-react";
import type {
  KeywordVolumeListItem,
  KeywordVolumeObject,
} from "@/app/services/firebase/schema";
import { submitGetKeywordVolumeObj } from "@/app/actions/actions-keyword-volume";
import { toast } from "sonner";

// Define interfaces for grouped props
interface KeywordConfig {
  keyword: string;
  setKeyword: (value: string) => void;
  selectedKeywordReport: KeywordVolumeObject | null;
  setSelectedKeywordReport: (value: KeywordVolumeObject | null) => void;
  realKeywordList: KeywordVolumeListItem[];
}

interface MediaSiteConfig {
  mediaSiteName: string;
  setMediaSiteName: (value: string) => void;
  showMediaSiteOptions: boolean;
  setShowMediaSiteOptions: (value: boolean) => void;
}

interface FineTuneConfig {
  selectedFineTunes: string[];
  handleFineTuneChange: (checked: boolean | string, name: string) => void;
  allFineTuneNames: string[];
  showFineTuneOptions: boolean;
}

interface ClusterConfig {
  selectedClusterName: string;
  setSelectedClusterName: (value: string) => void;
  displayedPersona: string | null;
  hasClusters: boolean;
}

interface LoadingState {
  isListLoading: boolean;
  listFetchError: string | null;
  isDetailLoading: boolean;
  setIsDetailLoading: (value: boolean) => void;
  isLoadingPrompt: boolean;
  isGeneratingArticle: boolean;
}

interface UISharedState {
  isMounted: boolean;
  comboboxOpen: boolean;
  setComboboxOpen: (value: boolean) => void;
}

interface Handlers {
  handleSubmitPrompt: (
    event?: React.FormEvent<HTMLFormElement>
  ) => Promise<void>;
}

// Update Props definition
interface PromptGeneratorFormProps {
  keywordConfig: KeywordConfig;
  mediaSiteConfig: MediaSiteConfig;
  fineTuneConfig: FineTuneConfig;
  clusterConfig: ClusterConfig;
  loadingState: LoadingState;
  uiState: UISharedState;
  handlers: Handlers;
}

export const PromptGeneratorForm: React.FC<PromptGeneratorFormProps> = ({
  keywordConfig,
  mediaSiteConfig,
  fineTuneConfig,
  clusterConfig,
  loadingState,
  uiState,
  handlers,
}) => {
  // Destructure props from the grouped objects
  const {
    keyword,
    setKeyword,
    selectedKeywordReport,
    setSelectedKeywordReport,
    realKeywordList,
  } = keywordConfig;
  const {
    mediaSiteName,
    setMediaSiteName,
    showMediaSiteOptions,
    setShowMediaSiteOptions,
  } = mediaSiteConfig;
  const {
    selectedFineTunes,
    handleFineTuneChange,
    allFineTuneNames,
    showFineTuneOptions,
  } = fineTuneConfig;
  const {
    selectedClusterName,
    setSelectedClusterName,
    displayedPersona,
    hasClusters,
  } = clusterConfig;
  const {
    isListLoading,
    listFetchError,
    isDetailLoading,
    setIsDetailLoading,
    isLoadingPrompt,
    isGeneratingArticle,
  } = loadingState;
  const { isMounted, comboboxOpen, setComboboxOpen } = uiState;
  const { handleSubmitPrompt } = handlers;

  if (!isMounted) return null; // Still needed for initial render consistency

  return (
    <form onSubmit={handleSubmitPrompt} className="space-y-6">
      {/* Keyword Input Section */}
      <div className="space-y-2">
        <Label htmlFor="keyword-combobox" className="text-base font-medium">
          Keyword
        </Label>
        <div className="relative">
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                id="keyword-combobox"
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                disabled={
                  isLoadingPrompt ||
                  isListLoading ||
                  isDetailLoading ||
                  isGeneratingArticle
                }
                className="w-full h-12 justify-between pl-3 pr-10 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate">
                  {!keyword ? "Select or type keyword..." : keyword}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-0 w-[--radix-popover-trigger-width]"
            >
              <Command shouldFilter={false} className="p-0">
                <CommandInput
                  placeholder="Search keyword or type..."
                  value={keyword}
                  onValueChange={(search: string) => {
                    setKeyword(search);
                    setSelectedKeywordReport(null); // Clear report
                    setSelectedClusterName("__ALL_CLUSTERS__"); // Reset cluster
                  }}
                  className="h-11"
                />
                <CommandList>
                  {isListLoading && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                      Loading...
                    </div>
                  )}
                  {!isListLoading && listFetchError && (
                    <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">
                      Error: {listFetchError}
                    </div>
                  )}
                  {!isListLoading &&
                    !listFetchError &&
                    realKeywordList.length === 0 && (
                      <CommandEmpty>No keywords found.</CommandEmpty>
                    )}
                  {!isListLoading &&
                    !listFetchError &&
                    realKeywordList.length > 0 && (
                      <CommandGroup>
                        {realKeywordList.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.query}
                            onSelect={async (currentValue: string) => {
                              const selectedItem = realKeywordList.find(
                                (i) =>
                                  i.query.toLowerCase() ===
                                  currentValue.toLowerCase()
                              );
                              if (!selectedItem) return;
                              setKeyword(selectedItem.query);
                              setComboboxOpen(false);
                              setSelectedKeywordReport(null);
                              setSelectedClusterName("__ALL_CLUSTERS__");
                              setIsDetailLoading(true);
                              try {
                                const detailResult =
                                  await submitGetKeywordVolumeObj({
                                    researchId: selectedItem.id,
                                  });
                                setSelectedKeywordReport(
                                  detailResult as KeywordVolumeObject | null
                                );
                                if (!detailResult)
                                  toast.error(
                                    "Could not fetch keyword details."
                                  );
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? `Error fetching details: ${error.message}`
                                    : "Unknown error fetching details."
                                );
                              } finally {
                                setIsDetailLoading(false);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                keyword.toLowerCase() ===
                                  item.query.toLowerCase()
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {item.query}
                            {typeof item.totalVolume === "number" && (
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
          {/* Prompt Generate Button (Inline) - Belongs to parent form */}
          <div className="absolute right-2 top-2 h-8 flex items-center">
            {/* Button is now part of the parent form, triggered by onSubmit */}
            <Button
              type="submit" // Submit the parent form
              disabled={
                isLoadingPrompt ||
                isDetailLoading ||
                isGeneratingArticle ||
                !keyword ||
                !mediaSiteName
              }
              className={cn(
                "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700",
                (isLoadingPrompt || isDetailLoading || isGeneratingArticle) &&
                  "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoadingPrompt ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TerminalSquare className="h-3.5 w-3.5" />
              )}
              Generate Prompt
            </Button>
          </div>
        </div>
      </div>

      {/* Media Site Button (visible when options are hidden) */}
      <div className="pt-1">
        {!showMediaSiteOptions &&
          (isMounted && mediaSiteName ? (
            (() => {
              const site = MEDIASITE_DATA.find((s) => s.name === mediaSiteName);
              let hostname = "";
              try {
                hostname = new URL(site?.url || ".").hostname;
              } catch (e) {
                /* ignore */
              }
              const faviconUrl =
                hostname && hostname !== "."
                  ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                  : null;
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMediaSiteOptions(true)}
                  disabled={
                    isLoadingPrompt || isDetailLoading || isGeneratingArticle
                  }
                  title={`Selected: ${mediaSiteName}`}
                  className={cn(
                    "w-full justify-start text-left font-normal h-10 text-sm"
                  )}
                >
                  {faviconUrl && (
                    <Image
                      src={faviconUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 mr-2 flex-shrink-0"
                      unoptimized
                    />
                  )}
                  <span className="truncate">Media Site: {mediaSiteName}</span>
                </Button>
              );
            })()
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowMediaSiteOptions(true)}
              disabled={
                isLoadingPrompt || isDetailLoading || isGeneratingArticle
              }
              className="w-full justify-start text-left font-normal h-10 text-sm text-muted-foreground"
            >
              Select Media Site...
            </Button>
          ))}
      </div>

      {/* Media Site Selection Area */}
      {showMediaSiteOptions && (
        <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-2 bg-white dark:bg-neutral-900 rounded-md mt-1">
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
            SELECT_MEDIA_SITE:
          </p>
          <div className="flex flex-wrap gap-2">
            {MEDIASITE_DATA.map((site) => {
              let hostname = "";
              try {
                hostname = new URL(site.url).hostname;
              } catch (e) {
                /* ignore */
              }
              const faviconUrl = hostname
                ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                : null;
              return (
                <Button
                  key={site.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMediaSiteName(site.name);
                    setShowMediaSiteOptions(false);
                  }}
                  disabled={
                    isLoadingPrompt || isDetailLoading || isGeneratingArticle
                  }
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs font-mono",
                    mediaSiteName === site.name &&
                      "ring-2 ring-primary ring-offset-background"
                  )}
                >
                  {faviconUrl && (
                    <Image
                      src={faviconUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="w-4 h-4 flex-shrink-0"
                      unoptimized
                    />
                  )}
                  {site.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fine-Tune Selection Area (Only shown when toggled by parent) */}
      {showFineTuneOptions && (
        <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-3 bg-white dark:bg-neutral-900 rounded-md mt-1">
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
            SELECT_FINE_TUNE_SETS:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allFineTuneNames.map((name) => (
              <div key={name} className="flex items-center space-x-2">
                <Checkbox
                  id={`fine-tune-${name}`}
                  checked={selectedFineTunes.includes(name)}
                  onCheckedChange={(checked) =>
                    handleFineTuneChange(checked, name)
                  }
                  disabled={
                    isLoadingPrompt || isDetailLoading || isGeneratingArticle
                  }
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
            Selected sets adjust the final prompt.
          </p>
        </div>
      )}

      {/* Cluster Selection Dropdown */}
      {hasClusters && (
        <div className="space-y-2">
          <Label htmlFor="cluster-select" className="text-base font-medium">
            Target Cluster / Persona (Optional)
          </Label>
          <Select
            value={selectedClusterName}
            onValueChange={setSelectedClusterName}
            disabled={isLoadingPrompt || isDetailLoading || isGeneratingArticle}
          >
            <SelectTrigger
              id="cluster-select"
              className="w-full h-10 text-sm bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <SelectValue placeholder="Select a cluster..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL_CLUSTERS__">
                All Clusters (No Specific Persona)
              </SelectItem>
              {selectedKeywordReport?.clustersWithVolume?.map(
                (cluster: any, index: number) => (
                  <SelectItem
                    key={cluster.clusterName || `cluster-${index}`}
                    value={cluster.clusterName || `Cluster ${index + 1}`}
                  >
                    {cluster.clusterName || `Cluster ${index + 1}`} (Vol:{" "}
                    {cluster.totalVolume?.toLocaleString() ?? "N/A"})
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          {/* Display Persona */}
          {selectedClusterName !== "__ALL_CLUSTERS__" && (
            <div className="mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-900/10 text-sm text-indigo-800 dark:text-indigo-200">
              {displayedPersona ? (
                <>
                  <p className="font-medium mb-1">
                    Persona: {selectedClusterName}
                  </p>
                  <p className="text-xs opacity-80 line-clamp-3">
                    {displayedPersona}
                  </p>
                </>
              ) : (
                <p className="text-xs opacity-70 italic">
                  (Persona description loading or not found)
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
};
