import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  JobListItem,
  JobStatus,
} from '../../../types/job'
import { getJobs } from '../../jobs/services/jobsApi'

const statusCards: Array<{ status: JobStatus; label: string }> = [
  { status: 'applied', label: 'Applied' },
  { status: 'HR', label: 'HR' },
  { status: 'technical', label: 'Technical' },
  { status: 'rejected', label: 'Rejected' },
  { status: 'offer', label: 'Offer' },
]

type StatCardProps = {
  label: string
  value: number | string
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <article className="dashboard-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function DashboardPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadJobs() {
      try {
        const loadedJobs = await getJobs()

        if (isActive) {
          setJobs(loadedJobs)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load dashboard',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadJobs()

    return () => {
      isActive = false
    }
  }, [])

  if (isLoading) {
    return <p>Loading dashboard...</p>
  }

  if (error) {
    return (
      <section className="dashboard-page">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Your job search at a glance.</p>
          </div>
        </div>
        <p className="dashboard-error">{error}</p>
      </section>
    )
  }

  if (jobs.length === 0) {
    return (
      <section className="dashboard-page">
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Your job search at a glance.</p>
          </div>
        </div>

        <div className="dashboard-empty">
          <h2>No jobs yet.</h2>
          <p>Add your first job to start tracking your search.</p>
          <Link to="/jobs">Add your first job</Link>
        </div>
      </section>
    )
  }

  const statusCounts: Record<JobStatus, number> = {
    applied: 0,
    HR: 0,
    technical: 0,
    rejected: 0,
    offer: 0,
  }

  for (const job of jobs) {
    statusCounts[job.status] += 1
  }

  const highPriorityCount = jobs.filter(
    (job) => job.priority === 'high',
  ).length
  const analyzedCount = jobs.filter((job) => job.hasAnalysis).length
  const salaries = jobs
    .map((job) => job.wantedSalary)
    .filter((salary) => salary > 0)
  const averageSalary =
    salaries.length > 0
      ? Math.round(
          salaries.reduce((total, salary) => total + salary, 0) /
            salaries.length,
        ).toLocaleString()
      : 'No salary data'
  const recentJobs = jobs.slice(0, 5)

  return (
    <section className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your job search at a glance.</p>
        </div>
      </div>

      <div className="dashboard-stats">
        <StatCard label="Total jobs" value={jobs.length} />
        {statusCards.map(({ status, label }) => (
          <StatCard
            key={status}
            label={label}
            value={statusCounts[status]}
          />
        ))}
        <StatCard label="High priority jobs" value={highPriorityCount} />
        <StatCard label="AI analyzed jobs" value={analyzedCount} />
        <StatCard label="Average wanted salary" value={averageSalary} />
      </div>

      <section className="dashboard-recent">
        <div className="dashboard-section-header">
          <div>
            <h2>Recently added jobs</h2>
            <p>Your five most recent opportunities.</p>
          </div>
          <Link to="/jobs">View all jobs</Link>
        </div>

        <div className="dashboard-recent-list">
          {recentJobs.map((job) => (
            <Link
              className="dashboard-recent-job"
              key={job.id}
              to={`/jobs/${job.id}`}
            >
              <div>
                <strong>{job.position}</strong>
                <span>{job.company}</span>
              </div>
              <div className="dashboard-recent-meta">
                <span>{job.status}</span>
                <span>{job.priority} priority</span>
                <time>{job.dateApplied || job.createdAt}</time>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}

export default DashboardPage
