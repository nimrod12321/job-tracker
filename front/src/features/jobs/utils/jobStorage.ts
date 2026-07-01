import type { Job } from '../../../types/job'

const JOBS_STORAGE_KEY = 'ai-job-tracker-jobs'

export function loadJobsFromStorage(): Job[] | null {
  try {
    const storedJobs = localStorage.getItem(JOBS_STORAGE_KEY)

    if (!storedJobs) {
      return null
    }

    return JSON.parse(storedJobs) as Job[]
  } catch (error) {
    console.error('Failed to load jobs from local storage:', error)
    return null
  }
}

export function saveJobsToStorage(jobs: Job[]) {
  try {
    localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs))
  } catch (error) {
    console.error('Failed to save jobs to local storage:', error)
  }
}
