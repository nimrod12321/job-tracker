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

function truncateText(value: string, maxLength: number) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  const shortenedValue = normalizedValue.slice(0, maxLength);
  const lastSpace = shortenedValue.lastIndexOf(' ');

  return `${shortenedValue.slice(0, lastSpace > 80 ? lastSpace : maxLength)}…`;
}

function getJobSummary(jobDescription: string) {
  const normalizedDescription = jobDescription.replace(/\s+/g, ' ').trim();

  if (!normalizedDescription) {
    return 'No description yet';
  }

  const firstSentence = normalizedDescription.match(/^.*?[.!?](?:\s|$)/)?.[0];

  return truncateText(firstSentence || normalizedDescription, 160);
}

function getSalaryDisplay(job: Job) {
  if (job.salaryMin && job.salaryMax) {
    return `$${job.salaryMin.toLocaleString()} – $${job.salaryMax.toLocaleString()}`;
  }

  if (job.salaryMin) {
    return `From $${job.salaryMin.toLocaleString()}`;
  }

  if (job.salaryMax) {
    return `Up to $${job.salaryMax.toLocaleString()}`;
  }

  if (job.wantedSalary) {
    return `$${job.wantedSalary.toLocaleString()}`;
  }

  return 'Not listed';
}

function JobCard({ job, onDeleteJob, onChangeStatus, onEditJob }: JobCardProps) {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const salaryDisplay = getSalaryDisplay(job);
  const jobSummary = getJobSummary(job.jobDescription);

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div>
          <p className="job-card-company">{job.company}</p>
          <h2>{job.position}</h2>
        </div>
        <div className="job-card-badges">
          <span className={`priority-badge priority-${job.priority}`}>
            {job.priority}
          </span>
          {isEditingStatus ? (
            <select
              className="job-status-select"
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
        </div>
      </div>

      <div className="job-card-meta">
        <span>{job.location || 'Location not listed'}</span>
        {job.source && <span>Source: {job.source}</span>}
        {job.dateApplied && (
          <time dateTime={job.dateApplied}>Applied {job.dateApplied}</time>
        )}
      </div>

      <p className="job-card-summary">{jobSummary}</p>

      <p className="job-card-salary">
        <span>Salary</span>
        <strong>{salaryDisplay}</strong>
      </p>

      {job.matchScore !== undefined && (
        <div className="job-card-match">
          <strong>{job.matchScore}% match</strong>
          {job.matchSummary && (
            <span>{truncateText(job.matchSummary, 140)}</span>
          )}
        </div>
      )}

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
