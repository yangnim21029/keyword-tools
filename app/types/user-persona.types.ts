import {
  HistoryUserPersonaSchema,
  UserPersonaResponseSchema,
  UserPersonaSchema,
} from '@/lib/schemas/userPersona.schema';
import { z } from 'zod';

/**
 * User Persona structure derived from schema.
 */
export type UserPersona = z.infer<typeof UserPersonaSchema>;

/**
 * API response structure for User Personas, derived from schema.
 */
export type UserPersonaResponse = z.infer<typeof UserPersonaResponseSchema>;

/**
 * Structure for storing User Personas in history, derived from schema.
 */
export type HistoryUserPersona = z.infer<typeof HistoryUserPersonaSchema>; 