export type JobStatus = 'applied' | 'HR' | 'technical' | 'rejected' | 'offer';
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
//# sourceMappingURL=job.d.ts.map