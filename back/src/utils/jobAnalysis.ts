import type { JobAnalysis as PrismaJobAnalysis } from '../generated/prisma/client.js'
import type { JobAnalysis as ApiJobAnalysis } from '../types/job.js'

export function mapJobAnalysisToResponse(
  analysis: PrismaJobAnalysis,
): ApiJobAnalysis {
  return {
    id: analysis.id,
    matchScore: analysis.matchScore,
    fitSummary: analysis.fitSummary,
    strengths: analysis.strengths,
    missingSkills: analysis.missingSkills,
    resumeSuggestions: analysis.resumeSuggestions,
    interviewQuestions: analysis.interviewQuestions,
    recruiterMessage: analysis.recruiterMessage,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  }
}
