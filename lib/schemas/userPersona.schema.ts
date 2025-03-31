import { z } from "zod";

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

// 新增：用於歷史記錄的用戶畫像類型
export const HistoryUserPersonaSchema = z.object({
  personas: z.array(UserPersonaSchema),
  lastUpdated: z.date(),
});

export type HistoryUserPersona = z.infer<typeof HistoryUserPersonaSchema>; 