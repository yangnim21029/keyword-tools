'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Layers, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

import { MEDIASITE_DATA } from '@/app/global-config';
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA
} from '@/app/prompt/fine-tune';
import type { KeywordVolumeListItem as KeywordResearchSummaryItem } from '@/app/services/firebase/schema';

import { useWritingContext } from '../context/writing-context'; // Import the context hook

// Combine all fine-tune data names
const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map(item => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map(item => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map(item => item.name)
];

export function InputParametersForm() {
  // Consume context
  const {
    keyword,
    setKeyword,
    mediaSiteName,
    setMediaSiteName,
    selectedFineTunes,
    setSelectedFineTunes,
    selectedKeywordReport,
    setSelectedKeywordReport,
    selectedClusterName,
    setSelectedClusterName,
    displayedPersona,
    realKeywordList,
    isListLoading,
    listFetchError,
    isDetailLoading,
    setIsDetailLoading, // Need setter for detail fetch
    isMounted,
    isLoading, // Form disabled state
    showMediaSiteOptions,
    setShowMediaSiteOptions,
    showFineTuneOptions,
    setShowFineTuneOptions,
    comboboxOpen,
    setComboboxOpen,
    hasClusters,
    handleFineTuneChange,
    fetchKeywordResearchDetail // Get detail fetch handler
  } = useWritingContext();

  // Local handler to trigger detail fetch from context
  const handleKeywordSelect = async (
    selectedItem: KeywordResearchSummaryItem
  ) => {
    const selectedQuery = selectedItem.query;
    setKeyword(selectedQuery);
    setComboboxOpen(false);
    setSelectedKeywordReport(null); // Clear previous report immediately
    setIsDetailLoading(true);
    try {
      await fetchKeywordResearchDetail(selectedItem.id);
      console.log(
        `[UI] Details fetched successfully for ID: ${selectedItem.id}`
      );
    } catch (error) {
      console.error(
        `[UI] Error fetching keyword details for ID ${selectedItem.id}:`,
        error
      );
      toast.error(
        error instanceof Error
          ? `Error fetching details: ${error.message}`
          : 'An unknown error occurred while fetching details.'
      );
    } finally {
      setIsDetailLoading(false);
      console.log('[UI] Detail fetching attempt complete.');
    }
  };

  return (
    <>
      {/* Form Content Area */}
      <div className="space-y-6">
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
                  disabled={isLoading || isListLoading}
                  className="w-full h-12 justify-between pl-10 pr-32 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800"
                >
                  <span className="truncate">
                    {!isMounted || !keyword
                      ? 'Select or type keyword...'
                      : keyword}
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
                      setSelectedKeywordReport(null); // Clear report on manual type
                    }}
                    className="h-11"
                  />
                  <CommandList>
                    {isListLoading && (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />
                        Loading keywords...
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
                        <CommandEmpty>No keyword research found.</CommandEmpty>
                      )}
                    {!isListLoading &&
                      !listFetchError &&
                      realKeywordList.length > 0 && (
                        <CommandGroup>
                          {realKeywordList.map(item => (
                            <CommandItem
                              key={item.id}
                              value={item.query}
                              onSelect={() => handleKeywordSelect(item)} // Use handler
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  keyword.toLowerCase() ===
                                    item.query.toLowerCase()
                                    ? 'opacity-100'
                                    : 'opacity-0'
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
            {/* Media Site Button (Simplified) */}
            <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
              {!showMediaSiteOptions &&
                (isMounted && mediaSiteName ? (
                  (() => {
                    const site = MEDIASITE_DATA.find(
                      s => s.name === mediaSiteName
                    );
                    let hostname = '';
                    try {
                      hostname = new URL(site?.url || '.').hostname;
                    } catch (e) {
                      /* ignore */
                    }
                    const faviconUrl =
                      hostname && hostname !== '.'
                        ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                        : null;
                    return (
                      <Button
                        type="button"
                        onClick={() => setShowMediaSiteOptions(true)}
                        disabled={isLoading || isDetailLoading}
                        title={`Selected: ${mediaSiteName}`}
                        className={cn(
                          'flex items-center gap-1.5 px-2 text-xs font-mono transition-colors border h-full',
                          'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700'
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
                        <span className="truncate max-w-[80px]">
                          {mediaSiteName}
                        </span>
                      </Button>
                    );
                  })()
                ) : (
                  <Button
                    type="button"
                    onClick={() => setShowMediaSiteOptions(true)}
                    disabled={isLoading || isDetailLoading}
                    className={cn(
                      'flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full',
                      'bg-gray-50 text-gray-500 border-gray-300 hover:bg-gray-100 dark:bg-neutral-900 dark:text-gray-400 dark:border-neutral-700 dark:hover:bg-neutral-800'
                    )}
                  >
                    [Select Site...]
                  </Button>
                ))}
            </div>
          </div>
        </div>

        {/* Cluster Selection Dropdown */}
        {isMounted && hasClusters && (
          <div className="space-y-2">
            <Label htmlFor="cluster-select" className="text-base font-medium">
              Target Cluster / Persona
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
                <SelectItem value="__ALL_CLUSTERS__">
                  All Clusters (No Specific Persona)
                </SelectItem>
                {selectedKeywordReport?.clustersWithVolume?.map(
                  (cluster: any, index: number) => (
                    <SelectItem
                      key={cluster.clusterName || `cluster-${index}`}
                      value={cluster.clusterName || `Cluster ${index + 1}`}
                    >
                      {cluster.clusterName || `Cluster ${index + 1}`} (Vol:{' '}
                      {cluster.totalVolume?.toLocaleString() ?? 'N/A'})
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            {selectedClusterName !== '__ALL_CLUSTERS__' && (
              <div className="mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md bg-indigo-50/50 dark:bg-indigo-900/10 text-sm text-indigo-800 dark:text-indigo-200">
                {displayedPersona ? (
                  <>
                    <p className="font-medium mb-1">
                      Targeting Persona: {selectedClusterName}
                    </p>
                    <p className="text-xs opacity-80 line-clamp-3">
                      {displayedPersona}
                    </p>
                  </>
                ) : (
                  <p className="text-xs opacity-70 italic">
                    (Persona description not found or not yet generated for this
                    cluster)
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Media Site Selection Area */}
      <div className="space-y-2 pt-1">
        {showMediaSiteOptions && (
          <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-2 bg-white dark:bg-neutral-900">
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              SELECT_MEDIA_SITE:
            </p>
            <div className="flex flex-wrap gap-2">
              {MEDIASITE_DATA.map(site => {
                let hostname = '';
                try {
                  hostname = new URL(site.url).hostname;
                } catch (e) {
                  /* Ignore invalid URLs */
                }
                const faviconUrl = hostname
                  ? `https://www.google.com/s2/favicons?sz=16&domain_url=${hostname}`
                  : null;
                return (
                  <Button
                    key={site.name}
                    type="button"
                    onClick={() => {
                      setMediaSiteName(site.name);
                      setShowMediaSiteOptions(false);
                    }}
                    disabled={isLoading || isDetailLoading}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors border',
                      'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900'
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
      </div>

      {/* Fine-Tune Selection Area */}
      {showFineTuneOptions && (
        <div className="space-y-2 pt-1">
          <div className="border border-gray-300 dark:border-neutral-700 p-3 space-y-3 bg-white dark:bg-neutral-900">
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
              SELECT_FINE_TUNE_SETS (Experimental):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {allFineTuneNames.map(name => (
                <div key={name} className="flex items-center space-x-2">
                  <Checkbox
                    id={`fine-tune-${name}`}
                    checked={selectedFineTunes.includes(name)}
                    onCheckedChange={checked =>
                      handleFineTuneChange(checked, name)
                    }
                    disabled={isLoading || isDetailLoading}
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
    </>
  );
}
