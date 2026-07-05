export type DiscoveryDecisionValue = 'liked' | 'disliked'

export type DiscoveryDecisionInput = {
  externalId: string
  jobUrl?: string
  company: string
  position: string
  location?: string
  source: string
  jobDescription?: string
  salaryText?: string
  estimatedSalary?: string
  summary?: string
  fitScore?: number
  fitReason?: string
  decision: DiscoveryDecisionValue
}

export type DiscoveryDecision = {
  id: string
  userId: string
  externalId: string
  jobUrl: string
  company: string
  position: string
  location: string
  source: string
  jobDescription: string
  salaryText: string
  estimatedSalary: string
  summary: string
  fitScore: number
  fitReason: string
  decision: DiscoveryDecisionValue
  createdAt: string
  updatedAt: string
}

export type DiscoveryFeedInput = {
  limit?: number
  excludeExternalIds?: string[]
}

export type DiscoveryJob = {
  externalId: string
  company: string
  position: string
  location: string
  source: string
  jobUrl: string
  companyUrl: string
  jobDescription: string
  summary: string
  keyDetails: string[]
  salaryText: string
  estimatedSalary: string
  salaryIsEstimated: boolean
  fitScore: number
  fitReason: string
  concerns: string[]
  priority: 'low' | 'medium' | 'high'
}
