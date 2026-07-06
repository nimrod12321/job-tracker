import { useEffect, useState, type FormEvent } from 'react'
import {
  getRestaurantProfile,
  saveRestaurantProfile,
} from '../services/restaurantApi'
import {
  RESTAURANT_ROLES,
  type RestaurantRole,
  type RestaurantWorkerProfile,
} from '../types/restaurant'

type RestaurantProfileForm = {
  fullName: string
  phoneNumber: string
  location: string
  wantedRoles: RestaurantRole[]
  experienceText: string
  availability: string
  age: string
}

const emptyProfile: RestaurantProfileForm = {
  fullName: '',
  phoneNumber: '',
  location: '',
  wantedRoles: [],
  experienceText: '',
  availability: '',
  age: '',
}

function profileToForm(
  profile: RestaurantWorkerProfile,
): RestaurantProfileForm {
  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
    location: profile.location,
    wantedRoles: profile.wantedRoles,
    experienceText: profile.experienceText,
    availability: profile.availability,
    age: profile.age === 0 ? '' : String(profile.age),
  }
}

function RestaurantProfilePage() {
  const [form, setForm] = useState<RestaurantProfileForm>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getRestaurantProfile()

        if (isActive && profile) {
          setForm(profileToForm(profile))
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

  function updateTextField(
    field: Exclude<keyof RestaurantProfileForm, 'wantedRoles'>,
    value: string,
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function toggleRole(role: RestaurantRole) {
    setForm((currentForm) => ({
      ...currentForm,
      wantedRoles: currentForm.wantedRoles.includes(role)
        ? currentForm.wantedRoles.filter(
            (currentRole) => currentRole !== role,
          )
        : [...currentForm.wantedRoles, role],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSaving(true)

    try {
      const profile = await saveRestaurantProfile({
        ...form,
        age: Number(form.age) || 0,
      })

      setForm(profileToForm(profile))
      setSuccess('Profile saved.')
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
      <section className="restaurant-profile-page">
        <div className="page-header">
          <div>
            <h1>Profile</h1>
            <p>Tell restaurants what kind of work fits you.</p>
          </div>
        </div>
        <p className="status-message">Loading profile...</p>
      </section>
    )
  }

  return (
    <section className="restaurant-profile-page">
      <div className="page-header">
        <div>
          <h1>Restaurant profile</h1>
          <p>Keep it short. You can update these details whenever you want.</p>
        </div>
      </div>

      <form className="restaurant-profile-form" onSubmit={handleSubmit}>
        <label>
          Full name
          <input
            value={form.fullName}
            onChange={(event) =>
              updateTextField('fullName', event.target.value)
            }
          />
        </label>

        <label>
          Phone number
          <input
            type="tel"
            value={form.phoneNumber}
            onChange={(event) =>
              updateTextField('phoneNumber', event.target.value)
            }
          />
        </label>

        <label>
          Location
          <input
            value={form.location}
            onChange={(event) =>
              updateTextField('location', event.target.value)
            }
            placeholder="Tel Aviv"
          />
        </label>

        <label>
          Age
          <input
            type="number"
            min="0"
            max="120"
            value={form.age}
            onChange={(event) => updateTextField('age', event.target.value)}
          />
        </label>

        <fieldset className="restaurant-role-options">
          <legend>Wanted roles</legend>
          <div>
            {RESTAURANT_ROLES.map((role) => (
              <label key={role.value}>
                <input
                  type="checkbox"
                  checked={form.wantedRoles.includes(role.value)}
                  onChange={() => toggleRole(role.value)}
                />
                <span>{role.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="restaurant-field-wide">
          Experience
          <textarea
            rows={5}
            value={form.experienceText}
            onChange={(event) =>
              updateTextField('experienceText', event.target.value)
            }
            placeholder="A short summary of your restaurant experience"
          />
        </label>

        <label className="restaurant-field-wide">
          Availability
          <textarea
            rows={3}
            value={form.availability}
            onChange={(event) =>
              updateTextField('availability', event.target.value)
            }
            placeholder="For example: evenings and weekends"
          />
        </label>

        <p className="restaurant-profile-note">
          Some roles may require legal age or experience.
        </p>

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

export default RestaurantProfilePage
