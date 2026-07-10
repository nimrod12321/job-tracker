import { useEffect, useState, type FormEvent } from 'react'
import {
  addOwnerTeamMember,
  getOwnerTeam,
  removeOwnerTeamMember,
} from '../services/ownerApi'
import type { OwnerTeam, OwnerTeamMember } from '../types/owner'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'

const roleLabels = {
  he: {
    owner: 'בעלים',
    hiringManager: 'מנהל עובדים',
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
  const [team, setTeam] = useState<OwnerTeam | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const text = {
    title: language === 'he' ? 'צוות המסעדה' : 'Restaurant team',
    subtitle:
      language === 'he'
        ? 'הוסיפו מנהלי עובדים עם מספר הטלפון האישי שלהם.'
        : 'Add hiring managers with their own phone login.',
    loading: language === 'he' ? 'טוען צוות...' : 'Loading team...',
    name: language === 'he' ? 'שם' : 'Name',
    namePlaceholder:
      language === 'he' ? 'לא חובה' : 'Optional',
    phone: language === 'he' ? 'טלפון' : 'Phone',
    add:
      language === 'he' ? 'הוספת מנהל עובדים' : 'Add hiring manager',
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
  }

  useEffect(() => {
    let isActive = true

    async function loadTeam() {
      try {
        const nextTeam = await getOwnerTeam()

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
  }, [])

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
      })

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
      await removeOwnerTeamMember(member.id)
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
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? text.adding : text.add}
        </button>
      </form>

      {message && <p className="message message-success">{message}</p>}
      {error && !isForbidden && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

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
            {member.role !== 'owner' && (
              <button
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

function formatIsraeliPhoneForDisplay(phone: string) {
  const trimmedPhone = phone.trim()
  const match = trimmedPhone.match(/^\+972(5\d{8})$/)

  if (!match) {
    return trimmedPhone
  }

  const localPhone = `0${match[1]}`

  return `${localPhone.slice(0, 3)}-${localPhone.slice(3)}`
}

export default OwnerTeamPage
