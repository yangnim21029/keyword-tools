import { keywordVolumeItemSchema } from '@/lib/schemas/keyword.schema';
import {
  type Cluster,
  type CreateKeywordResearchInput,
  type KeywordResearchBase,
  type KeywordResearchFilter,
  type KeywordResearchItem as KeywordResearchItemSchemaType,
  type KeywordResearchListItem as KeywordResearchListItemSchemaType,
  type KeywordResearchStats,
  type Persona,
  type UpdateClustersInput,
  type UpdateKeywordResearchInput,
  type UpdatePersonasInput,
  type UpdateUserPersonaInput,
} from '@/lib/schemas/keywordResearch.schema';
import { z } from 'zod';

// Re-export inferred types from schema for clarity, maybe adjust specific interfaces if needed
export type {
  Cluster, CreateKeywordResearchInput, KeywordResearchBase,
  KeywordResearchFilter,
  KeywordResearchStats, Persona, UpdateClustersInput, UpdateKeywordResearchInput, UpdatePersonasInput, UpdateUserPersonaInput
};

// Infer Keyword type from the keyword schema
export type Keyword = z.infer<typeof keywordVolumeItemSchema>;

/**
 * Complete keyword research item interface.
 * Mirrors KeywordResearchItemSchemaType but defined as an interface for potential extension or clarity.
 */
export type KeywordResearchItem = KeywordResearchItemSchemaType;

/**
 * Keyword research list item interface.
 * Mirrors KeywordResearchListItemSchemaType.
 */
export type KeywordResearchListItem = KeywordResearchListItemSchemaType;


// --- Store Types (Adjusted for consistency) ---

export interface KeywordResearchState { // Renamed from PastResearchState
  researches: KeywordResearchListItem[]; // Use ListItem for potentially large lists
  selectedResearchId: string | null;
  selectedResearchDetail: KeywordResearchItem | null; // Use full Item for detail view
  isLoading: boolean;
  error: string | null;
}

export interface KeywordResearchActions { // Renamed from PastResearchActions
  fetchResearches: (userId: string, filters?: KeywordResearchFilter) => Promise<void>; // Renamed, added optional filters
  fetchResearchDetail: (researchId: string) => Promise<void>; // Added action to fetch full details
  setSelectedResearchId: (id: string | null) => void;
  clearSelectedResearchDetail: () => void;
  notifyResearchSaved: (research: KeywordResearchItem) => void; // Use full Item
  // Specific field update actions
  saveClusters: (researchId: string, data: UpdateClustersInput) => Promise<void>; // Renamed, use input type
  saveUserPersona: (researchId: string, data: UpdateUserPersonaInput) => Promise<void>; // Use input type
  savePersonas: (researchId: string, data: UpdatePersonasInput) => Promise<void>; // Added action for personas
  updateResearch: (researchId: string, data: UpdateKeywordResearchInput) => Promise<void>; // General update action
  createResearch: (data: CreateKeywordResearchInput) => Promise<KeywordResearchItem | null>; // Create action
}

export interface KeywordResearchStore extends KeywordResearchState { // Renamed from PastQueryStore
  actions: KeywordResearchActions;
} 