import { useEffect, useRef, useState } from 'react'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
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
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(
    null,
  )
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
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
    new: language === 'he' ? 'חדש' : 'New',
    contacted: language === 'he' ? 'נוצר קשר' : 'Contacted',
    relevant: language === 'he' ? 'רלוונטי' : 'Relevant',
    leadRejected: language === 'he' ? 'נדחה' : 'Rejected',
    call: language === 'he' ? 'שיחה' : 'Call',
    whatsapp: language === 'he' ? 'וואטסאפ' : 'WhatsApp',
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
            ? {
                ...currentApplication,
                status: application.status,
              }
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

  function getLeadStatusLabel(status: CandidateLeadStatus) {
    const labels = {
      new: text.new,
      contacted: text.contacted,
      relevant: text.relevant,
      rejected: text.leadRejected,
    }

    return labels[status]
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
            <div className="owner-list-heading">
              <h2>{text.jobApplicants}</h2>
              <span>{applications.length}</span>
            </div>
            {applications.length === 0 ? (
              <div className="empty-state owner-applications-empty">
                <p>{text.emptyHint}</p>
              </div>
            ) : (
              <div className="owner-application-list">
                {applications.map((application) => {
            const whatsappNumber = application.worker.phoneNumber.replace(
              /\D/g,
              '',
            )
            const workerName = application.worker.fullName || text.unnamed

                  return (
                    <article
                      className="owner-application-card"
                      key={application.id}
                    >
                <div className="owner-application-header">
                  <div className="owner-worker-heading">
                    <span className="owner-worker-avatar" aria-hidden="true">
                      {getWorkerInitial(workerName)}
                    </span>
                    <div>
                      <p>
                        {getRestaurantRoleLabel(
                          application.job.role,
                          language,
                        )}
                      </p>
                      <h2>{workerName}</h2>
                    </div>
                  </div>
                  <span
                    className={`application-status ${application.status}`}
                  >
                    {getStatusLabel(application.status, language)}
                  </span>
                </div>

                <dl className="owner-worker-details">
                  <div>
                    <dt>{text.location}</dt>
                    <dd>{application.worker.location || text.notProvided}</dd>
                  </div>
                  <div>
                    <dt>{text.age}</dt>
                    <dd>{application.worker.age ?? text.notProvided}</dd>
                  </div>
                  <div>
                    <dt>{text.availability}</dt>
                    <dd>
                      {application.worker.availability || text.notProvided}
                    </dd>
                  </div>
                  <div>
                    <dt>{text.phone}</dt>
                    <dd>
                      {application.worker.phoneNumber || text.notProvided}
                    </dd>
                  </div>
                  <div>
                    <dt>{text.appliedAt}</dt>
                    <dd>
                      {new Date(application.createdAt).toLocaleDateString()}
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
                    {application.worker.experienceText || text.notProvided}
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
                    type="button"
                    disabled={
                      busyApplicationId === application.id ||
                      application.status === 'selected'
                    }
                    onClick={() =>
                      void handleStatusChange(application, 'selected')
                    }
                  >
                    {text.select}
                  </button>
                  <button
                    className="owner-reject-button"
                    type="button"
                    disabled={
                      busyApplicationId === application.id ||
                      application.status === 'rejected'
                    }
                    onClick={() =>
                      void handleStatusChange(application, 'rejected')
                    }
                  >
                    {text.reject}
                  </button>
                </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="owner-candidate-section">
            <div className="owner-list-heading">
              <h2>{text.qrCandidates}</h2>
              <span>{leads.length}</span>
            </div>
            {leads.length === 0 ? (
              <div className="empty-state owner-applications-empty">
                <p>{text.noQrCandidates}</p>
              </div>
            ) : (
              <div className="owner-application-list">
                {leads.map((lead) => {
                  const whatsappNumber = lead.phoneNumber.replace(/\D/g, '')
                  const candidateName = lead.fullName || text.unnamed

                  return (
                    <article className="owner-application-card" key={lead.id}>
                      <div className="owner-application-header">
                        <div className="owner-worker-heading">
                          <span className="owner-worker-avatar" aria-hidden="true">
                            {getWorkerInitial(candidateName)}
                          </span>
                          <div>
                            <p>{text.sourceQr}</p>
                            <h2>{candidateName}</h2>
                          </div>
                        </div>
                        <span className={`application-status ${lead.status}`}>
                          {getLeadStatusLabel(lead.status)}
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
                          <dd>{new Date(lead.createdAt).toLocaleDateString()}</dd>
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
                          <a href={`tel:${lead.phoneNumber}`}>{text.call}</a>
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
                        {leadStatuses.map((status) => (
                          <button
                            type="button"
                            disabled={
                              busyLeadId === lead.id || lead.status === status
                            }
                            key={status}
                            onClick={() =>
                              void handleLeadStatusChange(lead, status)
                            }
                          >
                            {getLeadStatusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export default OwnerApplicationsPage
