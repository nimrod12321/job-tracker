import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import AdminShell from '../components/AdminShell'
import {
  getAdminCandidates,
  updateAdminRestaurantLeadStatus,
} from '../services/adminApi'
import type {
  AdminCandidate,
  AdminCandidateSource,
  AdminCandidateStatus,
  CandidateLeadStatus,
} from '../types/admin'

const qrStatuses: CandidateLeadStatus[] = [
  'new',
  'contacted',
  'relevant',
  'rejected',
]

const statusLabels: Record<AdminCandidateStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  relevant: 'Relevant',
  rejected: 'Rejected',
  applied: 'Applied',
  selected: 'Selected',
}

type StatusFilter = AdminCandidateStatus | 'all' | 'attention'

function needsAttention(candidate: AdminCandidate) {
  if (candidate.source === 'qr') {
    return candidate.ownerViewState === 'unviewed' || candidate.status === 'new'
  }

  return candidate.status === 'applied'
}

function AdminLeadsPage() {
  const [searchParams] = useSearchParams()
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<AdminCandidateSource | 'all'>(
    'all',
  )
  const [restaurantQuery, setRestaurantQuery] = useState(
    searchParams.get('restaurant') ?? '',
  )
  const [roleFilter, setRoleFilter] = useState<RestaurantRole | 'all'>('all')
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null)
  const pendingCandidateIds = useRef(new Set<string>())

  const isForbidden = error?.toLowerCase().includes('admin access required')
  const filteredCandidates = useMemo(() => {
    const normalizedRestaurantQuery = restaurantQuery.trim().toLowerCase()

    return candidates
      .filter((candidate) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'attention'
            ? needsAttention(candidate)
            : candidate.status === statusFilter)
        const matchesSource =
          sourceFilter === 'all' || candidate.source === sourceFilter
        const matchesRestaurant =
          !normalizedRestaurantQuery ||
          `${candidate.restaurant.restaurantName} ${candidate.restaurant.city} ${candidate.restaurant.street} ${candidate.restaurant.id}`
            .toLowerCase()
            .includes(normalizedRestaurantQuery)
        const matchesRole =
          roleFilter === 'all' || candidate.roles.includes(roleFilter)

        return matchesStatus && matchesSource && matchesRestaurant && matchesRole
      })
      .sort((first, second) => {
        const attentionDifference =
          Number(needsAttention(second)) - Number(needsAttention(first))

        if (attentionDifference !== 0) {
          return attentionDifference
        }

        return (
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime()
        )
      })
  }, [candidates, restaurantQuery, roleFilter, sourceFilter, statusFilter])
  const stats = useMemo(
    () => ({
      total: candidates.length,
      attention: candidates.filter(needsAttention).length,
      qr: candidates.filter((candidate) => candidate.source === 'qr').length,
      jobBoard: candidates.filter(
        (candidate) => candidate.source === 'jobBoard',
      ).length,
      ownerUnviewed: candidates.filter(
        (candidate) => candidate.ownerViewState === 'unviewed',
      ).length,
    }),
    [candidates],
  )

  useEffect(() => {
    let isActive = true

    async function loadCandidates() {
      try {
        const nextCandidates = await getAdminCandidates()

        if (isActive) {
          setCandidates(nextCandidates)
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load candidates',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadCandidates()

    return () => {
      isActive = false
    }
  }, [])

  async function handleStatusChange(
    candidate: AdminCandidate,
    status: CandidateLeadStatus,
  ) {
    if (
      candidate.source !== 'qr' ||
      pendingCandidateIds.current.has(candidate.id) ||
      candidate.status === status
    ) {
      return
    }

    pendingCandidateIds.current.add(candidate.id)
    setBusyCandidateId(candidate.id)
    setError(null)
    setCandidates((currentCandidates) =>
      currentCandidates.map((currentCandidate) =>
        currentCandidate.id === candidate.id
          ? { ...currentCandidate, status }
          : currentCandidate,
      ),
    )

    try {
      const updatedLead = await updateAdminRestaurantLeadStatus(
        candidate.id,
        status,
      )

      setCandidates((currentCandidates) =>
        currentCandidates.map((currentCandidate) =>
          currentCandidate.id === updatedLead.id
            ? {
                ...currentCandidate,
                status: updatedLead.status,
                updatedAt: updatedLead.updatedAt,
                ownerViewedAt: updatedLead.ownerViewedAt,
                ownerViewState: updatedLead.ownerViewedAt
                  ? 'viewed'
                  : 'unviewed',
              }
            : currentCandidate,
        ),
      )
    } catch (updateError) {
      setCandidates((currentCandidates) =>
        currentCandidates.map((currentCandidate) =>
          currentCandidate.id === candidate.id ? candidate : currentCandidate,
        ),
      )
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Failed to update candidate',
      )
    } finally {
      pendingCandidateIds.current.delete(candidate.id)
      setBusyCandidateId(null)
    }
  }

  if (isLoading) {
    return (
      <AdminShell>
        <p className="status-message">Loading candidates...</p>
      </AdminShell>
    )
  }

  if (isForbidden) {
    return (
      <section className="admin-forbidden-page">
        <div className="admin-forbidden-card">
          <h1>Admin access required</h1>
          <p>This page is only available to admin users.</p>
        </div>
      </section>
    )
  }

  return (
    <AdminShell>
      <section className="admin-leads-page admin-candidates-page">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">Operations</p>
            <h1>Candidates</h1>
            <p>External/QR candidates and Job Board applications across restaurants.</p>
          </div>
          <span>{stats.attention} need attention</span>
        </header>

        <div className="admin-stat-grid admin-candidate-stat-grid" aria-label="Candidate summary">
          <StatCard label="Total applications" value={stats.total} />
          <StatCard label="Needs attention" value={stats.attention} />
          <StatCard label="External / QR" value={stats.qr} />
          <StatCard label="Job Board" value={stats.jobBoard} />
          <StatCard label="Not yet in owner list" value={stats.ownerUnviewed} />
        </div>

        <div className="admin-leads-toolbar admin-candidate-toolbar">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="all">All statuses</option>
              <option value="attention">New / needs attention</option>
              <option value="new">New (external / QR)</option>
              <option value="contacted">Contacted</option>
              <option value="relevant">Relevant</option>
              <option value="applied">Applied (Job Board)</option>
              <option value="selected">Selected (Job Board)</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <label>
            Source
            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value as AdminCandidateSource | 'all',
                )
              }
            >
              <option value="all">All sources</option>
              <option value="qr">External / QR</option>
              <option value="jobBoard">Job Board / swipe</option>
            </select>
          </label>
          <label>
            Restaurant
            <input
              value={restaurantQuery}
              onChange={(event) => setRestaurantQuery(event.target.value)}
              placeholder="Search restaurant or city"
            />
          </label>
          <label>
            Role
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as RestaurantRole | 'all')
              }
            >
              <option value="all">All roles</option>
              {RESTAURANT_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        {candidates.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>No candidates yet</h2>
            <p>External/QR and Job Board applications will appear here.</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>No candidates match these filters</h2>
            <p>Try changing the status, source, restaurant, or role.</p>
          </div>
        ) : (
          <div className="admin-leads-list">
            {filteredCandidates.map((candidate) => (
              <CandidateCard
                busy={busyCandidateId === candidate.id}
                candidate={candidate}
                key={`${candidate.source}-${candidate.id}`}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  )
}

function CandidateCard({
  candidate,
  busy,
  onStatusChange,
}: {
  candidate: AdminCandidate
  busy: boolean
  onStatusChange: (
    candidate: AdminCandidate,
    status: CandidateLeadStatus,
  ) => Promise<void>
}) {
  const whatsappNumber = candidate.phoneNumber.replace(/\D/g, '')
  const restaurantLocation =
    [candidate.restaurant.city, candidate.restaurant.street]
      .filter(Boolean)
      .join(' · ') || 'Not provided'
  const viewLabel =
    candidate.ownerViewState === 'viewed'
      ? 'Seen in owner list'
      : candidate.ownerViewState === 'unviewed'
        ? 'Waiting for restaurant'
        : 'Owner view not tracked'

  return (
    <article
      className={`admin-lead-card admin-candidate-card${needsAttention(candidate) ? ' needs-attention' : ''}`}
    >
      <div className="admin-lead-header">
        <div>
          <h2>{candidate.fullName || 'Candidate'}</h2>
          <p>
            <Link to={`/admin/restaurants/${candidate.restaurant.id}`}>
              {candidate.restaurant.restaurantName}
            </Link>
          </p>
        </div>
        <div className="admin-lead-badges">
          <span className={`admin-source-badge ${candidate.source}`}>
            {candidate.source === 'qr' ? 'External / QR' : 'Job Board'}
          </span>
          <span className={`admin-status-badge ${candidate.status}`}>
            {statusLabels[candidate.status]}
          </span>
          <span className={`admin-view-badge ${candidate.ownerViewState}`}>
            {viewLabel}
          </span>
        </div>
      </div>

      <dl className="admin-lead-details">
        <div>
          <dt>Role</dt>
          <dd>
            {candidate.roles.map((role) => getRestaurantRoleLabel(role)).join(', ')}
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{candidate.source === 'qr' ? 'Public hiring page' : 'Job Board / swipe'}</dd>
        </div>
        <div>
          <dt>Applied</dt>
          <dd>{new Date(candidate.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{restaurantLocation}</dd>
        </div>
        {candidate.phoneNumber && (
          <div>
            <dt>Phone</dt>
            <dd>{candidate.phoneNumber}</dd>
          </div>
        )}
        {candidate.age !== null && (
          <div>
            <dt>Age</dt>
            <dd>{candidate.age}</dd>
          </div>
        )}
      </dl>

      {(candidate.experienceText || candidate.availability) && (
        <div className="admin-candidate-notes">
          {candidate.experienceText && (
            <div className="admin-lead-section">
              <strong>Experience</strong>
              <p>{candidate.experienceText}</p>
            </div>
          )}
          {candidate.availability && (
            <div className="admin-lead-section">
              <strong>Availability</strong>
              <p>{candidate.availability}</p>
            </div>
          )}
        </div>
      )}

      <div className="admin-candidate-card-footer">
        <div className="admin-actions">
          {candidate.phoneNumber && <a href={`tel:${candidate.phoneNumber}`}>Call</a>}
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          )}
          <Link to={`/admin/restaurants/${candidate.restaurant.id}`}>
            Restaurant detail
          </Link>
        </div>

        {candidate.source === 'qr' ? (
          <label className="admin-inline-status-control">
            <span>Status</span>
            <select
              aria-label={`Status for ${candidate.fullName || 'candidate'}`}
              value={candidate.status}
              disabled={busy}
              onChange={(event) =>
                void onStatusChange(
                  candidate,
                  event.target.value as CandidateLeadStatus,
                )
              }
            >
              {qrStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <small className="admin-data-note">
            Owner-view tracking is not available for Job Board applications.
          </small>
        )}
      </div>
    </article>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="admin-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export default AdminLeadsPage
