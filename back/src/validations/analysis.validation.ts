import { z } from 'zod'

export const jobAnalysisResultSchema = z
  .object({
    matchScore: z.number().int().min(0).max(100),
    fitSummary: z.string().trim().min(1),
    strengths: z.string().trim().min(1),
    missingSkills: z.string().trim().min(1),
    resumeSuggestions: z.string().trim().min(1),
    interviewQuestions: z.string().trim().min(1),
    recruiterMessage: z.string().trim().min(1),
  })
  .strict()

export type JobAnalysisResult = z.infer<typeof jobAnalysisResultSchema>
