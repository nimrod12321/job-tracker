export type ResumeProfile = {
  id: string
  fullName: string
  targetRole: string
  location: string
  salaryExpectation: number
  skills: string
  experienceText: string
  resumeText: string
  createdAt: string
  updatedAt: string
}

export type ResumeProfileInput = Omit<
  ResumeProfile,
  'id' | 'createdAt' | 'updatedAt'
>
