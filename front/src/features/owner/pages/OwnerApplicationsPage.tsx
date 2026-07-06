import { useEffect, useState } from 'react'
import { RESTAURANT_ROLES } from '../../restaurant/types/restaurant'
import {
  getOwnerApplications,
  updateOwnerApplicationStatus,
} from '../services/ownerApi'
import type {
  OwnerApplication,
  OwnerApplicationStatus,
} from '../types/owner'

function getRoleLabel(role: OwnerApplication['job']['role']) {
  return (
    RESTAURANT_ROLES.find((option) => option.value === role)?.label ?? role
  )
}

function getStatusLabel(status: OwnerApplicationStatus) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`
}

function OwnerApplicationsPage() {
  const [applications, setApplications] = useState<OwnerApplication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadApplications() {
      try {
        const ownerApplications = await getOwnerApplications()

        if (isActive) {
          setApplications(ownerApplications)
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
    setBusyApplicationId(application.id)
    setError(null)

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
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update application',
      )
    } finally {
      setBusyApplicationId(null)
    }
  }

  if (isLoading) {
    return (
      <section className="owner-applications-page">
        <div className="page-header">
          <div>
            <h1>Applications</h1>
            <p>Review workers who applied to your restaurant jobs.</p>
          </div>
        </div>
        <p className="status-message">Loading applications...</p>
      </section>
    )
  }

  return (
    <section className="owner-applications-page">
      <div className="page-header">
        <div>
          <h1>Applications</h1>
          <p>Review workers who applied to your restaurant jobs.</p>
        </div>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {applications.length === 0 ? (
        <div className="empty-state owner-applications-empty">
          <h2>No applications yet.</h2>
          <p>Applications will appear here when workers apply.</p>
        </div>
      ) : (
        <div className="owner-application-list">
          {applications.map((application) => {
            const whatsappNumber = application.worker.phoneNumber.replace(
              /\D/g,
              '',
            )

            return (
              <article
                className="owner-application-card"
                key={application.id}
              >
                <div className="owner-application-header">
                  <div>
                    <p>{getRoleLabel(application.job.role)}</p>
                    <h2>
                      {application.worker.fullName || 'Unnamed worker'}
                    </h2>
                  </div>
                  <span
                    className={`application-status ${application.status}`}
                  >
                    {getStatusLabel(application.status)}
                  </span>
                </div>

                <dl className="owner-worker-details">
                  <div>
                    <dt>Location</dt>
                    <dd>{application.worker.location || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Age</dt>
                    <dd>{application.worker.age ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Availability</dt>
                    <dd>
                      {application.worker.availability || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      {application.worker.phoneNumber || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt>Applied</dt>
                    <dd>
                      {new Date(application.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>

                <div className="owner-application-section">
                  <strong>Wanted roles</strong>
                  <p>
                    {application.worker.wantedRoles.length > 0
                      ? application.worker.wantedRoles
                          .map(getRoleLabel)
                          .join(', ')
                      : 'Not provided'}
                  </p>
                </div>

                <div className="owner-application-section">
                  <strong>Experience</strong>
                  <p>
                    {application.worker.experienceText || 'Not provided'}
                  </p>
                </div>

                {application.worker.phoneNumber && (
                  <div className="owner-applicant-contact">
                    <a href={`tel:${application.worker.phoneNumber}`}>
                      Call
                    </a>
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
                    Select
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
                    Reject
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default OwnerApplicationsPage
