import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  RESTAURANT_ROLES,
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import AdminShell from '../components/AdminShell'
import {
  getAdminRestaurantLeads,
  updateAdminRestaurantLeadStatus,
} from '../services/adminApi'
import type {
  AdminRestaurantCandidateLead,
  CandidateLeadStatus,
} from '../types/admin'

const statuses: CandidateLeadStatus[] = [
  'new',
  'contacted',
  'relevant',
  'rejected',
]

const statusLabels: Record<CandidateLeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  relevant: 'Relevant',
  rejected: 'Rejected',
}

function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminRestaurantCandidateLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<CandidateLeadStatus | 'all'>(
    'all',
  )
  const [restaurantQuery, setRestaurantQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RestaurantRole | 'all'>('all')
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const pendingLeadIds = useRef(new Set<string>())

  const isForbidden = error?.toLowerCase().includes('admin access required')
  const filteredLeads = useMemo(() => {
    const normalizedRestaurantQuery = restaurantQuery.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === 'all' || lead.status === statusFilter
      const matchesRestaurant =
        !normalizedRestaurantQuery ||
        `${lead.restaurant.restaurantName} ${lead.restaurant.city} ${lead.restaurant.street}`
          .toLowerCase()
          .includes(normalizedRestaurantQuery)
      const matchesRole =
        roleFilter === 'all' || lead.wantedRoles.includes(roleFilter)

      return matchesStatus && matchesRestaurant && matchesRole
    })
  }, [leads, restaurantQuery, roleFilter, statusFilter])
  const stats = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === 'new').length,
      contacted: leads.filter((lead) => lead.status === 'contacted').length,
      relevant: leads.filter((lead) => lead.status === 'relevant').length,
      rejected: leads.filter((lead) => lead.status === 'rejected').length,
    }),
    [leads],
  )

  useEffect(() => {
    let isActive = true

    async function loadLeads() {
      try {
        const nextLeads = await getAdminRestaurantLeads()

        if (isActive) {
          setLeads(nextLeads)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load restaurant leads',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadLeads()

    return () => {
      isActive = false
    }
  }, [])

  async function handleStatusChange(
    lead: AdminRestaurantCandidateLead,
    status: CandidateLeadStatus,
  ) {
    if (pendingLeadIds.current.has(lead.id) || lead.status === status) {
      return
    }

    pendingLeadIds.current.add(lead.id)
    setBusyLeadId(lead.id)
    setError(null)
    setLeads((currentLeads) =>
      currentLeads.map((currentLead) =>
        currentLead.id === lead.id ? { ...currentLead, status } : currentLead,
      ),
    )

    try {
      const updatedLead = await updateAdminRestaurantLeadStatus(lead.id, status)

      setLeads((currentLeads) =>
        currentLeads.map((currentLead) =>
          currentLead.id === updatedLead.id ? updatedLead : currentLead,
        ),
      )
    } catch (error) {
      setLeads((currentLeads) =>
        currentLeads.map((currentLead) =>
          currentLead.id === lead.id ? lead : currentLead,
        ),
      )
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update restaurant lead',
      )
    } finally {
      pendingLeadIds.current.delete(lead.id)
      setBusyLeadId(null)
    }
  }

  if (isLoading) {
    return (
      <AdminShell>
        <p className="status-message">Loading restaurant leads...</p>
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
      <section className="admin-leads-page">
        <div className="admin-page-heading">
          <div>
            <h1>QR Leads</h1>
            <p>All candidates who applied through restaurant QR links.</p>
          </div>
          <span>More statistics coming later.</span>
        </div>

        <div className="admin-stat-grid" aria-label="QR lead stats">
          <StatCard label="Total leads" value={stats.total} />
          <StatCard label="New" value={stats.new} />
          <StatCard label="Contacted" value={stats.contacted} />
          <StatCard label="Relevant" value={stats.relevant} />
          <StatCard label="Rejected" value={stats.rejected} />
        </div>

        <div className="admin-leads-toolbar">
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as CandidateLeadStatus | 'all',
                )
              }
            >
              <option value="all">All</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
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

        {leads.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>No QR leads yet</h2>
            <p>
              When candidates apply through restaurant QR codes, they will
              appear here.
            </p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>No leads match these filters</h2>
            <p>Try changing the status, restaurant, or role filter.</p>
          </div>
        ) : (
          <div className="admin-leads-list">
            {filteredLeads.map((lead) => {
            const whatsappNumber = lead.phoneNumber.replace(/\D/g, '')
            const restaurantLocation =
              [lead.restaurant.city, lead.restaurant.street]
                .filter(Boolean)
                .join(' · ') || 'Not provided'

            return (
              <article className="admin-lead-card" key={lead.id}>
                <div className="admin-lead-header">
                  <div>
                    <h2>{lead.fullName}</h2>
                    <p>
                      Applied via QR to:{' '}
                      <strong>{lead.restaurant.restaurantName}</strong>
                    </p>
                  </div>
                  <div className="admin-lead-badges">
                    <span className="admin-source-badge">QR</span>
                    <span className={`admin-status-badge ${lead.status}`}>
                      {statusLabels[lead.status]}
                    </span>
                  </div>
                </div>

                <dl className="admin-lead-details">
                  <div>
                    <dt>Restaurant</dt>
                    <dd>{lead.restaurant.restaurantName}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{restaurantLocation}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{lead.phoneNumber}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{new Date(lead.createdAt).toLocaleDateString()}</dd>
                  </div>
                  {lead.age !== null && (
                    <div>
                      <dt>Age</dt>
                      <dd>{lead.age}</dd>
                    </div>
                  )}
                </dl>

                <div className="admin-lead-section">
                  <strong>Interested in</strong>
                  <p>
                    {lead.wantedRoles
                      .map((role) => getRestaurantRoleLabel(role))
                      .join(', ')}
                  </p>
                </div>
                <div className="admin-lead-section">
                  <strong>Experience</strong>
                  <p>{lead.experienceText || 'Not provided'}</p>
                </div>
                <div className="admin-lead-section">
                  <strong>Availability</strong>
                  <p>{lead.availability || 'Not provided'}</p>
                </div>
                <div className="admin-actions">
                  <a href={`tel:${lead.phoneNumber}`}>Call</a>
                  {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                <div className="admin-status-actions">
                  <label className="admin-inline-status-control">
                    <span>Status</span>
                    <select
                      aria-label={`Status for ${lead.fullName || 'candidate'}`}
                      value={lead.status}
                      disabled={busyLeadId === lead.id}
                      onChange={(event) =>
                        void handleStatusChange(
                          lead,
                          event.target.value as CandidateLeadStatus,
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option
                          disabled={status === lead.status}
                          key={status}
                          value={status}
                        >
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            )
            })}
          </div>
        )}
      </section>
    </AdminShell>
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
