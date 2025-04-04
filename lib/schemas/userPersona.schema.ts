import { z } from "zod";
import { firestoreTimestampSchema as TimestampSchema } from "./common.schema";

export const UserPersonaSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()),
  characteristics: z.array(z.string()),
  interests: z.array(z.string()),
  painPoints: z.array(z.string()),
  goals: z.array(z.string()),
});

export const UserPersonaResponseSchema = z.object({
  personas: z.array(UserPersonaSchema),
  metadata: z.object({
    totalKeywords: z.number(),
    totalPersonas: z.number(),
    processingTime: z.number(),
  }),
});

export type UserPersona = z.infer<typeof UserPersonaSchema>;
export type UserPersonaResponse = z.infer<typeof UserPersonaResponseSchema>;

// Renamed from HistoryUserPersonaSchema
export const KeywordResearchUserPersonaSchema = z.object({
  id: z.string(),
  persona: z.string().min(10, "用戶畫像描述過短"),
  createdAt: TimestampSchema.default(() => new Date()),
});

// Renamed from HistoryUserPersona
export type KeywordResearchUserPersona = z.infer<typeof KeywordResearchUserPersonaSchema>; 