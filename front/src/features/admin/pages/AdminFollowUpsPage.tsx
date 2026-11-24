import { useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'
import {
  getAdminCandidateFollowUps,
  saveAdminCandidateFollowUp,
} from '../services/adminApi'
import type {
  AdminCandidateFollowUp,
  AdminCandidateFollowUpFilter,
  AdminCandidateFollowUpList,
  AdminCandidateFollowUpStatus,
  AdminOpportunityConsentStatus,
} from '../types/admin'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'

const filters: Array<{
  value: AdminCandidateFollowUpFilter
  label: string
}> = [
  { value: 'notContacted', label: 'לא יצרתי קשר' },
  { value: 'inProgress', label: 'בטיפול' },
  { value: 'closed', label: 'סגורים' },
  { value: 'all', label: 'הכול' },
]

const statusLabels: Record<AdminCandidateFollowUpStatus, string> = {
  notContacted: 'טרם יצרתי קשר',
  contacted: 'יצרתי קשר',
  lookingForJob: 'מחפש/ת עבודה אחרת',
  foundJobElsewhere: 'מצא/ה עבודה במקום אחר',
  hiredByAdmin: 'התקבל/ה לעבודה דרך Admin',
}

const consentLabels: Record<AdminOpportunityConsentStatus, string> = {
  notAsked: 'לא נשאל/ה',
  yes: 'כן',
  no: 'לא',
}

const contactStateLabels = {
  notRecorded: 'לא תועד קשר מצד המסעדה',
  recorded: 'קיים תיעוד קשר מצד המסעדה',
  notTracked: 'אין מעקב קשר אמין להגשת Job Board',
} as const

const emptyCounts: AdminCandidateFollowUpList['counts'] = {
  notContacted: 0,
  inProgress: 0,
  closed: 0,
  all: 0,
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('he-IL') : 'טרם תועד'
}

function AdminFollowUpsPage() {
  const [filter, setFilter] =
    useState<AdminCandidateFollowUpFilter>('notContacted')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminCandidateFollowUp[]>([])
  const [counts, setCounts] = useState(emptyCounts)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  useEffect(() => {
    let isActive = true

    async function loadFollowUps() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getAdminCandidateFollowUps({
          filter,
          search,
          page,
          pageSize: 25,
        })

        if (isActive) {
          setItems(result.items)
          setCounts(result.counts)
          setTotal(result.pagination.total)
          setTotalPages(result.pagination.totalPages)
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'טעינת המעקב נכשלה',
          )
        }
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    void loadFollowUps()

    return () => {
      isActive = false
    }
  }, [filter, page, refreshKey, search])

  function handleSaved(
    candidateKey: string,
    followUp: AdminCandidateFollowUp['followUp'],
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === candidateKey ? { ...item, followUp } : item,
      ),
    )
    setRefreshKey((current) => current + 1)
  }

  return (
    <AdminShell>
      <section className="admin-page admin-follow-ups-page" dir="rtl">
        <header className="admin-page-header admin-follow-ups-header">
          <div>
            <p className="admin-eyebrow">רשימת שיחות אישית</p>
            <h1>המעקב שלי</h1>
            <p>
              הרשימה מבוססת על מידע מתועד בלבד. היא אינה משנה את סטטוס
              המועמדות במסעדה.
            </p>
          </div>
          <span className="admin-follow-ups-total">{total} מועמדים</span>
        </header>

        <div className="admin-follow-up-toolbar">
          <div
            className="admin-follow-up-filters"
            role="tablist"
            aria-label="סינון מעקב"
          >
            {filters.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={filter === option.value ? 'active' : ''}
                key={option.value}
                onClick={() => {
                  setFilter(option.value)
                  setPage(1)
                }}
              >
                <span>{option.label}</span>
                <b>{counts[option.value]}</b>
              </button>
            ))}
          </div>
          <label className="admin-follow-up-search">
            <span>חיפוש לפי שם או טלפון</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="שם או מספר טלפון"
            />
          </label>
        </div>

        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        {isLoading ? (
          <p className="status-message">טוען מעקבים...</p>
        ) : items.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>אין מועמדים בתצוגה הזו</h2>
            <p>אפשר לעבור ללשונית אחרת או לחפש שם ומספר אחר.</p>
          </div>
        ) : (
          <div className="admin-follow-up-list">
            {items.map((item) => (
              <FollowUpCard
                candidate={item}
                key={item.key}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="admin-follow-up-pagination" aria-label="עמודי מעקב">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              הקודם
            </button>
            <span>
              עמוד {page} מתוך {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              הבא
            </button>
          </nav>
        )}
      </section>
    </AdminShell>
  )
}

function FollowUpCard({
  candidate,
  onSaved,
}: {
  candidate: AdminCandidateFollowUp
  onSaved: (
    candidateKey: string,
    followUp: AdminCandidateFollowUp['followUp'],
  ) => void
}) {
  const [status, setStatus] = useState(candidate.followUp.status)
  const [privateNote, setPrivateNote] = useState(
    candidate.followUp.privateNote,
  )
  const [opportunityConsent, setOpportunityConsent] =
    useState<AdminOpportunityConsentStatus>(
      candidate.followUp.opportunityConsent,
    )
  const [opportunityConsentMethod, setOpportunityConsentMethod] = useState(
    candidate.followUp.opportunityConsentMethod ?? '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const original = candidate.originalApplication
  const effectiveConsentMethod =
    opportunityConsent === 'notAsked' ? '' : opportunityConsentMethod
  const savedConsentMethod =
    candidate.followUp.opportunityConsent === 'notAsked'
      ? ''
      : candidate.followUp.opportunityConsentMethod ?? ''
  const hasUnsavedChanges =
    status !== candidate.followUp.status ||
    privateNote !== candidate.followUp.privateNote ||
    opportunityConsent !== candidate.followUp.opportunityConsent ||
    effectiveConsentMethod !== savedConsentMethod

  async function save() {
    setIsSaving(true)
    setMessage(null)

    try {
      const saved = await saveAdminCandidateFollowUp({
        candidate: candidate.candidate,
        status,
        privateNote,
        opportunityConsent,
        opportunityConsentMethod:
          opportunityConsent === 'notAsked'
            ? null
            : opportunityConsentMethod || null,
      })
      setStatus(saved.status)
      onSaved(candidate.key, saved)
      setMessage('נשמר')
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : 'השמירה נכשלה',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="admin-follow-up-card">
      <header className="admin-follow-up-card-header">
        <div className="admin-follow-up-identity">
          <strong>{candidate.fullName}</strong>
          <a href={`tel:${candidate.phoneNumber}`} dir="ltr">
            {candidate.phoneNumber}
          </a>
        </div>
        <span
          className={`admin-follow-up-contact-state ${candidate.restaurantContactState}`}
        >
          {contactStateLabels[candidate.restaurantContactState]}
        </span>
      </header>

      <div className="admin-follow-up-origin">
        {original ? (
          <>
            <div>
              <strong>{original.restaurant.restaurantName}</strong>
              <span>
                {original.roles
                  .map((role) => getRestaurantRoleLabel(role, 'he'))
                  .join(', ')}
              </span>
            </div>
            <small>
              {original.source === 'qr' ? 'הגשת QR' : 'Job Board'} ·{' '}
              {formatDate(original.appliedAt)}
            </small>
            {candidate.relatedApplications.length > 1 && (
              <details>
                <summary>
                  עוד {candidate.relatedApplications.length - 1} מועמדויות
                </summary>
                <ul>
                  {candidate.relatedApplications.slice(1).map((application) => (
                    <li key={`${application.source}-${application.id}`}>
                      {application.restaurant.restaurantName} ·{' '}
                      {application.roles
                        .map((role) => getRestaurantRoleLabel(role, 'he'))
                        .join(', ')}{' '}
                      · {application.source === 'qr' ? 'QR' : 'Job Board'} ·{' '}
                      {formatDate(application.appliedAt)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <span>המועמדות המקורית אינה זמינה</span>
        )}
      </div>

      <div className="admin-follow-up-edit-fields">
        <label>
          <span>הסטטוס שלי</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as AdminCandidateFollowUpStatus)
            }
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-follow-up-note-field">
          <span>הערה פרטית</span>
          <textarea
            rows={2}
            maxLength={2000}
            value={privateNote}
            onChange={(event) => setPrivateNote(event.target.value)}
            placeholder="הערה קצרה לשיחה הבאה"
          />
        </label>
      </div>

      <details className="admin-follow-up-consent">
        <summary>
          הרשאה להזדמנויות נוספות: {consentLabels[opportunityConsent]}
        </summary>
        <div>
          <label>
            <span>האם המועמד/ת הסכים/ה?</span>
            <select
              value={opportunityConsent}
              onChange={(event) =>
                setOpportunityConsent(
                  event.target.value as AdminOpportunityConsentStatus,
                )
              }
            >
              {Object.entries(consentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {opportunityConsent !== 'notAsked' && (
            <label>
              <span>איך תועדה ההרשאה?</span>
              <select
                value={opportunityConsentMethod}
                onChange={(event) =>
                  setOpportunityConsentMethod(event.target.value)
                }
              >
                <option value="">לא צוין</option>
                <option value="phone">שיחת טלפון</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="inPerson">שיחה פנים אל פנים</option>
                <option value="other">אחר</option>
              </select>
            </label>
          )}
          {candidate.followUp.opportunityConsentAt && (
            <small>
              ההרשאה תועדה: {' '}
              {formatDate(candidate.followUp.opportunityConsentAt)}
            </small>
          )}
        </div>
      </details>

      <footer className="admin-follow-up-card-footer">
        <small>
          קשר אחרון שלי: {formatDate(candidate.followUp.lastAdminContactAt)}
        </small>
        <div>
          {hasUnsavedChanges && (
            <small className="admin-follow-up-unsaved">
              שינויים שלא נשמרו
            </small>
          )}
          {message && <small role="status">{message}</small>}
          <button
            type="button"
            className="ui-button ui-button--primary"
            disabled={isSaving}
            onClick={() => void save()}
          >
            {isSaving ? 'שומר...' : 'שמירה'}
          </button>
        </div>
      </footer>
    </article>
  )
}

export default AdminFollowUpsPage
