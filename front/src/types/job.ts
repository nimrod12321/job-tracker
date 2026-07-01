export type JobStatus = 'applied' | 'HR' | 'technical' | 'offer' | 'rejected';

export type Job = {
  id: string;
  company: string;
  position: string;
  status: JobStatus;
  wantedSalary: number;
  location: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
};
