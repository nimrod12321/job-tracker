import { useEffect, useRef, useState } from 'react'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'
import {
  getAdminRestaurantLeads,
  updateAdminRestaurantLeadStatus,
} from '../services/adminApi'
import type {
  AdminRestaurantCandidateLead,
  CandidateLeadStatus,
} from '../../owner/types/owner'

const statuses: CandidateLeadStatus[] = [
  'new',
  'contacted',
  'relevant',
  'rejected',
]

function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminRestaurantCandidateLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null)
  const pendingLeadIds = useRef(new Set<string>())

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
      <section className="admin-leads-page">
        <p className="status-message">Loading restaurant leads...</p>
      </section>
    )
  }

  return (
    <section className="admin-leads-page">
      <div className="page-header">
        <div>
          <h1>Restaurant QR leads</h1>
          <p>All public QR candidate leads across restaurants.</p>
        </div>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {leads.length === 0 ? (
        <div className="empty-state">
          <h2>No QR leads yet</h2>
          <p>Public restaurant applications will appear here.</p>
        </div>
      ) : (
        <div className="owner-application-list">
          {leads.map((lead) => {
            const whatsappNumber = lead.phoneNumber.replace(/\D/g, '')

            return (
              <article className="owner-application-card" key={lead.id}>
                <div className="owner-application-header">
                  <div>
                    <p>{lead.restaurant.restaurantName}</p>
                    <h2>{lead.fullName}</h2>
                  </div>
                  <span className={`application-status ${lead.status}`}>
                    {lead.status}
                  </span>
                </div>
                <dl className="owner-worker-details">
                  <div>
                    <dt>Restaurant</dt>
                    <dd>
                      {[lead.restaurant.city, lead.restaurant.street]
                        .filter(Boolean)
                        .join(' · ') || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{lead.phoneNumber}</dd>
                  </div>
                  <div>
                    <dt>Age</dt>
                    <dd>{lead.age ?? 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{new Date(lead.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
                <div className="owner-application-section">
                  <strong>Wanted roles</strong>
                  <p>
                    {lead.wantedRoles
                      .map((role) => getRestaurantRoleLabel(role))
                      .join(', ')}
                  </p>
                </div>
                <div className="owner-application-section">
                  <strong>Experience</strong>
                  <p>{lead.experienceText || 'Not provided'}</p>
                </div>
                <div className="owner-application-section">
                  <strong>Availability</strong>
                  <p>{lead.availability || 'Not provided'}</p>
                </div>
                <div className="owner-applicant-contact">
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
                <div className="owner-application-actions">
                  {statuses.map((status) => (
                    <button
                      type="button"
                      disabled={busyLeadId === lead.id || lead.status === status}
                      key={status}
                      onClick={() => void handleStatusChange(lead, status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default AdminLeadsPage
