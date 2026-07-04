export type JobStatus = 'applied' | 'HR' | 'technical' | 'offer' | 'rejected';
export type JobPriority = 'low' | 'medium' | 'high';

export type Job = {
  id: string;
  company: string;
  position: string;
  status: JobStatus;
  wantedSalary: number;
  location: string;
  notes: string;
  jobDescription: string;
  jobUrl: string;
  companyUrl: string;
  source: string;
  priority: JobPriority;
  dateApplied: string;
  salaryMin: number;
  salaryMax: number;
  createdAt: string;
  updatedAt: string;
};
