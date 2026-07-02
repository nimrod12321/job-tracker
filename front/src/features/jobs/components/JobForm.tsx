import { useState, type FormEvent } from 'react';
import type { Job, JobStatus } from '../../../types/job';

type JobFormProps = {
  initialJob?: Job | null
  onSaveJob: (job: Job) => void
}

const statusOptions: JobStatus[] = [
  'applied',
  'HR',
  'technical',
  'rejected',
  'offer',
];

function JobForm({ initialJob, onSaveJob }: JobFormProps) {
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
    };

    onSaveJob(savedJob);
  }

  return (
    <form id="job-form" className="job-form" onSubmit={handleSubmit}>
      <h2>{initialJob ? 'Edit Job' : 'Add New Job'}</h2>
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
        Wanted salary
        <input
          type="number"
          value={wantedSalary}
          onChange={(event) => setWantedSalary(Number(event.target.value))}
          required
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
        Notes
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <button type="submit">
        {initialJob ? 'Save Changes' : 'Save Job'}
      </button>
    </form>
  );
}

export default JobForm;
