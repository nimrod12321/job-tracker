import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  createAdditionalOwnerRestaurant,
  getOwnerProfile,
  saveOwnerProfile,
} from '../services/ownerApi'
import type { OwnerProfile, OwnerProfileInput } from '../types/owner'
import {
  getRestaurantVenueTypeLabel,
  RESTAURANT_VENUE_TYPES,
  type RestaurantVenueType,
} from '../../restaurant/types/restaurant'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'
import { useOwnerRestaurant } from '../context/ownerRestaurantState'
import SmsNotificationSettings from '../../../components/settings/SmsNotificationSettings'

const emptyProfile: OwnerProfileInput = {
  restaurantName: '',
  contactPerson: '',
  city: '',
  street: '',
  description: '',
  venueTypes: [],
  hiringManagerPhone: '',
}

type ProfileField = Exclude<
  keyof OwnerProfileInput,
  | 'locationPlaceId'
  | 'venueTypes'
  | 'hiringManagerPhone'
>

type OwnerProfilePageProps = {
  mode?: 'profile' | 'createAdditional'
}

function hasCompletedOwnerProfileDetails(profile: OwnerProfile) {
  return Boolean(
    profile.restaurantName.trim() &&
      profile.slug?.trim() &&
      (profile.city.trim() || profile.street.trim()),
  )
}

