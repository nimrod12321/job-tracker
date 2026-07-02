import { useEffect, useState } from 'react';
import type { Job, JobStatus } from '../../../types/job';
import JobCard from '../components/JobCard';
import JobForm from '../components/JobForm';
import {
  createJob,
  deleteJob,
  getJobs,
  updateJob,
  updateJobStatus,
} from '../services/jobsApi';

function JobsPage() {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        const jobsFromApi = await getJobs();
        setJobs(jobsFromApi);
      } catch (error) {
        console.error(error);
        setError('Failed to load jobs');
      } finally {
        setIsLoading(false);
      }
    }

    loadJobs();
  }, []);

  async function handleSaveJob(savedJob: Job) {
    try {
      if (editingJob) {
        const updatedJob = await updateJob(savedJob);

        setJobs((currentJobs) =>
          currentJobs.map((job) =>
            job.id === updatedJob.id ? updatedJob : job,
          ),
        );
      } else {
        const createdJob = await createJob({
          company: savedJob.company,
          position: savedJob.position,
          status: savedJob.status,
          wantedSalary: savedJob.wantedSalary,
          location: savedJob.location,
          notes: savedJob.notes,
        });

        setJobs((currentJobs) => [createdJob, ...currentJobs]);
      }

      setEditingJob(null);
      setIsFormVisible(false);
    } catch (error) {
      console.error(error);
      setError('Failed to save job');
    }
  }

  async function handleDeleteJob(jobId: string) {
    const confirmed = window.confirm('Are you sure you want to delete this job?');

    if (!confirmed) {
      return;
    }

    try {
      await deleteJob(jobId);
      setJobs((currentJobs) =>
        currentJobs.filter((job) => job.id !== jobId),
      );
    } catch (error) {
      console.error(error);
      setError('Failed to delete job');
    }
  }

  function handleEditJob(job: Job) {
    setEditingJob(job);
    setIsFormVisible(true);
  }

  async function handleUpdateJobStatus(jobId: string, status: JobStatus) {
    try {
      const updatedJob = await updateJobStatus(jobId, status);

      setJobs((currentJobs) =>
        currentJobs.map((job) =>
          job.id === jobId ? updatedJob : job,
        ),
      );
    } catch (error) {
      console.error(error);
      setError('Failed to update job status');
    }
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

      {isFormVisible && (
        <JobForm onSaveJob={handleSaveJob} initialJob={editingJob} />
      )}

      {isLoading && <p>Loading jobs...</p>}
      {error && <p>{error}</p>}

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
