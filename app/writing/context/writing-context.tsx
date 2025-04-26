'use client';

import type {
  KeywordVolumeListItem,
  KeywordVolumeObject
} from '@/app/services/firebase/schema';
import { useClientStorage } from '@/components/hooks/use-client-storage';
import type React from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { toast } from 'sonner';

// --- Re-alias imported types for context definition ---
// We need these types for the context shape
type KeywordResearchSummaryItem = KeywordVolumeListItem;
type ProcessedKeywordResearchData = KeywordVolumeObject;

// Define the shape of the step data
interface Step {
  id: string;
  name: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  durationMs?: number;
}

// Define the shape of the context data
interface WritingContextProps {
  // State
  keyword: string;
  setKeyword: (value: string) => void;
  mediaSiteName: string;
  setMediaSiteName: (value: string) => void;
  researchPrompt: string | null;
  setResearchPrompt: (value: string | null) => void;
  selectedFineTunes: string[];
  setSelectedFineTunes: React.Dispatch<React.SetStateAction<string[]>>;
  // Use the re-aliased type
  selectedKeywordReport: ProcessedKeywordResearchData | null;
  setSelectedKeywordReport: React.Dispatch<
    React.SetStateAction<ProcessedKeywordResearchData | null>
  >;
  selectedClusterName: string;
  setSelectedClusterName: (value: string) => void;
  displayedPersona: string | null;
  // Use the re-aliased type
  realKeywordList: KeywordResearchSummaryItem[];
  isListLoading: boolean;
  setIsListLoading: (value: boolean) => void;
  listFetchError: string | null;
  setListFetchError: (value: string | null) => void;
  isDetailLoading: boolean;
  setIsDetailLoading: (value: boolean) => void;
  isMounted: boolean;
  generationAttempted: boolean;
  setGenerationAttempted: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
  setIsLoading: (value: boolean) => void;
  error: string | null;
  setError: (value: string | null) => void;
  copied: boolean;
  setCopied: (value: boolean) => void;
  showMediaSiteOptions: boolean;
  setShowMediaSiteOptions: (value: boolean) => void;
  showFineTuneOptions: boolean;
  setShowFineTuneOptions: (value: boolean) => void;
  comboboxOpen: boolean;
  setComboboxOpen: (value: boolean) => void;
  generatedOutlineText: string | null;
  setGeneratedOutlineText: React.Dispatch<React.SetStateAction<string | null>>;
  steps: Step[];
  setSteps: React.Dispatch<React.SetStateAction<Step[]>>;
  hasClusters: boolean; // Derived state

  // Handlers
  handleCopyToClipboard: () => Promise<void>;
  handleFineTuneChange: (checked: boolean | string, name: string) => void;
  handleStartOver: () => void;
  fetchKeywordResearchDetail: (id: string) => Promise<void>;
}

// --- Initial State Values (moved inside provider) ---
const initialSteps: Step[] = [
  // Define steps here if needed, or pass from props/constants
  { id: 'fetch-serp', name: 'Step 1: Fetch SERP', status: 'pending' },
  {
    id: 'analyze-content-type',
    name: 'Step 2: Analyze Content Type',
    status: 'pending'
  },
  {
    id: 'analyze-user-intent',
    name: 'Step 3: Analyze User Intent',
    status: 'pending'
  },
  { id: 'analyze-title', name: 'Step 4: Analyze Title', status: 'pending' },
  {
    id: 'analyze-better-have',
    name: 'Step 5: Analyze Better Have',
    status: 'pending'
  },
  {
    id: 'generate-action-plan',
    name: 'Step 6: Generate Action Plan',
    status: 'pending'
  },
  {
    id: 'generate-final-prompt',
    name: 'Step 7: Generate Final Prompt',
    status: 'pending'
  }
];

// --- Context Creation ---
const WritingContext = createContext<WritingContextProps | null>(null);

// Custom hook to use the context
export function useWritingContext() {
  const context = useContext(WritingContext);
  if (!context) {
    throw new Error('useWritingContext must be used within a WritingProvider');
  }
  return context;
}

