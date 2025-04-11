import { keywordVolumeItemSchema } from '@/lib/schemas/keyword.schema';
import {
  type Cluster,
  type ClusteringStatus,
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
  type KeywordVolumeItem
} from '@/lib/schemas';
import { z } from 'zod';

// Re-export inferred types from schema for clarity, maybe adjust specific interfaces if needed
export type {
  Cluster,
  ClusteringStatus,
  CreateKeywordResearchInput,
  KeywordResearchBase,
  KeywordResearchFilter,
  KeywordResearchStats,
  Persona,
  UpdateClustersInput,
  UpdateKeywordResearchInput,
  UpdatePersonasInput,
  UpdateUserPersonaInput
};

// Use the correct imported type for the alias
export type Keyword = KeywordVolumeItem;

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

// Define the possible states for the clustering process
// export type ClusteringStatus = 'pending' | 'processing' | 'completed' | 'failed' | null;

// --- Store Types (Adjusted for consistency) ---

export interface KeywordResearchState { // Renamed from PastResearchState
  researches: KeywordResearchListItem[]; // Use ListItem for potentially large lists
  selectedResearchId: string | null;
  selectedResearchDetail: KeywordResearchItem | null; // Use full Item for detail view
  isLoading: boolean;
  error: string | null;
}

export interface KeywordResearchActions { // Renamed from PastResearchActions
  fetchResearches: (filters?: KeywordResearchFilter) => Promise<void>; // Removed userId, Renamed, added optional filters
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