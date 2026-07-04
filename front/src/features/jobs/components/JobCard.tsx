import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Job, JobStatus } from '../../../types/job';

type JobCardProps = {
  job: Job;
  onDeleteJob: (jobId: string) => void;
  onChangeStatus: (jobId: string, status: JobStatus) => void;
  onEditJob: (job: Job) => void;
};

const statusOptions: JobStatus[] = [
  'applied',
  'HR',
  'technical',
  'rejected',
  'offer',
];

function getSalaryRange(job: Job) {
  if (job.salaryMin && job.salaryMax) {
    return `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`;
  }

  if (job.salaryMin) {
    return `From $${job.salaryMin.toLocaleString()}`;
  }

  if (job.salaryMax) {
    return `Up to $${job.salaryMax.toLocaleString()}`;
  }

  return '';
}

function JobCard({ job, onDeleteJob, onChangeStatus, onEditJob }: JobCardProps) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const salaryRange = getSalaryRange(job);

  return (
    <div className="job-card">
      <h2>{job.position} at {job.company}</h2>

      <p className="job-status">
        Status:{' '}
        {isEditingStatus ? (
          <select
            className="job-status-select"
            autoFocus
            value={job.status}
            aria-label={`Change status for ${job.position} at ${job.company}`}
            onBlur={() => setIsEditingStatus(false)}
            onChange={(event) => {
              onChangeStatus(job.id, event.target.value as JobStatus);
              setIsEditingStatus(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsEditingStatus(false);
              }
            }}
          >
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        ) : (
          <button
            className="job-status-button"
            type="button"
            aria-label={`Change status. Current status: ${job.status}`}
            onClick={() => setIsEditingStatus(true)}
          >
            {job.status}
          </button>
        )}
      </p>

      <p>Location: {job.location}</p>
      <p>Wanted Salary: ${job.wantedSalary}</p>
      <div className="job-card-extra">
        <span>
          Priority: <strong>{job.priority}</strong>
        </span>
        {job.source && <span>Source: {job.source}</span>}
        {salaryRange && <span>Salary range: {salaryRange}</span>}
        {job.dateApplied && (
          <span>
            Applied:{' '}
            <time dateTime={job.dateApplied}>{job.dateApplied}</time>
          </span>
        )}
      </div>
      <div className="job-card-dates">
        <span>
          Created <time dateTime={job.createdAt}>{job.createdAt}</time>
        </span>
        <span>
          Updated <time dateTime={job.updatedAt}>{job.updatedAt}</time>
        </span>
      </div>
      <p>Notes: {job.notes}</p>

      <div className="job-card-actions">
        <Link className="view-job-link" to={`/jobs/${job.id}`}>
          View details
        </Link>
        <button
          className="edit-job-button"
          type="button"
          onClick={() => onEditJob(job)}
        >
          Edit
        </button>
        <button
          className="delete-job-button"
          type="button"
          aria-label={`Delete ${job.position} at ${job.company}`}
          onClick={() => onDeleteJob(job.id)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="m6.5 7 .8 13h9.4l.8-13" />
            <path d="M10 11v5M14 11v5" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}

export default JobCard;