// --- Provider Component ---
interface WritingProviderProps {
  children: React.ReactNode;
  initialKeywordList?: KeywordResearchSummaryItem[]; // Accept initial list as prop
}

export function WritingProvider({
  children,
  initialKeywordList = []
}: WritingProviderProps) {
  // --- State Definitions (Moved from page/WritingFormAndResults) ---
  const [keyword, setKeyword] = useClientStorage('writing:keyword', '');
  const [mediaSiteName, setMediaSiteName] = useClientStorage(
    'writing:mediaSiteName',
    ''
  );
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    'writing:researchPrompt',
    null
  );
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>(
    'writing:selectedFineTunes',
    []
  );
  const [selectedKeywordReport, setSelectedKeywordReport] =
    useClientStorage<ProcessedKeywordResearchData | null>(
      'writing:selectedKeywordReport',
      null
    );
  // selectedClusterName is local to the form, but needs to be in context if handleSubmit reads it?
  // Let's keep it in context for now.
  const [selectedClusterName, setSelectedClusterName] =
    useState<string>('__ALL_CLUSTERS__');
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);
  const [realKeywordList, setRealKeywordList] =
    useState<KeywordResearchSummaryItem[]>(initialKeywordList);
  const [isListLoading, setIsListLoading] = useState(false); // Needed for Combobox
  const [listFetchError, setListFetchError] = useState<string | null>(null); // Needed for Combobox
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    'writing:generationAttempted',
    false
  );
  const [isLoading, setIsLoading] = useState(false); // Overall loading state for generation
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false);
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >('writing:generatedOutlineText', null);
  // Initialize steps state - use useClientStorage maybe? Or reset based on generationAttempted?
  // Let's initialize with initialSteps and handle reset logic via handleStartOver/handleSubmit
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  // --- Effects (Moved from page/WritingFormAndResults) ---
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset cluster selection when report changes
  useEffect(() => {
    setSelectedClusterName('__ALL_CLUSTERS__');
  }, [selectedKeywordReport]);

  // Update displayed persona based on selected cluster
  useEffect(() => {
    if (
      selectedClusterName === '__ALL_CLUSTERS__' ||
      !selectedKeywordReport?.clustersWithVolume
    ) {
      setDisplayedPersona(null);
      return;
    }
    const foundCluster = selectedKeywordReport.clustersWithVolume.find(
      (c: any) => c.clusterName === selectedClusterName
    );
    setDisplayedPersona(foundCluster?.personaDescription || null);
    if (
      selectedClusterName !== '__ALL_CLUSTERS__' &&
      !foundCluster?.personaDescription
    ) {
      console.warn(
        `[Context Persona Sync] Persona description not found for selected cluster: ${selectedClusterName}`
      );
    }
  }, [selectedClusterName, selectedKeywordReport]);

  // Maybe restore steps from storage? This seems complex, let's handle reset in handleSubmit/StartOver for now.
  // useEffect(() => {
  //   if (!generationAttempted) { // Only reset if not attempted
  //     setSteps(initialSteps);
  //   }
  // }, [generationAttempted]);

  // --- Derived State ---
  const hasClusters =
    // Explicitly cast to boolean to satisfy type checker
    !!(
      selectedKeywordReport?.clustersWithVolume &&
      Array.isArray(selectedKeywordReport.clustersWithVolume) &&
      selectedKeywordReport.clustersWithVolume.length > 0
    );

  // --- Handlers (Moved/Defined here) ---
  const handleCopyToClipboard = useCallback(async () => {
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt);
        setCopied(true);
        toast.success('Prompt copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        toast.error('Failed to copy prompt.');
        setCopied(false);
      }
    }
  }, [researchPrompt]); // Dependency: researchPrompt

  const handleFineTuneChange = useCallback(
    (checked: boolean | string, name: string) => {
      setSelectedFineTunes(prev => {
        const newSet = new Set(prev);
        if (checked === true) {
          newSet.add(name);
        } else {
          newSet.delete(name);
        }
        return Array.from(newSet);
      });
    },
    [setSelectedFineTunes]
  ); // Dependency: setSelectedFineTunes

  const handleStartOver = useCallback(() => {
    setResearchPrompt(null);
    // Keep keyword? User might want to retry with same keyword
    // setKeyword('');
    setMediaSiteName('');
    setSelectedFineTunes([]);
    setSelectedKeywordReport(null);
    setSelectedClusterName('__ALL_CLUSTERS__');
    setSteps(initialSteps);
    setGenerationAttempted(false);
    setError(null);
    setGeneratedOutlineText(null);
    setShowMediaSiteOptions(false);
    setShowFineTuneOptions(false);
    setComboboxOpen(false);
    setIsLoading(false);
    setCopied(false);
    console.log('[Context] State reset via handleStartOver');
  }, [
    setResearchPrompt,
    setMediaSiteName,
    setSelectedFineTunes,
    setSelectedKeywordReport,
    setSelectedClusterName,
    setSteps,
    setGenerationAttempted,
    setError,
    setGeneratedOutlineText,
    setShowMediaSiteOptions,
    setShowFineTuneOptions,
    setComboboxOpen,
    setIsLoading,
    setCopied
  ]);

  const fetchKeywordResearchDetail = useCallback(
    async (id: string) => {
      setIsDetailLoading(true);
      setSelectedKeywordReport(null);
      setError(null); // Clear previous errors
      try {
        console.log(`[Context] Fetching details via API for Keyword ID: ${id}`);
        // Call the new API route
        const response = await fetch('/api/writing/keyword-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ researchId: id })
        });

        if (!response.ok) {
          let errorDetails = `API Error: ${response.statusText}`;
          try {
            const errorBody = await response.json();
            errorDetails =
              errorBody?.error || errorBody?.details || errorDetails;
          } catch {}
          console.error(
            `[Context] API Error (${response.status}) fetching details: ${errorDetails}`
          );
          throw new Error(errorDetails);
        }

        const detailResult = await response.json();

        if (!detailResult) {
          console.warn(`[Context] No details returned from API for ID: ${id}`);
          setSelectedKeywordReport(null);
          toast.info('No keyword details found for this item.'); // Use info instead of error
        } else {
          setSelectedKeywordReport(
            detailResult as ProcessedKeywordResearchData
          );
          console.log(
            `[Context] Details fetched successfully via API for ID: ${id}`
          );
        }
      } catch (error) {
        console.error(
          `[Context] Error fetching keyword details for ID ${id}:`,
          error
        );
        setSelectedKeywordReport(null);
        const errorMessage =
          error instanceof Error
            ? `Error fetching details: ${error.message}`
            : 'An unknown error occurred while fetching details.';
        setError(errorMessage); // Set context error state
        toast.error(errorMessage);
      } finally {
        setIsDetailLoading(false);
        console.log('[Context] Detail fetching attempt complete.');
      }
    },
    [setSelectedKeywordReport, setIsDetailLoading, setError]
  ); // Dependencies

  // --- Context Value ---
  const value: WritingContextProps = {
    keyword,
    setKeyword,
    mediaSiteName,
    setMediaSiteName,
    researchPrompt,
    setResearchPrompt,
    selectedFineTunes,
    setSelectedFineTunes,
    selectedKeywordReport,
    setSelectedKeywordReport,
    selectedClusterName,
    setSelectedClusterName,
    displayedPersona,
    realKeywordList,
    isListLoading,
    setIsListLoading,
    listFetchError,
    setListFetchError,
    isDetailLoading,
    setIsDetailLoading,
    isMounted,
    generationAttempted,
    setGenerationAttempted,
    isLoading,
    setIsLoading,
    error,
    setError,
    copied,
    setCopied,
    showMediaSiteOptions,
    setShowMediaSiteOptions,
    showFineTuneOptions,
    setShowFineTuneOptions,
    comboboxOpen,
    setComboboxOpen,
    generatedOutlineText,
    setGeneratedOutlineText,
    steps,
    setSteps,
    hasClusters,
    // Handlers
    handleCopyToClipboard,
    handleFineTuneChange,
    handleStartOver,
    fetchKeywordResearchDetail
  };

  return (
    <WritingContext.Provider value={value}>{children}</WritingContext.Provider>
  );
}

// Export necessary types using their original names from schema
export type { KeywordVolumeListItem, KeywordVolumeObject, Step };
