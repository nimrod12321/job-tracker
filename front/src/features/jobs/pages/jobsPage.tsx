import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Job, JobStatus } from '../../../types/job';
import ExternalJobsPanel from '../components/ExternalJobsPanel';
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadJobs() {
      try {
        const jobsFromApi = await getJobs();
        setJobs(jobsFromApi);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Failed to load jobs',
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadJobs();
  }, []);

  async function handleSaveJob(savedJob: Job) {
    setError(null);
    setSuccessMessage(null);

    try {
      if (editingJob) {
        const updatedJob = await updateJob(savedJob);

        setJobs((currentJobs) =>
          currentJobs.map((job) =>
            job.id === updatedJob.id
              ? { ...job, ...updatedJob }
              : job,
          ),
        );
        setSuccessMessage('Job updated successfully.');
      } else {
        const createdJob = await createJob({
          company: savedJob.company,
          position: savedJob.position,
          status: savedJob.status,
          wantedSalary: savedJob.wantedSalary,
          location: savedJob.location,
          notes: savedJob.notes,
          jobDescription: savedJob.jobDescription,
          jobUrl: savedJob.jobUrl,
          companyUrl: savedJob.companyUrl,
          source: savedJob.source,
          priority: savedJob.priority,
          dateApplied: savedJob.dateApplied,
          salaryMin: savedJob.salaryMin,
          salaryMax: savedJob.salaryMax,
        });

        setJobs((currentJobs) => [createdJob, ...currentJobs]);
        setSuccessMessage('Job saved successfully.');
      }

      setEditingJob(null);
      setIsFormVisible(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to save job',
      );
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
      setError(
        error instanceof Error ? error.message : 'Failed to delete job',
      );
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
          job.id === jobId ? { ...job, ...updatedJob } : job,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update job status',
      );
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
          <p>Track applications, priorities, salaries, and AI analysis.</p>
        </div>
        <div className="page-header-actions">
          <Link className="secondary-action-link" to="/jobs/import">
            Import job
          </Link>
          <button
            className="ui-button ui-button--primary"
            type="button"
            aria-expanded={isFormVisible}
            aria-controls="job-form"
            onClick={() => setIsFormVisible((isVisible) => !isVisible)}
          >
            {isFormVisible ? 'Cancel' : 'Add job'}
          </button>
        </div>
      </div>

      <ExternalJobsPanel
        jobs={jobs}
        onJobSaved={(job) =>
          setJobs((currentJobs) => [job, ...currentJobs])
        }
      />

      {isFormVisible && (
        <JobForm onSaveJob={handleSaveJob} initialJob={editingJob} />
      )}

      {isLoading && <p className="status-message">Loading jobs...</p>}
      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="message message-success" aria-live="polite">
          {successMessage}
        </p>
      )}

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

      {!isLoading && jobs.length === 0 ? (
        <div className="empty-state">
          <h2>No jobs yet.</h2>
          <p>Add a job manually or import one from a pasted description.</p>
          <div className="empty-state-actions">
            <button
              className="ui-button ui-button--primary"
              type="button"
              onClick={() => setIsFormVisible(true)}
            >
              Add job
            </button>
            <Link className="secondary-action-link" to="/jobs/import">
              Import job
            </Link>
          </div>
        </div>
      ) : !isLoading && filteredJobs.length === 0 ? (
        <div className="empty-state empty-state-compact">
          <h2>No matching jobs.</h2>
          <p>Choose another status to see your other applications.</p>
        </div>
      ) : (
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
      )}
    </section>
  );
}

export default JobsPage;
