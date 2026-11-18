import { useEffect, useState } from 'react'
import AdminShell from '../components/AdminShell'
import {
  getAdminCandidateFollowUps,
  saveAdminCandidateFollowUp,
} from '../services/adminApi'
import type {
  AdminCandidateFollowUp,
  AdminCandidateFollowUpFilter,
  AdminCandidateFollowUpStatus,
  AdminOpportunityConsentStatus,
} from '../types/admin'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'

const filters: Array<{
  value: AdminCandidateFollowUpFilter
  label: string
}> = [
  { value: 'toContact', label: 'ליצירת קשר' },
  { value: 'contacted', label: 'נוצר קשר' },
  { value: 'lookingForJob', label: 'מחפש/ת עבודה' },
  { value: 'foundJobElsewhere', label: 'מצא/ה עבודה במקום אחר' },
  { value: 'hiredByAdmin', label: 'התקבל/ה דרך Admin' },
  { value: 'all', label: 'הכול' },
]

const statusLabels: Record<AdminCandidateFollowUpStatus, string> = {
  notContacted: 'טרם נוצר קשר על ידי Admin',
  contacted: 'נוצר קשר על ידי Admin',
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
  notTracked: 'מעקב קשר אינו זמין להגשת Job Board',
} as const

function toDateTimeInputValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString('he-IL') : '—'
}

function AdminFollowUpsPage() {
  const [filter, setFilter] =
    useState<AdminCandidateFollowUpFilter>('toContact')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AdminCandidateFollowUp[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
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
  }, [filter, page, search])

  function handleSaved(
    candidateKey: string,
    followUp: AdminCandidateFollowUp['followUp'],
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === candidateKey ? { ...item, followUp } : item,
      ),
    )
  }

  return (
    <AdminShell>
      <section className="admin-page admin-follow-ups-page" dir="rtl">
        <header className="admin-page-header admin-follow-ups-header">
          <div>
            <p className="admin-eyebrow">מרחב עבודה פרטי ל-Admin</p>
            <h1>המעקב שלי</h1>
            <p>
              מעקב אישי אחר מועמדים. המידע כאן אינו משנה את סטטוס המועמדות
              במסעדה.
            </p>
          </div>
          <span className="admin-follow-ups-total">{total} מועמדים</span>
        </header>

        <div className="admin-follow-up-toolbar">
          <div className="admin-follow-up-filters" role="group" aria-label="סינון מעקב">
            {filters.map((option) => (
              <button
                type="button"
                className={filter === option.value ? 'active' : ''}
                key={option.value}
                onClick={() => {
                  setFilter(option.value)
                  setPage(1)
                }}
              >
                {option.label}
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
            <p>אפשר לשנות את הסינון או לחפש שם ומספר אחר.</p>
          </div>
        ) : (
          <div className="admin-follow-up-table" role="table">
            <div className="admin-follow-up-table-head" role="row">
              <span role="columnheader">מועמד/ת</span>
              <span role="columnheader">המועמדות המקורית</span>
              <span role="columnheader">המעקב שלי</span>
              <span role="columnheader">הערה והרשאה</span>
              <span role="columnheader">פעולות</span>
            </div>
            {items.map((item) => (
              <FollowUpRow
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

function FollowUpRow({
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
  const [nextFollowUpAt, setNextFollowUpAt] = useState(
    toDateTimeInputValue(candidate.followUp.nextFollowUpAt),
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

  async function save(markContactNow = false) {
    setIsSaving(true)
    setMessage(null)

    try {
      const saved = await saveAdminCandidateFollowUp({
        candidate: candidate.candidate,
        status:
          markContactNow && status === 'notContacted' ? 'contacted' : status,
        privateNote,
        nextFollowUpAt: nextFollowUpAt
          ? new Date(nextFollowUpAt).toISOString()
          : null,
        opportunityConsent,
        opportunityConsentMethod:
          opportunityConsent === 'notAsked'
            ? null
            : opportunityConsentMethod || null,
        markContactNow,
      })
      setStatus(saved.status)
      onSaved(candidate.key, saved)
      setMessage(markContactNow ? 'השיחה תועדה' : 'נשמר')
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : 'השמירה נכשלה',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <article className="admin-follow-up-row" role="row">
      <div className="admin-follow-up-identity" role="cell">
        <strong>{candidate.fullName}</strong>
        <a href={`tel:${candidate.phoneNumber}`} dir="ltr">
          {candidate.phoneNumber}
        </a>
        <span className={`admin-follow-up-contact-state ${candidate.restaurantContactState}`}>
          {contactStateLabels[candidate.restaurantContactState]}
        </span>
      </div>

      <div className="admin-follow-up-origin" role="cell">
        {original ? (
          <>
            <strong>{original.restaurant.restaurantName}</strong>
            <span>
              {original.roles
                .map((role) => getRestaurantRoleLabel(role, 'he'))
                .join(', ')}
            </span>
            <time dateTime={original.appliedAt}>
              {formatDate(original.appliedAt)}
            </time>
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
                      · {formatDate(application.appliedAt)}
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

      <div className="admin-follow-up-status-fields" role="cell">
        <label>
          <span>סטטוס</span>
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
        <label>
          <span>מעקב הבא</span>
          <input
            type="datetime-local"
            value={nextFollowUpAt}
            onChange={(event) => setNextFollowUpAt(event.target.value)}
          />
        </label>
        <small>
          קשר אחרון: {formatDate(candidate.followUp.lastAdminContactAt)}
        </small>
      </div>

      <div className="admin-follow-up-note-fields" role="cell">
        <label>
          <span>הערה פרטית</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={privateNote}
            onChange={(event) => setPrivateNote(event.target.value)}
            placeholder="לדוגמה: מחפש/ת עבודה כברמן/ית באזור שרונה"
          />
        </label>
        <label>
          <span>הסכמה לשמוע על הזדמנויות נוספות</span>
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
            <span>איך תועדה ההסכמה</span>
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
            תועד: {formatDate(candidate.followUp.opportunityConsentAt)}
          </small>
        )}
      </div>

      <div className="admin-follow-up-actions" role="cell">
        <button
          type="button"
          className="ui-button ui-button--secondary"
          disabled={isSaving}
          onClick={() => void save(false)}
        >
          שמירה
        </button>
        <button
          type="button"
          className="ui-button ui-button--primary"
          disabled={isSaving}
          onClick={() => void save(true)}
        >
          תיעוד שיחה עכשיו
        </button>
        {message && <small role="status">{message}</small>}
      </div>
    </article>
  )
}

export default AdminFollowUpsPage
