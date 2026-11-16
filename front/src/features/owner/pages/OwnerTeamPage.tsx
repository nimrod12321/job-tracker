import { useEffect, useState, type FormEvent } from 'react'
import {
  addOwnerTeamMember,
  getOwnerTeam,
  removeOwnerTeamMember,
  updateOwnerMatchContact,
} from '../services/ownerApi'
import type { OwnerTeam, OwnerTeamMember } from '../types/owner'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import { formatIsraeliPhoneForDisplay } from '../../../utils/phoneDisplay'
import { useOwnerRestaurant } from '../context/ownerRestaurantState'

const roleLabels = {
  he: {
    owner: 'בעלים',
    hiringManager: 'מנהל/ת גיוס',
  },
  en: {
    owner: 'Owner',
    hiringManager: 'Hiring manager',
  },
}

const statusLabels = {
  he: {
    active: 'פעיל',
    pending: 'ממתין',
    removed: 'הוסר',
  },
  en: {
    active: 'Active',
    pending: 'Pending',
    removed: 'Removed',
  },
}

function OwnerTeamPage() {
  const { language } = useRestaurantLanguage()
  const { selectedRestaurantId } = useOwnerRestaurant()
  const [team, setTeam] = useState<OwnerTeam | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingMatchContact, setIsSavingMatchContact] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const text = {
    title: language === 'he' ? 'צוות המסעדה' : 'Restaurant team',
    subtitle:
      language === 'he'
        ? 'הוסיפו מנהלי גיוס עם מספר הטלפון האישי שלהם.'
        : 'Add hiring managers with their own phone login.',
    loading: language === 'he' ? 'טוען צוות...' : 'Loading team...',
    name: language === 'he' ? 'שם' : 'Name',
    namePlaceholder:
      language === 'he' ? 'לא חובה' : 'Optional',
    phone: language === 'he' ? 'טלפון' : 'Phone',
    add:
      language === 'he' ? 'הוספת מנהל/ת גיוס' : 'Add hiring manager',
    adding: language === 'he' ? 'מוסיף...' : 'Adding...',
    remove: language === 'he' ? 'הסרה' : 'Remove',
    pendingHint:
      language === 'he'
        ? 'ממתין להתחברות עם מספר הטלפון הזה.'
        : 'Waiting for this phone number to log in.',
    forbidden:
      language === 'he'
        ? 'רק בעלים יכולים לנהל צוות.'
        : 'Only owners can manage the team.',
    success:
      language === 'he'
        ? 'מנהל העובדים נוסף.'
        : 'Hiring manager added.',
    matchContactTitle:
      language === 'he' ? 'איש קשר לאחר התאמה' : 'Contact after a Match',
    matchContactHelp:
      language === 'he'
        ? 'מועמדים רואים את המספר הזה רק לאחר שבחרתם להתאים איתם. מנהל/ת גיוס יחיד/ה ופעיל/ה נבחר/ת אוטומטית; אם יש כמה, בחרו איש קשר ראשי.'
        : 'Candidates see this number only after you select them for a Match. One active hiring manager is selected automatically; with several, choose the primary contact.',
    useOwner:
      language === 'he'
        ? 'אישור כלל איש הקשר'
        : 'Confirm contact rule',
    contactRuleEnabled:
      language === 'he' ? 'כלל איש הקשר פעיל.' : 'Contact rule is active.',
    primary: language === 'he' ? 'איש קשר ראשי' : 'Primary contact',
    choosePrimary:
      language === 'he' ? 'בחירה כאיש קשר ראשי' : 'Set as primary',
    contactSaved:
      language === 'he' ? 'איש הקשר נשמר.' : 'Match contact saved.',
  }

  useEffect(() => {
    let isActive = true

    async function loadTeam() {
      setIsLoading(true)
      setError(null)
      setMessage(null)
      setTeam(null)

      try {
        const nextTeam = await getOwnerTeam(
          selectedRestaurantId ?? undefined,
        )

        if (isActive) {
          setTeam(nextTeam)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load team',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadTeam()

    return () => {
      isActive = false
    }
  }, [selectedRestaurantId])

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!phoneNumber.trim()) {
      setError(language === 'he' ? 'צריך למלא טלפון.' : 'Phone is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const member = await addOwnerTeamMember({
        displayName,
        phoneNumber,
      }, selectedRestaurantId ?? undefined)

      setTeam((currentTeam) =>
        currentTeam
          ? {
              ...currentTeam,
              members: upsertMember(currentTeam.members, member),
            }
          : currentTeam,
      )
      setDisplayName('')
      setPhoneNumber('')
      setMessage(text.success)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to add team member',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRemoveMember(member: OwnerTeamMember) {
    setError(null)
    setMessage(null)
    setBusyMemberId(member.id)

    try {
      await removeOwnerTeamMember(
        member.id,
        selectedRestaurantId ?? undefined,
      )
      setTeam((currentTeam) =>
        currentTeam
          ? {
              ...currentTeam,
              members: currentTeam.members.filter(
                (currentMember) => currentMember.id !== member.id,
              ),
            }
          : currentTeam,
      )
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to remove team member',
      )
    } finally {
      setBusyMemberId(null)
    }
  }

  async function handleMatchContact(memberId: string | null) {
    setError(null)
    setMessage(null)
    setIsSavingMatchContact(true)

    try {
      const updated = await updateOwnerMatchContact(
        memberId,
        selectedRestaurantId ?? undefined,
      )

      setTeam((currentTeam) =>
        currentTeam
          ? {
              ...currentTeam,
              restaurant: {
                ...currentTeam.restaurant,
                ...updated,
              },
            }
          : currentTeam,
      )
      setMessage(text.contactSaved)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update Match contact',
      )
    } finally {
      setIsSavingMatchContact(false)
    }
  }

  if (isLoading) {
    return <p className="status-message">{text.loading}</p>
  }

  const isForbidden = error?.toLowerCase().includes('owner access required')

  if (isForbidden) {
    return (
      <section className="owner-team-page">
        <div className="owner-team-card">
          <h1>{text.title}</h1>
          <p>{text.forbidden}</p>
        </div>
      </section>
    )
  }

  const activeHiringManagers =
    team?.members.filter(
      (member) =>
        member.role === 'hiringManager' && member.status === 'active',
    ) ?? []
  const effectivePrimaryHiringManagerId =
    team?.restaurant.primaryHiringManagerMemberId ??
    (activeHiringManagers.length === 1
      ? activeHiringManagers[0]!.id
      : null)

  return (
    <section className="owner-team-page">
      <div className="page-header">
        <div>
          <span>{team?.restaurant.restaurantName}</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </div>

      <form className="owner-team-card owner-team-form" onSubmit={handleAddMember}>
        <label>
          {text.name}
          <input
            value={displayName}
            placeholder={text.namePlaceholder}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label>
          {text.phone}
          <input
            value={phoneNumber}
            inputMode="tel"
            placeholder="050-123-4567"
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
          />
        </label>
        <button
          className="ui-button ui-button--primary"
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? text.adding : text.add}
        </button>
      </form>

      {message && <p className="message message-success">{message}</p>}
      {error && !isForbidden && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      <section className="owner-team-card owner-team-match-contact">
        <h2>{text.matchContactTitle}</h2>
        <p>{text.matchContactHelp}</p>
        {team?.restaurant.ownerMatchContactConfirmed ? (
          <p className="owner-team-primary-contact">
            {text.contactRuleEnabled}
          </p>
        ) : (
          <button
            className="ui-button ui-button--secondary"
            type="button"
            disabled={isSavingMatchContact}
            onClick={() => void handleMatchContact(null)}
          >
            {text.useOwner}
          </button>
        )}
      </section>

      <div className="owner-team-list">
        {team?.members.map((member) => (
          <article className="owner-team-card" key={member.id}>
            <div>
              <h2>
                {member.displayName ||
                  formatIsraeliPhoneForDisplay(member.phoneNumber)}
              </h2>
              <p>{formatIsraeliPhoneForDisplay(member.phoneNumber)}</p>
              {member.status === 'pending' && <p>{text.pendingHint}</p>}
            </div>
            <div className="owner-team-badges">
              <span>{roleLabels[language][member.role]}</span>
              <span>{statusLabels[language][member.status]}</span>
            </div>
            {member.role === 'hiringManager' && member.status === 'active' && (
              member.id === effectivePrimaryHiringManagerId ? (
                <span className="owner-team-primary-contact">
                  {text.primary}
                </span>
              ) : (
                <button
                  className="ui-button ui-button--secondary"
                  type="button"
                  disabled={isSavingMatchContact}
                  onClick={() => void handleMatchContact(member.id)}
                >
                  {text.choosePrimary}
                </button>
              )
            )}
            {member.role !== 'owner' && (
              <button
                className="ui-button ui-button--destructive"
                type="button"
                disabled={busyMemberId === member.id}
                onClick={() => void handleRemoveMember(member)}
              >
                {text.remove}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function upsertMember(
  members: OwnerTeamMember[],
  member: OwnerTeamMember,
) {
  if (members.some((currentMember) => currentMember.id === member.id)) {
    return members.map((currentMember) =>
      currentMember.id === member.id ? member : currentMember,
    )
  }

  return [...members, member]
}

export default OwnerTeamPage
