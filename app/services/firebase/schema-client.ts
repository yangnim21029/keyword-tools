import { z } from 'zod';
// Import necessary shared schemas from the main schema file
import { 
    keywordVolumeItemSchema, 
    ClusterItemSchema 
} from './schema'; // Assuming schema.ts is in the same directory

// --- Client-Specific Schema ---

/**
 * Schema for the data structure expected by the KeywordResearchDetail client component.
 * This defines the shape after server-side processing (e.g., date conversion, cluster processing).
 */
export const KeywordResearchClientSchema = z.object({
  id: z.string(),
  query: z.string(),
  createdAt: z.date(), // Expect Date object on the client
  updatedAt: z.date(), // Expect Date object on the client
  keywords: z.array(keywordVolumeItemSchema), // Use the imported schema
  clusters: z.array(ClusterItemSchema).nullable(), // Use the imported schema, allow null
  searchEngine: z.string().optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  device: z.enum(['desktop', 'mobile']).optional(),
  isFavorite: z.boolean(),
  tags: z.array(z.string()),
  clusteringStatus: z.string().optional()
});

// Export the inferred type for client-side usage
export type KeywordResearchClientData = z.infer<typeof KeywordResearchClientSchema>;

// --- Removed Duplicated Schemas --- 
// (firestoreTimestampSchema, UserPersonaSchema, ClusterSchema, etc. were removed)
