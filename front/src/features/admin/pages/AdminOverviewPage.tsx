import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import { getAdminRestaurants } from '../services/adminApi'
import type { AdminRestaurant } from '../types/admin'

function AdminOverviewPage() {
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isForbidden = error?.toLowerCase().includes('admin access required')

  useEffect(() => {
    let isActive = true

    async function loadOverview() {
      try {
        const nextRestaurants = await getAdminRestaurants()

        if (isActive) {
          setRestaurants(nextRestaurants)
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load admin overview',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      isActive = false
    }
  }, [])

  const overview = useMemo(() => {
    const totalCandidates = restaurants.reduce(
      (total, restaurant) => total + restaurant.totalCandidatesCount,
      0,
    )
    const qrCandidates = restaurants.reduce(
      (total, restaurant) => total + restaurant.qrLeadsCount,
      0,
    )
    const jobApplications = restaurants.reduce(
      (total, restaurant) => total + restaurant.applicationsCount,
      0,
    )
    const ownerUnviewed = restaurants.reduce(
      (total, restaurant) =>
        total + restaurant.ownerUnviewedQrCandidates,
      0,
    )
    const statusTotals = restaurants.reduce(
      (totals, restaurant) => ({
        new: totals.new + restaurant.qrCandidateStatusCounts.new,
        contacted:
          totals.contacted + restaurant.qrCandidateStatusCounts.contacted,
        relevant: totals.relevant + restaurant.qrCandidateStatusCounts.relevant,
        rejected: totals.rejected + restaurant.qrCandidateStatusCounts.rejected,
      }),
      { new: 0, contacted: 0, relevant: 0, rejected: 0 },
    )
    const funnel = restaurants.reduce(
      (totals, restaurant) => ({
        pageViews: totals.pageViews + restaurant.funnelMetrics.qrScans,
        formStarted:
          totals.formStarted + restaurant.funnelMetrics.startedForms,
        completed:
          totals.completed + restaurant.funnelMetrics.completedForms,
        ownerListViewed:
          totals.ownerListViewed +
          restaurant.funnelMetrics.ownerViewedCompletedForms,
      }),
      { pageViews: 0, formStarted: 0, completed: 0, ownerListViewed: 0 },
    )
    const needsAttention = restaurants
      .map((restaurant) => {
        const facts: string[] = []

        if (restaurant.ownerUnviewedQrCandidates > 0) {
          facts.push(
            `${restaurant.ownerUnviewedQrCandidates} QR ${restaurant.ownerUnviewedQrCandidates === 1 ? 'candidate has' : 'candidates have'} not appeared in the owner/team Applications list yet`,
          )
        }

        if (!restaurant.hasActiveOwner) {
          facts.push('No active owner account')
        }

        if (restaurant.enabledHiringRolesCount === 0) {
          facts.push('No hiring roles enabled')
        }

        return { restaurant, facts }
      })
      .filter((item) => item.facts.length > 0)
      .sort((first, second) => {
        const candidateDifference =
          second.restaurant.ownerUnviewedQrCandidates -
          first.restaurant.ownerUnviewedQrCandidates

        if (candidateDifference !== 0) {
          return candidateDifference
        }

        return (
          new Date(second.restaurant.latestActivityAt).getTime() -
          new Date(first.restaurant.latestActivityAt).getTime()
        )
      })

    return {
      totalCandidates,
      qrCandidates,
      jobApplications,
      ownerUnviewed,
      statusTotals,
      funnel,
      activeOwners: restaurants.filter((restaurant) => restaurant.hasActiveOwner)
        .length,
      hiringConfigured: restaurants.filter(
        (restaurant) => restaurant.enabledHiringRolesCount > 0,
      ).length,
      withCandidates: restaurants.filter(
        (restaurant) => restaurant.totalCandidatesCount > 0,
      ).length,
      restaurantsWaiting: restaurants.filter(
        (restaurant) => restaurant.ownerUnviewedQrCandidates > 0,
      ).length,
      needsAttention,
    }
  }, [restaurants])

  if (isLoading) {
    return (
      <AdminShell>
        <p className="status-message">Loading overview...</p>
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
      <section className="admin-overview-page">
        <header className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">Operations</p>
            <h1>Overview</h1>
            <p>Restaurant activation, hiring activity, and candidate attention.</p>
          </div>
          <span>{overview.needsAttention.length} need attention</span>
        </header>

        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        <section aria-labelledby="restaurant-health-heading">
          <div className="admin-section-heading">
            <div>
              <h2 id="restaurant-health-heading">Restaurant health</h2>
              <p>Factual setup and candidate activity across all restaurants.</p>
            </div>
            <Link to="/admin/restaurants">View restaurants</Link>
          </div>
          <div className="admin-overview-metrics">
            <MetricCard label="Total restaurants" value={restaurants.length} />
            <MetricCard label="Active owners" value={overview.activeOwners} />
            <MetricCard
              label="Hiring configured"
              value={overview.hiringConfigured}
              detail="At least one hiring role enabled"
            />
            <MetricCard
              label="With candidates"
              value={overview.withCandidates}
            />
            <MetricCard
              label="Waiting for restaurant"
              value={overview.restaurantsWaiting}
              detail={`${overview.ownerUnviewed} QR candidates not yet in an owner/team list view`}
              tone={overview.ownerUnviewed > 0 ? 'attention' : 'default'}
            />
          </div>
        </section>

        <section className="admin-overview-grid">
          <article className="admin-restaurant-panel admin-overview-funnel">
            <div className="admin-section-heading">
              <div>
                <h2>Candidate funnel</h2>
                <p>Public hiring-page activity from existing QR analytics.</p>
              </div>
            </div>
            <div className="admin-funnel-flow" aria-label="Candidate funnel">
              <FunnelStep
                label="Hiring Page Views"
                value={overview.funnel.pageViews}
                detail="Includes direct links and reloads"
              />
              <FunnelStep label="Form Started" value={overview.funnel.formStarted} />
              <FunnelStep
                label="Application Completed"
                value={overview.funnel.completed}
              />
              <FunnelStep
                label="Seen in owner list"
                value={overview.funnel.ownerListViewed}
                detail="List loaded; card opening is not tracked"
              />
            </div>
          </article>

          <article className="admin-restaurant-panel admin-candidate-summary">
            <div className="admin-section-heading">
              <div>
                <h2>Candidates</h2>
                <p>Both external/QR and Job Board applications.</p>
              </div>
              <Link to="/admin/candidates">View candidates</Link>
            </div>
            <dl>
              <div>
                <dt>Total applications</dt>
                <dd>{overview.totalCandidates}</dd>
              </div>
              <div>
                <dt>External / QR</dt>
                <dd>{overview.qrCandidates}</dd>
              </div>
              <div>
                <dt>Job Board</dt>
                <dd>{overview.jobApplications}</dd>
              </div>
              <div>
                <dt>Current status: Contacted</dt>
                <dd>{overview.statusTotals.contacted}</dd>
              </div>
              <div>
                <dt>Current status: Relevant</dt>
                <dd>{overview.statusTotals.relevant}</dd>
              </div>
              <div>
                <dt>Current status: Rejected</dt>
                <dd>{overview.statusTotals.rejected}</dd>
              </div>
            </dl>
          </article>
        </section>

        <section aria-labelledby="needs-attention-heading">
          <div className="admin-section-heading">
            <div>
              <h2 id="needs-attention-heading">Needs attention</h2>
              <p>Explicit operational conditions supported by current data.</p>
            </div>
          </div>
          {overview.needsAttention.length === 0 ? (
            <div className="admin-restaurant-panel admin-clear-state">
              <strong>No current attention items</strong>
              <p>Every restaurant has an active owner and enabled hiring roles, with no unviewed QR candidates.</p>
            </div>
          ) : (
            <div className="admin-attention-list">
              {overview.needsAttention.map(({ restaurant, facts }) => (
                <Link
                  className="admin-attention-item"
                  key={restaurant.id}
                  to={`/admin/restaurants/${restaurant.id}`}
                >
                  <div>
                    <strong>{restaurant.restaurantName}</strong>
                    <ul>
                      {facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'default',
}: {
  label: string
  value: number
  detail?: string
  tone?: 'default' | 'attention'
}) {
  return (
    <article className={`admin-stat-card admin-stat-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </article>
  )
}

function FunnelStep({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail?: string
}) {
  return (
    <div className="admin-funnel-step">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export default AdminOverviewPage
