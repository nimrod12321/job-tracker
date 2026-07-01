import { useState, useEffect } from 'react';
import type { Job, JobStatus } from '../../../types/job';
import JobCard from '../components/JobCard';
import JobForm from '../components/JobForm';
import { mockJobs } from '../data/mockJobs';
import {
  loadJobsFromStorage,
  saveJobsToStorage,
} from '../utils/jobStorage'

function JobsPage() {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [jobs, setJobs] = useState<Job[]>(() => {
    const storedJobs = loadJobsFromStorage()

    return storedJobs ?? mockJobs
    })

  useEffect(() => {
  saveJobsToStorage(jobs)
}, [jobs])

function handleSaveJob(savedJob: Job) {
  if (editingJob) {
    setJobs((currentJobs) =>
      currentJobs.map((job) => (job.id === savedJob.id ? savedJob : job)),
    )
  } else {
    setJobs((currentJobs) => [savedJob, ...currentJobs])
  }

  setEditingJob(null)
  setIsFormVisible(false)
}

  function handleDeleteJob(jobId: string) {
    setJobs((currentJobs) => currentJobs.filter((job) => job.id !== jobId));
  }
  function handleEditJob(job: Job) {
    setEditingJob(job)
    setIsFormVisible(true)
  }

  function handleUpdateJobStatus(jobId: string, status: JobStatus) {
    setJobs((currentJobs) =>
      currentJobs.map((job) =>
        job.id === jobId ? { ...job, status } : job,
      ),
    );
  }

  const filteredJobs =
    statusFilter === 'all'
      ? jobs
      : jobs.filter((job) => job.status === statusFilter);

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Jobs</h1>
          <p>Manage your job applications and track their status.</p>
        </div>
        <button
          type="button"
          aria-expanded={isFormVisible}
          aria-controls="job-form"
          onClick={() => setIsFormVisible((isVisible) => !isVisible)}
        >
          {isFormVisible ? 'Cancel' : 'Add Job'}
        </button>
      </div>

      {isFormVisible && <JobForm onSaveJob={handleSaveJob} initialJob={editingJob} />}

      <div className="job-filter">
        <label htmlFor="status-filter">Filter by status</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as JobStatus | 'all')
          }
        >
          <option value="all">All statuses</option>
          <option value="applied">Applied</option>
          <option value="HR">HR</option>
          <option value="technical">Technical</option>
          <option value="offer">Offer</option>
          <option value="rejected">Rejected</option>
        </select>
        <span>
          {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
        </span>
      </div>

      <div className="job-grid">
        {filteredJobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            onDeleteJob={handleDeleteJob}
            onChangeStatus={handleUpdateJobStatus}
            onEditJob={handleEditJob}
          />
        ))}
      </div>
    </section>
  );
}

export default JobsPage;
