import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PeepssModal from '../../../components/common/PeepssModal'
import AdminShell from '../components/AdminShell'
import {
  getAdminAcquisitionFunnel,
  getAdminAcquisitionFunnelStage,
  getAdminRestaurants,
} from '../services/adminApi'
import type {
  AdminAcquisitionFunnelReport,
  AdminAcquisitionFunnelStageKey,
  AdminAcquisitionStageDetailsReport,
  AdminRestaurant,
} from '../types/admin'

const acquisitionStageLabels: Record<
  AdminAcquisitionFunnelStageKey,
  string
> = {
  ownerSignupStarted: 'Owner signup started',
  otpVerified: 'OTP verified',
  restaurantEstablished: 'Restaurant established',
  hiringReady: 'Hiring ready',
  recruitmentKitOpened: 'Recruitment Kit opened',
  recruitmentAssetUsed: 'Recruitment asset used',
  candidateReceived: 'Candidate received',
  candidateCardOpened: 'Candidate card opened',
  contactInitiated: 'Contact initiated',
}

function AdminOverviewPage() {
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [acquisitionReport, setAcquisitionReport] =
    useState<AdminAcquisitionFunnelReport | null>(null)
  const [acquisitionFilters, setAcquisitionFilters] = useState({
    source: '',
    medium: '',
    campaign: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isAcquisitionLoading, setIsAcquisitionLoading] = useState(true)
  const [selectedAcquisitionStage, setSelectedAcquisitionStage] =
    useState<AdminAcquisitionFunnelStageKey | null>(null)
  const [acquisitionStageDetails, setAcquisitionStageDetails] =
    useState<AdminAcquisitionStageDetailsReport | null>(null)
  const [acquisitionStagePage, setAcquisitionStagePage] = useState(1)
  const [isAcquisitionStageLoading, setIsAcquisitionStageLoading] =
    useState(false)
  const [acquisitionStageError, setAcquisitionStageError] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [acquisitionError, setAcquisitionError] = useState<string | null>(null)
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

  useEffect(() => {
    let isActive = true

    async function loadAcquisitionReport() {
      setIsAcquisitionLoading(true)
      setAcquisitionError(null)

      try {
        const report = await getAdminAcquisitionFunnel({
          ...(acquisitionFilters.source
            ? { source: acquisitionFilters.source }
            : {}),
          ...(acquisitionFilters.medium
            ? { medium: acquisitionFilters.medium }
            : {}),
          ...(acquisitionFilters.campaign
            ? { campaign: acquisitionFilters.campaign }
            : {}),
        })

        if (isActive) setAcquisitionReport(report)
      } catch (loadError) {
        if (isActive) {
          setAcquisitionError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load acquisition funnel',
          )
        }
      } finally {
        if (isActive) setIsAcquisitionLoading(false)
      }
    }

    void loadAcquisitionReport()

    return () => {
      isActive = false
    }
  }, [acquisitionFilters])

  useEffect(() => {
    if (!selectedAcquisitionStage) {
      return
    }

    let isActive = true

    async function loadAcquisitionStageDetails() {
      setIsAcquisitionStageLoading(true)
      setAcquisitionStageError(null)

      try {
        const details = await getAdminAcquisitionFunnelStage(
          selectedAcquisitionStage!,
          {
            ...(acquisitionFilters.source
              ? { source: acquisitionFilters.source }
              : {}),
            ...(acquisitionFilters.medium
              ? { medium: acquisitionFilters.medium }
              : {}),
            ...(acquisitionFilters.campaign
              ? { campaign: acquisitionFilters.campaign }
              : {}),
            page: acquisitionStagePage,
            pageSize: 25,
          },
        )

        if (isActive) setAcquisitionStageDetails(details)
      } catch (loadError) {
        if (isActive) {
          setAcquisitionStageError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load acquisition stage details',
          )
        }
      } finally {
        if (isActive) setIsAcquisitionStageLoading(false)
      }
    }

    void loadAcquisitionStageDetails()

    return () => {
      isActive = false
    }
  }, [acquisitionFilters, acquisitionStagePage, selectedAcquisitionStage])

  const closeAcquisitionStageDetails = useCallback(() => {
    setSelectedAcquisitionStage(null)
    setAcquisitionStageDetails(null)
    setAcquisitionStageError(null)
    setAcquisitionStagePage(1)
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

        <section aria-labelledby="acquisition-funnel-heading">
          <div className="admin-section-heading">
            <div>
              <h2 id="acquisition-funnel-heading">
                Restaurant Acquisition Funnel
              </h2>
              <p>
                Unique acquisition cohorts beginning at owner signup intent.
              </p>
            </div>
          </div>

          <div className="admin-acquisition-filters" aria-label="Acquisition filters">
            <label>
              <span>Source</span>
              <select
                value={acquisitionFilters.source}
                onChange={(event) =>
                  setAcquisitionFilters((current) => ({
                    ...current,
                    source: event.target.value,
                  }))
                }
              >
                <option value="">All sources</option>
                {acquisitionReport?.filterOptions.sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Medium</span>
              <select
                value={acquisitionFilters.medium}
                onChange={(event) =>
                  setAcquisitionFilters((current) => ({
                    ...current,
                    medium: event.target.value,
                  }))
                }
              >
                <option value="">All media</option>
                {acquisitionReport?.filterOptions.mediums.map((medium) => (
                  <option key={medium} value={medium}>
                    {medium}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Campaign</span>
              <select
                value={acquisitionFilters.campaign}
                onChange={(event) =>
                  setAcquisitionFilters((current) => ({
                    ...current,
                    campaign: event.target.value,
                  }))
                }
              >
                <option value="">All campaigns</option>
                {acquisitionReport?.filterOptions.campaigns.map((campaign) => (
                  <option key={campaign} value={campaign}>
                    {campaign}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {acquisitionError && (
            <p className="message message-error" role="alert">
              {acquisitionError}
            </p>
          )}

          {isAcquisitionLoading && !acquisitionReport ? (
            <p className="status-message">Loading acquisition funnel...</p>
          ) : acquisitionReport ? (
            <>
              <article className="admin-restaurant-panel admin-overview-funnel">
                <div
                  className="admin-funnel-flow admin-acquisition-funnel-flow"
                  aria-label="Restaurant acquisition funnel"
                >
                  {acquisitionReport.funnel.map((stage) => (
                    <AcquisitionFunnelStep
                      key={stage.key}
                      label={acquisitionStageLabels[stage.key]}
                      currentlyHere={
                        acquisitionReport.currentStageCounts[stage.key]
                      }
                      reached={stage.count}
                      detail={
                        stage.conversionFromPrevious === null
                          ? stage.key === 'ownerSignupStarted'
                            ? 'Cohort entry'
                            : '— from previous stage'
                          : `${stage.conversionFromPrevious}% from previous stage`
                      }
                      onClick={() => {
                        setAcquisitionStageDetails(null)
                        setAcquisitionStageError(null)
                        setAcquisitionStagePage(1)
                        setSelectedAcquisitionStage(stage.key)
                      }}
                    />
                  ))}
                </div>
              </article>

              <div className="admin-overview-grid">
                <article className="admin-restaurant-panel">
                  <div className="admin-section-heading">
                    <div>
                      <h3>Acquisition Sources</h3>
                      <p>Immutable first-touch attribution by signup cohort.</p>
                    </div>
                  </div>
                  <div className="admin-acquisition-table-wrap">
                    <table className="admin-acquisition-table">
                      <thead>
                        <tr>
                          <th>Source</th>
                          <th>Medium</th>
                          <th>Campaign</th>
                          <th>Signup</th>
                          <th>Established</th>
                          <th>Asset used</th>
                          <th>Candidate</th>
                          <th>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acquisitionReport.byAttribution.length === 0 ? (
                          <tr>
                            <td colSpan={8}>No acquisition cohorts match these filters.</td>
                          </tr>
                        ) : (
                          acquisitionReport.byAttribution.map((group) => (
                            <tr
                              key={`${group.source}:${group.medium}:${group.campaign ?? ''}`}
                            >
                              <td>{group.source}</td>
                              <td>{group.medium}</td>
                              <td>{group.campaign ?? '—'}</td>
                              <td>{group.stages.ownerSignupStarted}</td>
                              <td>{group.stages.restaurantEstablished}</td>
                              <td>{group.stages.recruitmentAssetUsed}</td>
                              <td>{group.stages.candidateReceived}</td>
                              <td>{group.stages.contactInitiated}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>

                <article className="admin-restaurant-panel admin-acquisition-breakdowns">
                  <div>
                    <h3>Owner signup flow</h3>
                    <dl>
                      <div><dt>Self-serve</dt><dd>{acquisitionReport.signupFlows.selfServe}</dd></div>
                      <div><dt>Claim</dt><dd>{acquisitionReport.signupFlows.claim}</dd></div>
                      <div><dt>Pending phone</dt><dd>{acquisitionReport.signupFlows.pendingPhone}</dd></div>
                    </dl>
                  </div>
                  <div>
                    <h3>Candidate source</h3>
                    <dl>
                      <div><dt>External</dt><dd>{acquisitionReport.candidateSources.external}</dd></div>
                      <div><dt>Job Board</dt><dd>{acquisitionReport.candidateSources.jobBoard}</dd></div>
                    </dl>
                  </div>
                </article>
              </div>
            </>
          ) : null}
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

        <PeepssModal
          isOpen={selectedAcquisitionStage !== null}
          onClose={closeAcquisitionStageDetails}
          title={
            selectedAcquisitionStage
              ? `${acquisitionStageLabels[selectedAcquisitionStage]} — currently here`
              : 'Acquisition stage details'
          }
        >
          {acquisitionStageError && (
            <p className="message message-error" role="alert">
              {acquisitionStageError}
            </p>
          )}

          {isAcquisitionStageLoading && !acquisitionStageDetails ? (
            <p className="status-message">Loading stage details...</p>
          ) : acquisitionStageDetails ? (
            <div className="admin-acquisition-stage-details">
              <p className="admin-acquisition-stage-summary">
                {acquisitionStageDetails.pagination.total}{' '}
                {acquisitionStageDetails.pagination.total === 1
                  ? 'acquisition is'
                  : 'acquisitions are'}{' '}
                currently at this stage under the active filters.
              </p>

              <div className="admin-acquisition-table-wrap">
                <table className="admin-acquisition-table admin-acquisition-stage-table">
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>Phone</th>
                      <th>Attribution</th>
                      <th>Flow</th>
                      <th>Restaurant</th>
                      <th>Stage reached</th>
                      <th>First touch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acquisitionStageDetails.rows.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          No acquisitions are currently at this stage.
                        </td>
                      </tr>
                    ) : (
                      acquisitionStageDetails.rows.map((row) => {
                        const whatsappNumber = row.phoneNumber?.replace(
                          /\D/g,
                          '',
                        )

                        return (
                          <tr key={row.acquisitionId}>
                            <td>{row.ownerName ?? '—'}</td>
                            <td>
                              {row.phoneVerified && row.phoneNumber
                                ? row.phoneNumber
                                : 'Not verified'}
                            </td>
                            <td>
                              <span className="admin-acquisition-attribution">
                                <strong>{row.source}</strong>
                                <small>{row.medium}</small>
                                <small>{row.campaign ?? '—'}</small>
                              </span>
                            </td>
                            <td>{row.flow}</td>
                            <td>
                              {row.restaurant ? (
                                <Link
                                  to={`/admin/restaurants/${row.restaurant.id}`}
                                >
                                  {row.restaurant.restaurantName}
                                </Link>
                              ) : (
                                'Not established'
                              )}
                            </td>
                            <td>
                              {formatAdminTimestamp(row.currentStageReachedAt)}
                            </td>
                            <td>{formatAdminTimestamp(row.firstTouchedAt)}</td>
                            <td>
                              {row.phoneVerified && row.phoneNumber ? (
                                <span className="admin-acquisition-contact-actions">
                                  <a href={`tel:${row.phoneNumber}`}>Call</a>
                                  <a
                                    href={`https://wa.me/${whatsappNumber}`}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    WhatsApp
                                  </a>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {acquisitionStageDetails.pagination.totalPages > 1 && (
                <div className="admin-acquisition-pagination">
                  <button
                    disabled={
                      isAcquisitionStageLoading ||
                      acquisitionStageDetails.pagination.page <= 1
                    }
                    onClick={() =>
                      setAcquisitionStagePage((current) => current - 1)
                    }
                    type="button"
                  >
                    Previous
                  </button>
                  <span>
                    Page {acquisitionStageDetails.pagination.page} of{' '}
                    {acquisitionStageDetails.pagination.totalPages}
                  </span>
                  <button
                    disabled={
                      isAcquisitionStageLoading ||
                      acquisitionStageDetails.pagination.page >=
                      acquisitionStageDetails.pagination.totalPages
                    }
                    onClick={() =>
                      setAcquisitionStagePage((current) => current + 1)
                    }
                    type="button"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </PeepssModal>
      </section>
    </AdminShell>
  )
}

function formatAdminTimestamp(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
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

function AcquisitionFunnelStep({
  label,
  currentlyHere,
  reached,
  detail,
  onClick,
}: {
  label: string
  currentlyHere: number
  reached: number
  detail: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={`View ${currentlyHere} acquisitions currently at ${label}`}
      className="admin-funnel-step admin-acquisition-stage-button"
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <strong className="admin-acquisition-current-count">
        {currentlyHere}
      </strong>
      <small className="admin-acquisition-current-label">currently here</small>
      <small className="admin-acquisition-reached-count">
        {reached} reached
      </small>
      <small>{detail}</small>
    </button>
  )
}

export default AdminOverviewPage
