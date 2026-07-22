import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  getOwnerProfile,
  saveOwnerProfile,
} from '../services/ownerApi'
import type { OwnerProfileInput } from '../types/owner'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'

const emptyProfile: OwnerProfileInput = {
  restaurantName: '',
  contactPerson: '',
  phoneNumber: '',
  whatsappNumber: '',
  city: 'Tel Aviv–Yafo',
  street: '',
  description: '',
}

type ProfileField = Exclude<keyof OwnerProfileInput, 'locationPlaceId'>

function OwnerProfilePage() {
  const navigate = useNavigate()
  const { direction, language } = useRestaurantLanguage()
  const [form, setForm] = useState<OwnerProfileInput>(emptyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<ProfileField[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [isNewProfile, setIsNewProfile] = useState(true)
  const [locationStatus, setLocationStatus] =
    useState<'unverified' | 'verified'>('unverified')
  const [locationInput, setLocationInput] = useState('')
  const [locationPlaceId, setLocationPlaceId] = useState('')

  const text = {
    title:
      language === 'he' ? 'פרופיל המסעדה שלך' : 'Your restaurant profile',
    subtitle:
      language === 'he'
        ? 'נשתמש בזה כדי לנהל משרות ברורות ומהירות.'
        : 'We use this to manage clear, fast job posts.',
    loading:
      language === 'he'
        ? 'טוען פרופיל מסעדה...'
        : 'Loading restaurant profile...',
    finish:
      language === 'he' ? 'שמירה והמשך למשרות' : 'Save and continue to jobs',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saved:
      language === 'he'
        ? 'פרופיל המסעדה נשמר.'
        : 'Restaurant profile saved.',
    restaurantSection:
      language === 'he' ? 'פרטי המסעדה' : 'Restaurant details',
    contactSection:
      language === 'he' ? 'יצירת קשר' : 'Contact',
    descriptionSection:
      language === 'he' ? 'על המסעדה' : 'About the restaurant',
    address: language === 'he' ? 'כתובת' : 'Address',
    contactPhone: language === 'he' ? 'טלפון' : 'Contact phone',
    incompleteSummary:
      language === 'he'
        ? 'כדי לפרסם משרות צריך להשלים את פרטי המסעדה.'
        : 'Complete your restaurant profile before posting jobs.',
    locationTitle: language === 'he' ? 'מיקום המסעדה' : 'Restaurant location',
    locationVerified: language === 'he' ? 'המיקום מאומת' : 'Location verified',
    locationNeedsVerification:
      language === 'he' ? 'נדרש אימות מיקום' : 'Location needs verification',
    locationContact:
      language === 'he'
        ? 'צריכים לעדכן את מיקום המסעדה? פנו ל-Peepss.'
        : 'Need to update the restaurant location? Contact Peepss.',
    addressSelectionError:
      language === 'he'
        ? 'יש לבחור רחוב ומספר תקינים בתל אביב-יפו.'
        : 'Choose a valid Tel Aviv–Yafo street and number.',
  }

  const fieldLabels: Record<ProfileField, string> = {
    restaurantName: language === 'he' ? 'שם המסעדה' : 'Restaurant name',
    contactPerson: language === 'he' ? 'איש קשר' : 'Contact person',
    phoneNumber: text.contactPhone,
    whatsappNumber: text.contactPhone,
    city: language === 'he' ? 'עיר' : 'City',
    street: text.address,
    description: language === 'he' ? 'על המסעדה' : 'About the restaurant',
  }

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      try {
        const profile = await getOwnerProfile()

        if (isActive && profile) {
          setIsNewProfile(false)
          setLocationStatus(profile.locationStatus)
          setLocationInput(profile.formattedAddress || profile.street)
          setForm({
            restaurantName: profile.restaurantName,
            contactPerson: profile.contactPerson,
            phoneNumber: profile.phoneNumber,
            whatsappNumber: profile.whatsappNumber,
            city: profile.city,
            street: profile.street,
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
    setMissingFields((currentFields) =>
      currentFields.filter((currentField) => currentField !== field),
    )
  }

  function getMissingProfileFields() {
    return (
      [
        'restaurantName',
        'contactPerson',
        'phoneNumber',
        'city',
        'street',
        'description',
      ] as ProfileField[]
    ).filter((field) => !form[field].trim())
  }

  function isMissing(field: ProfileField) {
    return missingFields.includes(field)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setSuccess(null)

    if (
      locationStatus !== 'verified' &&
      isNewProfile &&
      !locationPlaceId
    ) {
      setError(text.addressSelectionError)
      return
    }

    const nextMissingFields = getMissingProfileFields()

    if (nextMissingFields.length > 0) {
      setMissingFields(nextMissingFields)
      setError(text.incompleteSummary)
      return
    }

    setIsSaving(true)

    try {
      const profileInput = {
        ...form,
        whatsappNumber: form.phoneNumber,
        ...(locationPlaceId ? { locationPlaceId } : {}),
      }
      const savedProfile = await saveOwnerProfile(profileInput)

      setForm({
        restaurantName: savedProfile.restaurantName,
        contactPerson: savedProfile.contactPerson,
        phoneNumber: savedProfile.phoneNumber,
        whatsappNumber: savedProfile.whatsappNumber,
        city: savedProfile.city,
        street: savedProfile.street,
        description: savedProfile.description,
      })
      setSuccess(text.saved)
      setIsNewProfile(false)
      setLocationStatus(savedProfile.locationStatus)
      setLocationInput(savedProfile.formattedAddress || savedProfile.street)
      setLocationPlaceId('')
      navigate('/owner/jobs')
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
      <section className="owner-profile-page" dir={direction}>
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
    <section className="owner-profile-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </div>

      <form
        className="owner-profile-form guided-form"
        onSubmit={handleSubmit}
      >
        <section className="owner-profile-section-card">
          <div className="guided-form-heading">
            <h2>{text.restaurantSection}</h2>
          </div>
          <div className="owner-profile-section-fields">
            <label>
              {fieldLabels.restaurantName}
              <input
                aria-invalid={isMissing('restaurantName')}
                className={isMissing('restaurantName') ? 'field-error' : ''}
                value={form.restaurantName}
                onChange={(event) =>
                  updateField('restaurantName', event.target.value)
                }
              />
              {isMissing('restaurantName') && (
                <span className="field-error-text">
                  {fieldLabels.restaurantName}
                </span>
              )}
            </label>

            <div className="owner-field-wide owner-location-section">
              <div className="restaurant-location-heading">
                <h3>{text.locationTitle}</h3>
                <span
                  className={`restaurant-location-status ${locationStatus}`}
                >
                  {locationStatus === 'verified'
                    ? text.locationVerified
                    : text.locationNeedsVerification}
                </span>
              </div>

              {!isNewProfile ? (
                <>
                  <p className="restaurant-location-address">
                    {locationInput || [form.street, form.city].filter(Boolean).join(', ')}
                  </p>
                  <p className="form-helper-text">{text.locationContact}</p>
                </>
              ) : (
                <>
                  <label>
                    {fieldLabels.city}
                    <input readOnly value="Tel Aviv–Yafo" />
                  </label>
                  <VerifiedAddressAutocomplete
                    language={language}
                    label={language === 'he' ? 'רחוב ומספר' : 'Street and number'}
                    mode="restaurantAddress"
                    placeholder={
                      language === 'he'
                        ? 'התחילו להקליד ובחרו כתובת'
                        : 'Start typing and choose an address'
                    }
                    required
                    value={locationInput}
                    onInputChange={(value) => {
                      setLocationInput(value)
                      setLocationPlaceId('')
                      updateField('street', '')
                    }}
                    onPlaceSelected={(place) => {
                      setLocationInput(place.formattedAddress)
                      setLocationPlaceId(place.placeId)
                      updateField('city', 'Tel Aviv–Yafo')
                      updateField('street', place.formattedAddress)
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        <section className="owner-profile-section-card">
          <div className="guided-form-heading">
            <h2>{text.contactSection}</h2>
          </div>
          <div className="owner-profile-section-fields">
            <label>
              {text.contactPhone}
              <input
                type="tel"
                aria-invalid={isMissing('phoneNumber')}
                className={isMissing('phoneNumber') ? 'field-error' : ''}
                value={form.phoneNumber}
                onChange={(event) =>
                  updateField('phoneNumber', event.target.value)
                }
              />
              {isMissing('phoneNumber') && (
                <span className="field-error-text">
                  {fieldLabels.phoneNumber}
                </span>
              )}
            </label>

            <label>
              {fieldLabels.contactPerson}
              <input
                aria-invalid={isMissing('contactPerson')}
                className={isMissing('contactPerson') ? 'field-error' : ''}
                value={form.contactPerson}
                onChange={(event) =>
                  updateField('contactPerson', event.target.value)
                }
              />
              {isMissing('contactPerson') && (
                <span className="field-error-text">
                  {fieldLabels.contactPerson}
                </span>
              )}
            </label>
          </div>
        </section>

        <section className="owner-profile-section-card">
          <div className="guided-form-heading">
            <h2>{text.descriptionSection}</h2>
          </div>
          <div className="owner-profile-section-fields">
            <label className="owner-field-wide">
              {fieldLabels.description}
              <textarea
                aria-invalid={isMissing('description')}
                className={isMissing('description') ? 'field-error' : ''}
                rows={5}
                value={form.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
              />
              {isMissing('description') && (
                <span className="field-error-text">
                  {fieldLabels.description}
                </span>
              )}
            </label>
          </div>
        </section>

        {error && (
          <div className="message message-error owner-profile-error-summary" role="alert">
            <p>{error}</p>
            {missingFields.length > 0 && (
              <ul>
                {missingFields.map((field) => (
                  <li key={field}>{fieldLabels[field]}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {success && (
          <p className="message message-success" aria-live="polite">
            {success}
          </p>
        )}

        <div className="guided-form-actions">
          <button
            className="ui-button ui-button--primary"
            type="submit"
            disabled={isSaving}
            aria-busy={isSaving}
          >
            {isSaving ? text.saving : text.finish}
          </button>
        </div>
      </form>
    </section>
  )
}

export default OwnerProfilePage
