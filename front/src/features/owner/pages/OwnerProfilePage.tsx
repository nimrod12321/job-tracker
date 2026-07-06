import { useEffect, useState, type FormEvent } from 'react'
import {
  getOwnerProfile,
  saveOwnerProfile,
} from '../services/ownerApi'
import type { OwnerProfileInput } from '../types/owner'

const emptyProfile: OwnerProfileInput = {
  restaurantName: '',
  contactPerson: '',
  phoneNumber: '',
  whatsappNumber: '',
  location: '',
  area: '',
  description: '',
}

function OwnerProfilePage() {
  const [form, setForm] = useState<OwnerProfileInput>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getOwnerProfile()

        if (isActive && profile) {
          setForm({
            restaurantName: profile.restaurantName,
            contactPerson: profile.contactPerson,
            phoneNumber: profile.phoneNumber,
            whatsappNumber: profile.whatsappNumber,
            location: profile.location,
            area: profile.area,
            description: profile.description,
          })
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load restaurant profile',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  function updateField(field: keyof OwnerProfileInput, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const savedProfile = await saveOwnerProfile(form)

      setForm({
        restaurantName: savedProfile.restaurantName,
        contactPerson: savedProfile.contactPerson,
        phoneNumber: savedProfile.phoneNumber,
        whatsappNumber: savedProfile.whatsappNumber,
        location: savedProfile.location,
        area: savedProfile.area,
        description: savedProfile.description,
      })
      setSuccess('Restaurant profile saved.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to save restaurant profile',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className="owner-profile-page">
        <div className="page-header">
          <div>
            <h1>Restaurant profile</h1>
            <p>These details are used when you publish jobs.</p>
          </div>
        </div>
        <p className="status-message">Loading restaurant profile...</p>
      </section>
    )
  }

  return (
    <section className="owner-profile-page">
      <div className="page-header">
        <div>
          <h1>Restaurant profile</h1>
          <p>These details are used when you publish jobs.</p>
        </div>
      </div>

      <form className="owner-profile-form" onSubmit={handleSubmit}>
        <label>
          Restaurant name
          <input
            value={form.restaurantName}
            onChange={(event) =>
              updateField('restaurantName', event.target.value)
            }
          />
        </label>

        <label>
          Contact person
          <input
            value={form.contactPerson}
            onChange={(event) =>
              updateField('contactPerson', event.target.value)
            }
          />
        </label>

        <label>
          Phone number
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(event) =>
              updateField('phoneNumber', event.target.value)
            }
          />
        </label>

        <label>
          WhatsApp number
          <input
            type="tel"
            value={form.whatsappNumber}
            onChange={(event) =>
              updateField('whatsappNumber', event.target.value)
            }
          />
        </label>

        <label>
          Location
          <input
            value={form.location}
            onChange={(event) => updateField('location', event.target.value)}
          />
        </label>

        <label>
          Area
          <input
            value={form.area}
            onChange={(event) => updateField('area', event.target.value)}
          />
        </label>

        <label className="owner-field-wide">
          Short description
          <textarea
            rows={5}
            value={form.description}
            onChange={(event) =>
              updateField('description', event.target.value)
            }
          />
        </label>

        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        {success && (
          <p className="message message-success" aria-live="polite">
            {success}
          </p>
        )}

        <button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </section>
  )
}

export default OwnerProfilePage
