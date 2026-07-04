export type JobStatus =
  | 'applied'
  | 'HR'
  | 'technical'
  | 'rejected'
  | 'offer'

export type JobPriority = 'low' | 'medium' | 'high'

export type Job = {
  id: string
  company: string
  position: string
  status: JobStatus
  wantedSalary: number
  location: string
  notes: string
  jobDescription: string
  jobUrl: string
  companyUrl: string
  source: string
  priority: JobPriority
  dateApplied: string
  salaryMin: number
  salaryMax: number
  createdAt: string
  updatedAt: string
}

export type JobListItem = Job & {
  hasAnalysis: boolean
}

export type JobAnalysis = {
  id: string
  matchScore: number
  fitSummary: string
  strengths: string
  missingSkills: string
  resumeSuggestions: string
  interviewQuestions: string
  recruiterMessage: string
  createdAt: string
  updatedAt: string
}

export type JobDetail = Job & {
  analysis: JobAnalysis | null
}
