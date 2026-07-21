import { useState, type FormEvent } from 'react';
import type { Job, JobPriority, JobStatus } from '../../../types/job';

type JobFormProps = {
  initialJob?: Job | null
  onSaveJob: (job: Job) => void
  heading?: string
  submitLabel?: string
}

const statusOptions: JobStatus[] = [
  'applied',
  'HR',
  'technical',
  'rejected',
  'offer',
];

const priorityOptions: JobPriority[] = ['low', 'medium', 'high'];

function JobForm({
  initialJob,
  onSaveJob,
  heading,
  submitLabel,
}: JobFormProps) {
  const [company, setCompany] = useState(initialJob?.company ?? '')
  const [position, setPosition] = useState(initialJob?.position ?? '')
  const [status, setStatus] = useState<JobStatus>(
    initialJob?.status ?? 'applied',
  )
  const [wantedSalary, setWantedSalary] = useState(
    initialJob?.wantedSalary ? Number(initialJob.wantedSalary) : '',
  )
  const [location, setLocation] = useState(initialJob?.location ?? '')
  const [notes, setNotes] = useState(initialJob?.notes ?? '')
  const [jobDescription, setJobDescription] = useState(
    initialJob?.jobDescription ?? '',
  )
  const [jobUrl, setJobUrl] = useState(initialJob?.jobUrl ?? '')
  const [companyUrl, setCompanyUrl] = useState(initialJob?.companyUrl ?? '')
  const [source, setSource] = useState(initialJob?.source ?? '')
  const [priority, setPriority] = useState<JobPriority>(
    initialJob?.priority ?? 'medium',
  )
  const [dateApplied, setDateApplied] = useState(initialJob?.dateApplied ?? '')
  const [salaryMin, setSalaryMin] = useState<number | ''>(
    initialJob?.salaryMin || '',
  )
  const [salaryMax, setSalaryMax] = useState<number | ''>(
    initialJob?.salaryMax || '',
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const today = new Date().toISOString().slice(0, 10);

    const savedJob: Job = {
      id: initialJob?.id ?? crypto.randomUUID(),
      company,
      position,
      status,
      wantedSalary: Number(wantedSalary),
      location,
      createdAt: initialJob?.createdAt ?? today,
      updatedAt: today,
      notes,
      jobDescription,
      jobUrl,
      companyUrl,
      source,
      priority,
      dateApplied,
      salaryMin: Number(salaryMin) || 0,
      salaryMax: Number(salaryMax) || 0,
    };

    onSaveJob(savedJob);
  }

  return (
    <form id="job-form" className="job-form" onSubmit={handleSubmit}>
      <h2>{heading ?? (initialJob ? 'Edit job' : 'Add job')}</h2>
      <label>
        Company
        <input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          required
        />
      </label>
      <label>
        Position
        <input
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          required
        />
      </label>
      <label>
        Status
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as JobStatus)}
        >
          {statusOptions.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusOption}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as JobPriority)
          }
        >
          {priorityOptions.map((priorityOption) => (
            <option key={priorityOption} value={priorityOption}>
              {priorityOption}
            </option>
          ))}
        </select>
      </label>
      <label>
        Wanted salary
        <input
          type="number"
          value={wantedSalary}
          onChange={(event) => setWantedSalary(Number(event.target.value))}
          required
        />
      </label>
      <label>
        Source
        <input
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
      </label>
      <label>
        Location
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          required
        />
      </label>
      <label>
        Date applied
        <input
          type="date"
          value={dateApplied}
          onChange={(event) => setDateApplied(event.target.value)}
        />
      </label>
      <label>
        Salary minimum
        <input
          type="number"
          value={salaryMin}
          onChange={(event) =>
            setSalaryMin(
              event.target.value === '' ? '' : Number(event.target.value),
            )
          }
        />
      </label>
      <label>
        Salary maximum
        <input
          type="number"
          value={salaryMax}
          onChange={(event) =>
            setSalaryMax(
              event.target.value === '' ? '' : Number(event.target.value),
            )
          }
        />
      </label>
      <label>
        Job URL
        <input
          value={jobUrl}
          onChange={(event) => setJobUrl(event.target.value)}
        />
      </label>
      <label>
        Company URL
        <input
          value={companyUrl}
          onChange={(event) => setCompanyUrl(event.target.value)}
        />
      </label>
      <label className="job-form-wide">
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <label className="job-form-wide">
        Job description
        <textarea
          rows={8}
          value={jobDescription}
          onChange={(event) => setJobDescription(event.target.value)}
        />
      </label>
      <button className="ui-button ui-button--primary" type="submit">
        {submitLabel ?? (initialJob ? 'Save changes' : 'Save job')}
      </button>
    </form>
  );
}

export default JobForm;