function OwnerProfilePage({ mode = 'profile' }: OwnerProfilePageProps) {
  const isCreatingAdditionalRestaurant = mode === 'createAdditional'
  const navigate = useNavigate()
  const {
    consumePostAuthProfile,
    selectedRestaurantId,
    refreshRestaurants,
  } = useOwnerRestaurant()
  const { direction, language } = useRestaurantLanguage()
  const [form, setForm] = useState<OwnerProfileInput>(emptyProfile)
  const [isLoading, setIsLoading] = useState(
    !isCreatingAdditionalRestaurant,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<ProfileField[]>([])
  const [success, setSuccess] = useState<string | null>(null)
  const [isNewProfile, setIsNewProfile] = useState(true)
  const [showNotificationSettings, setShowNotificationSettings] =
    useState(false)
  const [locationStatus, setLocationStatus] =
    useState<'unverified' | 'verified'>('unverified')
  const [locationInput, setLocationInput] = useState('')
  const [locationPlaceId, setLocationPlaceId] = useState('')

  const text = {
    title: isCreatingAdditionalRestaurant
      ? language === 'he'
        ? 'הוספת מסעדה'
        : 'Add restaurant'
      : language === 'he'
        ? 'פרופיל המסעדה שלך'
        : 'Your restaurant profile',
    subtitle:
      isCreatingAdditionalRestaurant
        ? language === 'he'
          ? 'השלימו את פרטי המסעדה החדשה.'
          : 'Complete the details for the new restaurant.'
        : language === 'he'
          ? 'נשתמש בזה כדי לנהל משרות ברורות ומהירות.'
          : 'We use this to manage clear, fast job posts.',
    loading:
      language === 'he'
        ? 'טוען פרופיל מסעדה...'
        : 'Loading restaurant profile...',
    finish: isCreatingAdditionalRestaurant
      ? language === 'he'
        ? 'הוספת המסעדה והמשך'
        : 'Add restaurant and continue'
      : language === 'he'
        ? 'שמירה והמשך למשרות'
        : 'Save and continue to jobs',
    saving: language === 'he' ? 'שומר...' : 'Saving...',
    saved: isCreatingAdditionalRestaurant
      ? language === 'he'
        ? 'המסעדה נוספה.'
        : 'Restaurant added.'
      : language === 'he'
        ? 'פרופיל המסעדה נשמר.'
        : 'Restaurant profile saved.',
    restaurantSection:
      language === 'he' ? 'פרטי המסעדה' : 'Restaurant details',
    venueTypes:
      language === 'he' ? 'סוג המקום' : 'Business type',
    venueTypesHelp:
      language === 'he'
        ? 'חובה לבחור לפחות סוג אחד. אפשר לבחור יותר מסוג אחד.'
        : 'Choose at least one. You can select more than one.',
    hiringManager:
      language === 'he'
        ? 'הוספת מנהל/ת גיוס (אופציונלי)'
        : 'Add a hiring manager (optional)',
    hiringManagerHelp:
      language === 'he'
        ? 'מועמדים שתבחר יקבלו את המספר של מנהל הגיוס, או את שלך אם אין מנהל פעיל.'
        : 'Candidates you select will receive the hiring manager’s number, or yours if no manager is active.',
    venueTypesRequired:
      language === 'he'
        ? 'צריך לבחור לפחות סוג מקום אחד.'
        : 'Choose at least one business type.',
    contactSection:
      language === 'he' ? 'יצירת קשר' : 'Contact',
    descriptionSection:
      language === 'he' ? 'על המסעדה' : 'About the restaurant',
    address: language === 'he' ? 'כתובת' : 'Address',
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
        ? 'יש לבחור רחוב ומספר תקינים בישראל.'
        : 'Choose a valid Israeli street and number.',
  }

  const fieldLabels: Record<ProfileField, string> = {
    restaurantName: language === 'he' ? 'שם המסעדה' : 'Restaurant name',
    contactPerson: language === 'he' ? 'איש קשר' : 'Contact person',
    city: language === 'he' ? 'עיר' : 'City',
    street: text.address,
    description: language === 'he' ? 'על המסעדה' : 'About the restaurant',
  }

  useEffect(() => {
    let isActive = true

    if (isCreatingAdditionalRestaurant) {
      return () => {
        isActive = false
      }
    }

    async function loadProfile() {
      setIsLoading(true)
      setError(null)
      setSuccess(null)
      setForm(emptyProfile)
      setIsNewProfile(true)
      setShowNotificationSettings(false)
      setLocationStatus('unverified')
      setLocationInput('')
      setLocationPlaceId('')

      try {
        const postAuthProfile = consumePostAuthProfile(selectedRestaurantId)
        const profile = postAuthProfile
          ? postAuthProfile.profile
          : await getOwnerProfile(selectedRestaurantId ?? undefined)

        if (isActive && profile) {
          setIsNewProfile(false)
          setShowNotificationSettings(
            hasCompletedOwnerProfileDetails(profile),
          )
          setLocationStatus(profile.locationStatus)
          setLocationInput(profile.formattedAddress || profile.street)
          setForm({
            restaurantName: profile.restaurantName,
            contactPerson: profile.contactPerson,
            city: profile.city,
            street: profile.street,
            description: profile.description,
            venueTypes: profile.venueTypes,
            hiringManagerPhone: '',
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
  }, [
    isCreatingAdditionalRestaurant,
    consumePostAuthProfile,
    selectedRestaurantId,
  ])

  function updateField(field: ProfileField, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setMissingFields((currentFields) =>
      currentFields.filter((currentField) => currentField !== field),
    )
  }

  function toggleVenueType(venueType: RestaurantVenueType) {
    setForm((currentForm) => ({
      ...currentForm,
      venueTypes: currentForm.venueTypes.includes(venueType)
        ? currentForm.venueTypes.filter(
            (currentVenueType) => currentVenueType !== venueType,
          )
        : [...currentForm.venueTypes, venueType],
    }))
  }

  function getMissingProfileFields() {
    const requiredFields: ProfileField[] = isNewProfile
      ? ['restaurantName']
      : ['restaurantName', 'city', 'street']

    return requiredFields.filter((field) => !form[field].trim())
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

    if (isNewProfile && form.venueTypes.length === 0) {
      setError(text.venueTypesRequired)
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
        ...(locationPlaceId ? { locationPlaceId } : {}),
      }
      const savedProfile = isCreatingAdditionalRestaurant
        ? await createAdditionalOwnerRestaurant(
            profileInput,
            selectedRestaurantId!,
          )
        : await saveOwnerProfile(
            profileInput,
            selectedRestaurantId ?? undefined,
          )

      if (isCreatingAdditionalRestaurant) {
        const nextRestaurants = await refreshRestaurants(savedProfile.id)

        if (
          !nextRestaurants.some(
            (restaurant) => restaurant.restaurantId === savedProfile.id,
          )
        ) {
          throw new Error(
            language === 'he'
              ? 'המסעדה נוצרה אך לא ניתן היה לבחור בה. נסו לרענן את העמוד.'
              : 'The restaurant was created but could not be selected. Refresh and try again.',
          )
        }

        navigate('/owner/jobs')
        return
      }

      setForm({
        restaurantName: savedProfile.restaurantName,
        contactPerson: savedProfile.contactPerson,
        city: savedProfile.city,
        street: savedProfile.street,
        description: savedProfile.description,
        venueTypes: savedProfile.venueTypes,
        hiringManagerPhone: '',
      })
      setSuccess(text.saved)
      setIsNewProfile(false)
      setLocationStatus(savedProfile.locationStatus)
      setLocationInput(savedProfile.formattedAddress || savedProfile.street)
      setLocationPlaceId('')
      await refreshRestaurants(savedProfile.id)
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

            <fieldset className="restaurant-role-options owner-field-wide owner-venue-type-options">
              <legend>{text.venueTypes}</legend>
              <p className="form-helper-text">{text.venueTypesHelp}</p>
              <div>
                {RESTAURANT_VENUE_TYPES.map((venueType) => (
                  <label key={venueType.value}>
                    <input
                      type="checkbox"
                      checked={form.venueTypes.includes(venueType.value)}
                      onChange={() => toggleVenueType(venueType.value)}
                    />
                    <span>
                      {getRestaurantVenueTypeLabel(
                        venueType.value,
                        language,
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

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
                      updateField('street', place.formattedAddress)
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </section>

        {!isNewProfile ? (
          <section className="owner-profile-section-card">
            <div className="guided-form-heading">
              <h2>{text.contactSection}</h2>
            </div>
            <div className="owner-profile-section-fields">
              <label>
                {fieldLabels.contactPerson}
                <input
                  value={form.contactPerson}
                  onChange={(event) =>
                    updateField('contactPerson', event.target.value)
                  }
                />
              </label>
            </div>
          </section>
        ) : (
          <section className="owner-profile-section-card">
            <div className="guided-form-heading">
              <h2>{text.contactSection}</h2>
            </div>
            <div className="owner-profile-section-fields">
              <label className="owner-field-wide">
                {text.hiringManager}
                <input
                  type="tel"
                  inputMode="tel"
                  value={form.hiringManagerPhone}
                  placeholder="050-123-4567"
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      hiringManagerPhone: event.target.value,
                    }))
                  }
                />
                <span className="form-helper-text">
                  {text.hiringManagerHelp}
                </span>
              </label>
            </div>
          </section>
        )}

        <section className="owner-profile-section-card">
          <div className="guided-form-heading">
            <h2>{text.descriptionSection}</h2>
          </div>
          <div className="owner-profile-section-fields">
            <label className="owner-field-wide">
              {fieldLabels.description}
              <span className="form-helper-text">
                {language === 'he' ? 'לא חובה' : 'Optional'}
              </span>
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
              />
            </label>
          </div>
        </section>

        {!isCreatingAdditionalRestaurant && showNotificationSettings && (
          <SmsNotificationSettings
            className="owner-profile-section-card"
            showOwnerControls
          />
        )}

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
