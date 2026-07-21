import { useEffect, useRef, useState } from 'react'
import {
  getRestaurantRoleLabel,
  type RestaurantRole,
} from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  deleteOwnerApplication,
  deleteOwnerLead,
  getOwnerApplications,
  getOwnerLeads,
  updateOwnerApplicationStatus,
  updateOwnerLeadStatus,
} from '../services/ownerApi'
import type {
  CandidateLeadStatus,
  OwnerApplication,
  OwnerApplicationStatus,
  RestaurantCandidateLead,
} from '../types/owner'

const leadStatuses: CandidateLeadStatus[] = [
  'new',
  'contacted',
  'relevant',
  'rejected',
]

function getStatusLabel(
  status: OwnerApplicationStatus,
  language: 'he' | 'en',
) {
  const labels = {
    applied: language === 'he' ? 'הוגש' : 'Applied',
    rejected: language === 'he' ? 'נדחה' : 'Rejected',
    selected: language === 'he' ? 'נבחר' : 'Selected',
  }

  return labels[status]
}

function getWorkerInitial(name: string) {
  return Array.from(name.trim() || '?')[0]
}

function OwnerApplicationsPage() {
  const { direction, language } = useRestaurantLanguage()
  const [applications, setApplications] = useState<OwnerApplication[]>([])
  const [leads, setLeads] = useState<RestaurantCandidateLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isQrSectionOpen, setIsQrSectionOpen] = useState(true)
  const [isJobSectionOpen, setIsJobSectionOpen] = useState(false)
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(
    null,
  )
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const pendingApplicationIds = useRef(new Set<string>())
  const pendingLeadIds = useRef(new Set<string>())

  const text = {
    title: language === 'he' ? 'מועמדים' : 'Applications',
    subtitle:
      language === 'he'
        ? 'עובדים שהגישו מועמדות למשרות שלך.'
        : 'Review workers who applied to your restaurant jobs.',
    loading: language === 'he' ? 'טוען מועמדים...' : 'Loading applications...',
    emptyTitle: language === 'he' ? 'אין מועמדים עדיין' : 'No applicants yet',
    emptyHint:
      language === 'he'
        ? 'כשעובדים יגישו מועמדות, הם יופיעו כאן.'
        : 'When workers apply, they will appear here.',
    jobApplicants:
      language === 'he' ? 'מועמדים ממשרות' : 'Job applicants',
    qrCandidates:
      language === 'he' ? 'מועמדים מהברקוד' : 'QR candidates',
    noQrCandidates:
      language === 'he'
        ? 'עדיין אין מועמדים מהברקוד.'
        : 'No QR candidates yet.',
    sourceQr: language === 'he' ? 'ברקוד' : 'QR',
    unnamed: language === 'he' ? 'עובד ללא שם' : 'Unnamed worker',
    location: language === 'he' ? 'מיקום' : 'Location',
    age: language === 'he' ? 'גיל' : 'Age',
    availability: language === 'he' ? 'זמינות' : 'Availability',
    phone: language === 'he' ? 'טלפון' : 'Phone',
    appliedAt: language === 'he' ? 'הוגש' : 'Applied',
    wantedRoles: language === 'he' ? 'תפקידים רצויים' : 'Wanted roles',
    experience: language === 'he' ? 'ניסיון' : 'Experience',
    notProvided: language === 'he' ? 'לא צוין' : 'Not provided',
    select: language === 'he' ? 'בחר' : 'Select',
    reject: language === 'he' ? 'דחה' : 'Reject',
    status: language === 'he' ? 'סטטוס' : 'Status',
    new: language === 'he' ? 'חדש' : 'New',
    contacted: language === 'he' ? 'נוצר קשר' : 'Contacted',
    relevant: language === 'he' ? 'רלוונטי' : 'Relevant',
    leadRejected: language === 'he' ? 'נדחה' : 'Rejected',
    call: language === 'he' ? 'שיחה' : 'Call',
    whatsapp: language === 'he' ? 'וואטסאפ' : 'WhatsApp',
    remove: language === 'he' ? 'הסר מהרשימה' : 'Remove from list',
    removeConfirm:
      language === 'he'
        ? 'להסיר את המועמד מהרשימה?'
        : 'Remove this applicant from your list?',
    experiencePreview: language === 'he' ? 'ניסיון' : 'Experience',
    appliedTo: language === 'he' ? 'הגיש/ה ל' : 'Applied to',
    qrApplication: language === 'he' ? 'מועמדות QR' : 'QR application',
    collapseCandidate:
      language === 'he' ? 'סגירת מועמד' : 'Collapse candidate',
  }

  useEffect(() => {
    let isActive = true

    async function loadApplications() {
      try {
        const [ownerApplications, ownerLeads] = await Promise.all([
          getOwnerApplications(),
          getOwnerLeads(),
        ])

        if (isActive) {
          setApplications(ownerApplications)
          setLeads(ownerLeads)
          setIsQrSectionOpen(true)
          setIsJobSectionOpen(ownerLeads.length === 0)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load applications',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadApplications()

    return () => {
      isActive = false
    }
  }, [])

  async function handleStatusChange(
    application: OwnerApplication,
    status: 'selected' | 'rejected',
  ) {
    if (
      pendingApplicationIds.current.has(application.id) ||
      application.status === status
    ) {
      return
    }

    pendingApplicationIds.current.add(application.id)
    setBusyApplicationId(application.id)
    setError(null)
    setApplications((currentApplications) =>
      currentApplications.map((currentApplication) =>
        currentApplication.id === application.id
          ? {
              ...currentApplication,
              status,
            }
          : currentApplication,
      ),
    )

    try {
      const updatedApplication = await updateOwnerApplicationStatus(
        application.id,
        status,
      )

      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === updatedApplication.id
            ? {
                ...currentApplication,
                status: updatedApplication.status,
              }
            : currentApplication,
        ),
      )
    } catch (error) {
      setApplications((currentApplications) =>
        currentApplications.map((currentApplication) =>
          currentApplication.id === application.id
            ? application
            : currentApplication,
        ),
      )
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update application',
      )
    } finally {
      pendingApplicationIds.current.delete(application.id)
      setBusyApplicationId(null)
    }
  }

  async function handleLeadStatusChange(
    lead: RestaurantCandidateLead,
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
      const updatedLead = await updateOwnerLeadStatus(lead.id, status)

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
          : 'Failed to update QR candidate',
      )
    } finally {
      pendingLeadIds.current.delete(lead.id)
      setBusyLeadId(null)
    }
  }

  async function handleRemoveLead(lead: RestaurantCandidateLead) {
    if (pendingLeadIds.current.has(lead.id)) {
      return
    }

    if (!window.confirm(text.removeConfirm)) {
      return
    }

    const leadIndex = leads.findIndex((currentLead) => currentLead.id === lead.id)

    pendingLeadIds.current.add(lead.id)
    setBusyLeadId(lead.id)
    setError(null)
    setLeads((currentLeads) =>
      currentLeads.filter((currentLead) => currentLead.id !== lead.id),
    )

    try {
      await deleteOwnerLead(lead.id)
    } catch (error) {
      setLeads((currentLeads) => {
        if (currentLeads.some((currentLead) => currentLead.id === lead.id)) {
          return currentLeads
        }

        const insertAt = leadIndex >= 0 ? Math.min(leadIndex, currentLeads.length) : 0

        return [
          ...currentLeads.slice(0, insertAt),
          lead,
          ...currentLeads.slice(insertAt),
        ]
      })
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to remove QR candidate',
      )
    } finally {
      pendingLeadIds.current.delete(lead.id)
      setBusyLeadId(null)
    }
  }

  async function handleRemoveApplication(application: OwnerApplication) {
    if (pendingApplicationIds.current.has(application.id)) {
      return
    }

    if (!window.confirm(text.removeConfirm)) {
      return
    }

    const applicationIndex = applications.findIndex(
      (currentApplication) => currentApplication.id === application.id,
    )

    pendingApplicationIds.current.add(application.id)
    setBusyApplicationId(application.id)
    setError(null)
    setApplications((currentApplications) =>
      currentApplications.filter(
        (currentApplication) => currentApplication.id !== application.id,
      ),
    )

    try {
      await deleteOwnerApplication(application.id)
    } catch (error) {
      setApplications((currentApplications) => {
        if (
          currentApplications.some(
            (currentApplication) => currentApplication.id === application.id,
          )
        ) {
          return currentApplications
        }

        const insertAt =
          applicationIndex >= 0
            ? Math.min(applicationIndex, currentApplications.length)
            : 0

        return [
          ...currentApplications.slice(0, insertAt),
          application,
          ...currentApplications.slice(insertAt),
        ]
      })
      setError(
        error instanceof Error ? error.message : 'Failed to remove application',
      )
    } finally {
      pendingApplicationIds.current.delete(application.id)
      setBusyApplicationId(null)
    }
  }

  function getLeadStatusLabel(status: CandidateLeadStatus) {
    const labels = {
      new: text.new,
      contacted: text.contacted,
      relevant: text.relevant,
      rejected: text.leadRejected,
    }

    return labels[status]
  }

  function handleLeadContactClick(lead: RestaurantCandidateLead) {
    if (lead.status !== 'new' || pendingLeadIds.current.has(lead.id)) {
      return
    }

    void handleLeadStatusChange(lead, 'contacted')
  }

  function getExperiencePreview(experienceText: string | null | undefined) {
    const firstLine = experienceText?.split('\n')[0]?.trim()

    if (!firstLine) {
      return text.notProvided
    }

    return firstLine.length > 54 ? `${firstLine.slice(0, 51)}...` : firstLine
  }

  function getRolePreview(roles: RestaurantRole[]) {
    if (roles.length === 0) {
      return text.qrApplication
    }

    const [firstRole, ...extraRoles] = roles
    const firstRoleLabel = getRestaurantRoleLabel(firstRole, language)

    return extraRoles.length > 0
      ? `${firstRoleLabel} +${extraRoles.length}`
      : firstRoleLabel
  }

  function renderSectionHeader(
    title: string,
    count: number,
    isOpen: boolean,
    onToggle: () => void,
  ) {
    return (
      <button
        className="owner-candidate-section-header ui-disclosure-button"
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>
          {title} · {count}
        </span>
        <span aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
      </button>
    )
  }

  if (isLoading) {
    return (
      <section className="owner-applications-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
        </div>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  return (
    <section className="owner-applications-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {applications.length === 0 && leads.length === 0 ? (
        <div className="empty-state owner-applications-empty">
          <h2>{text.emptyTitle}</h2>
          <p>{text.emptyHint}</p>
        </div>
      ) : (
        <>
          <section className="owner-candidate-section">
            {renderSectionHeader(
              text.qrCandidates,
              leads.length,
              isQrSectionOpen,
              () => setIsQrSectionOpen((currentValue) => !currentValue),
            )}

            {isQrSectionOpen &&
              (leads.length === 0 ? (
                <div className="empty-state owner-applications-empty">
                  <p>{text.noQrCandidates}</p>
                </div>
              ) : (
                <div className="owner-application-list">
                  {leads.map((lead) => {
                    const whatsappNumber = lead.phoneNumber.replace(/\D/g, '')
                    const candidateName = lead.fullName || text.unnamed
                    const candidateId = `lead:${lead.id}`
                    const isExpanded = expandedCandidateId === candidateId
                    const rolePreview = getRolePreview(lead.wantedRoles)

                    return (
                      <article
                        className={`owner-application-card owner-candidate-card${
                          isExpanded ? ' is-expanded' : ' is-collapsed'
                        }`}
                        key={lead.id}
                      >
                        <div className="owner-application-header">
                          <button
                            className="owner-worker-heading owner-candidate-open-button"
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => {
                              if (!isExpanded) {
                                setExpandedCandidateId(candidateId)
                              }
                            }}
                          >
                            <span
                              className="owner-worker-avatar"
                              aria-hidden="true"
                            >
                              {getWorkerInitial(candidateName)}
                            </span>
                            <span className="owner-worker-copy">
                              <span className="owner-worker-kicker">
                                {text.sourceQr}
                              </span>
                              <strong className="owner-worker-name">
                                {candidateName}
                              </strong>
                            </span>
                            {!isExpanded && (
                              <span
                                className="owner-disclosure-chevron"
                                aria-hidden="true"
                              >
                                ⌄
                              </span>
                            )}
                          </button>
                          <div className="owner-candidate-header-actions">
                            <label
                              className={`owner-status-pill-select ${lead.status}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <select
                                aria-label={text.status}
                                value={lead.status}
                                disabled={busyLeadId === lead.id}
                                onChange={(event) =>
                                  void handleLeadStatusChange(
                                    lead,
                                    event.target.value as CandidateLeadStatus,
                                  )
                                }
                              >
                                {leadStatuses.map((status) => (
                                  <option
                                    disabled={status === lead.status}
                                    key={status}
                                    value={status}
                                  >
                                    {getLeadStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {isExpanded && (
                              <button
                                className="owner-candidate-collapse-button peepss-close-button ui-icon-button"
                                type="button"
                                aria-label={text.collapseCandidate}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setExpandedCandidateId(null)
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="owner-candidate-preview">
                          <span>
                            {text.experiencePreview}:{' '}
                            {getExperiencePreview(lead.experienceText)}
                          </span>
                          <span>
                            {text.appliedTo}: {rolePreview}
                          </span>
                        </div>

                        <dl className="owner-worker-details">
                          <div>
                            <dt>{text.phone}</dt>
                            <dd>{lead.phoneNumber || text.notProvided}</dd>
                          </div>
                          <div>
                            <dt>{text.age}</dt>
                            <dd>{lead.age ?? text.notProvided}</dd>
                          </div>
                          <div>
                            <dt>{text.availability}</dt>
                            <dd>{lead.availability || text.notProvided}</dd>
                          </div>
                          <div>
                            <dt>{text.appliedAt}</dt>
                            <dd>
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </dd>
                          </div>
                        </dl>

                        <div className="owner-application-section">
                          <strong>{text.wantedRoles}</strong>
                          <p>
                            {lead.wantedRoles.length > 0
                              ? lead.wantedRoles
                                  .map((role) =>
                                    getRestaurantRoleLabel(role, language),
                                  )
                                  .join(', ')
                              : text.notProvided}
                          </p>
                        </div>

                        <div className="owner-application-section">
                          <strong>{text.experience}</strong>
                          <p>{lead.experienceText || text.notProvided}</p>
                        </div>

                        {lead.phoneNumber && (
                          <div className="owner-applicant-contact">
                            <a
                              href={`tel:${lead.phoneNumber}`}
                              onClick={() => handleLeadContactClick(lead)}
                            >
                              {text.call}
                            </a>
                            {whatsappNumber && (
                              <a
                                href={`https://wa.me/${whatsappNumber}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => handleLeadContactClick(lead)}
                              >
                                {text.whatsapp}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="owner-application-actions">
                          <button
                            className="owner-remove-button ui-button ui-button--destructive"
                            type="button"
                            disabled={busyLeadId === lead.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleRemoveLead(lead)
                            }}
                          >
                            {text.remove}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
          </section>

          <section className="owner-candidate-section">
            {renderSectionHeader(
              text.jobApplicants,
              applications.length,
              isJobSectionOpen,
              () => setIsJobSectionOpen((currentValue) => !currentValue),
            )}

            {isJobSectionOpen &&
              (applications.length === 0 ? (
                <div className="empty-state owner-applications-empty">
                  <p>{text.emptyHint}</p>
                </div>
              ) : (
                <div className="owner-application-list">
                  {applications.map((application) => {
                    const whatsappNumber =
                      application.worker.phoneNumber.replace(/\D/g, '')
                    const workerName =
                      application.worker.fullName || text.unnamed
                    const candidateId = `application:${application.id}`
                    const isExpanded = expandedCandidateId === candidateId
                    const rolePreview = getRestaurantRoleLabel(
                      application.job.role,
                      language,
                    )

                    return (
                      <article
                        className={`owner-application-card owner-candidate-card${
                          isExpanded ? ' is-expanded' : ' is-collapsed'
                        }`}
                        key={application.id}
                      >
                        <div className="owner-application-header">
                          <button
                            className="owner-worker-heading owner-candidate-open-button"
                            type="button"
                            aria-expanded={isExpanded}
                            onClick={() => {
                              if (!isExpanded) {
                                setExpandedCandidateId(candidateId)
                              }
                            }}
                          >
                            <span
                              className="owner-worker-avatar"
                              aria-hidden="true"
                            >
                              {getWorkerInitial(workerName)}
                            </span>
                            <span className="owner-worker-copy">
                              <span className="owner-worker-kicker">
                                {getRestaurantRoleLabel(
                                  application.job.role,
                                  language,
                                )}
                              </span>
                              <strong className="owner-worker-name">
                                {workerName}
                              </strong>
                            </span>
                            {!isExpanded && (
                              <span
                                className="owner-disclosure-chevron"
                                aria-hidden="true"
                              >
                                ⌄
                              </span>
                            )}
                          </button>
                          <div className="owner-candidate-header-actions">
                            <label
                              className={`owner-status-pill-select ${application.status}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <select
                                aria-label={text.status}
                                value={application.status}
                                disabled={busyApplicationId === application.id}
                                onChange={(event) => {
                                  const nextStatus = event.target.value as
                                    | 'applied'
                                    | 'selected'
                                    | 'rejected'

                                  if (nextStatus !== 'applied') {
                                    void handleStatusChange(
                                      application,
                                      nextStatus,
                                    )
                                  }
                                }}
                              >
                                <option value="applied" disabled>
                                  {getStatusLabel('applied', language)}
                                </option>
                                <option
                                  value="selected"
                                  disabled={application.status === 'selected'}
                                >
                                  {text.select}
                                </option>
                                <option
                                  value="rejected"
                                  disabled={application.status === 'rejected'}
                                >
                                  {text.reject}
                                </option>
                              </select>
                            </label>
                            {isExpanded && (
                              <button
                                className="owner-candidate-collapse-button peepss-close-button ui-icon-button"
                                type="button"
                                aria-label={text.collapseCandidate}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setExpandedCandidateId(null)
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="owner-candidate-preview">
                          <span>
                            {text.experiencePreview}:{' '}
                            {getExperiencePreview(
                              application.worker.experienceText,
                            )}
                          </span>
                          <span>
                            {text.appliedTo}: {rolePreview}
                          </span>
                        </div>

                        <dl className="owner-worker-details">
                          <div>
                            <dt>{text.location}</dt>
                            <dd>
                              {application.worker.location || text.notProvided}
                            </dd>
                          </div>
                          <div>
                            <dt>{text.age}</dt>
                            <dd>{application.worker.age ?? text.notProvided}</dd>
                          </div>
                          <div>
                            <dt>{text.availability}</dt>
                            <dd>
                              {application.worker.availability ||
                                text.notProvided}
                            </dd>
                          </div>
                          <div>
                            <dt>{text.phone}</dt>
                            <dd>
                              {application.worker.phoneNumber ||
                                text.notProvided}
                            </dd>
                          </div>
                          <div>
                            <dt>{text.appliedAt}</dt>
                            <dd>
                              {new Date(
                                application.createdAt,
                              ).toLocaleDateString()}
                            </dd>
                          </div>
                        </dl>

                        <div className="owner-application-section">
                          <strong>{text.wantedRoles}</strong>
                          <p>
                            {application.worker.wantedRoles.length > 0
                              ? application.worker.wantedRoles
                                  .map((role) =>
                                    getRestaurantRoleLabel(role, language),
                                  )
                                  .join(', ')
                              : text.notProvided}
                          </p>
                        </div>

                        <div className="owner-application-section">
                          <strong>{text.experience}</strong>
                          <p>
                            {application.worker.experienceText ||
                              text.notProvided}
                          </p>
                        </div>

                        {application.worker.phoneNumber && (
                          <div className="owner-applicant-contact">
                            <a href={`tel:${application.worker.phoneNumber}`}>
                              {text.call}
                            </a>
                            {whatsappNumber && (
                              <a
                                href={`https://wa.me/${whatsappNumber}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {text.whatsapp}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="owner-application-actions">
                          <button
                            className="owner-remove-button ui-button ui-button--destructive"
                            type="button"
                            disabled={busyApplicationId === application.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleRemoveApplication(application)
                            }}
                          >
                            {text.remove}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ))}
          </section>
        </>
      )}
    </section>
  )
}

export default OwnerApplicationsPage
