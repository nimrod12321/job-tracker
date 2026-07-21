import QRCode from 'qrcode'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'
import { downloadQrPoster } from '../../../utils/qrPoster'
import AdminShell from '../components/AdminShell'
import {
  deleteAdminRestaurant,
  getAdminRestaurantDetail,
  markAdminRestaurantSeen,
  regenerateAdminRestaurantClaim,
  updateAdminRestaurant,
  updateAdminRestaurantLocation,
} from '../services/adminApi'
import type {
  AdminRestaurantDetail,
  AdminRestaurantInput,
} from '../types/admin'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'

const emptyRestaurantForm: AdminRestaurantInput = {
  restaurantName: '',
  slug: '',
  contactPerson: '',
  ownerLoginPhone: '',
  phoneNumber: '',
  whatsappNumber: '',
  city: '',
  street: '',
  description: '',
}

function getPublicQrLink(slug: string | null) {
  if (!slug) {
    return ''
  }

  return `${window.location.origin}/r/${slug}`
}

function getActivationLink(slug: string | null, token: string | null) {
  if (!slug || !token) {
    return ''
  }

  return `${window.location.origin}/claim/${slug}?token=${encodeURIComponent(token)}`
}

function formatAdminMetricDate(value: string | null) {
  if (!value) {
    return 'Not yet'
  }

  return new Date(value).toLocaleString()
}

function AdminRestaurantDetailPage() {
  const navigate = useNavigate()
  const { restaurantId = '' } = useParams()
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
  const [form, setForm] = useState<AdminRestaurantInput>(emptyRestaurantForm)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locationInput, setLocationInput] = useState('')
  const [locationPlaceId, setLocationPlaceId] = useState('')
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const restaurant = detail?.restaurant ?? null
  const publicQrLink = useMemo(
    () => getPublicQrLink(restaurant?.slug ?? null),
    [restaurant?.slug],
  )
  const activationLink = useMemo(
    () =>
      getActivationLink(
        restaurant?.slug ?? null,
        restaurant?.claim.token ?? null,
      ),
    [restaurant?.claim.token, restaurant?.slug],
  )
  const isForbidden = error?.toLowerCase().includes('admin access required')

  useEffect(() => {
    let isActive = true

    async function loadRestaurant() {
      try {
        const nextDetail = await getAdminRestaurantDetail(restaurantId)

        if (isActive) {
          setDetail(nextDetail)
          setLocationInput(
            nextDetail.restaurant.formattedAddress ||
              nextDetail.restaurant.street,
          )
          setForm({
            restaurantName: nextDetail.restaurant.restaurantName,
            slug: nextDetail.restaurant.slug ?? '',
            contactPerson: nextDetail.restaurant.contactPerson,
            ownerLoginPhone: nextDetail.restaurant.ownerLoginPhone ?? '',
            phoneNumber: nextDetail.restaurant.phoneNumber,
            whatsappNumber: nextDetail.restaurant.whatsappNumber,
            city: nextDetail.restaurant.city,
            street: nextDetail.restaurant.street,
            description: nextDetail.restaurant.description,
          })
        }

        try {
          await markAdminRestaurantSeen(restaurantId)
        } catch {
          // Viewing should not fail the detail page if read-state tracking fails.
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load restaurant',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurant()

    return () => {
      isActive = false
    }
  }, [restaurantId])

  useEffect(() => {
    let isActive = true

    async function generateQrCode() {
      if (!publicQrLink) {
        setQrCodeUrl('')
        return
      }

      try {
        const dataUrl = await QRCode.toDataURL(publicQrLink, {
          margin: 1,
          width: 320,
          color: {
            dark: '#1f1d1e',
            light: '#fffaf3',
          },
        })

        if (isActive) {
          setQrCodeUrl(dataUrl)
        }
      } catch {
        if (isActive) {
          setQrCodeUrl('')
        }
      }
    }

    void generateQrCode()

    return () => {
      isActive = false
    }
  }, [publicQrLink])

  function updateForm(field: keyof AdminRestaurantInput, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleCopyQrLink() {
    if (!publicQrLink) {
      return
    }

    await navigator.clipboard.writeText(publicQrLink)
    setMessage('QR link copied.')
  }

  async function handleDownloadQrPoster() {
    if (!publicQrLink || !restaurant?.slug) {
      return
    }

    try {
      await downloadQrPoster({
        publicUrl: publicQrLink,
        slug: restaurant.slug,
      })
      setError(null)
    } catch {
      setError('Failed to download QR poster.')
    }
  }

  async function handleCopyActivationLink() {
    if (!activationLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(activationLink)
      setError(null)
      setMessage('Activation link copied.')
    } catch {
      setError('Failed to copy activation link.')
    }
  }

  async function handleRegenerateActivationLink() {
    if (!restaurant || restaurant.claim.status === 'claimed') {
      return
    }

    if (
      restaurant.claim.status === 'available' &&
      !window.confirm(
        'Create a new activation link? The previous link will stop working.',
      )
    ) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const claim = await regenerateAdminRestaurantClaim(restaurant.id)

      setDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              restaurant: {
                ...currentDetail.restaurant,
                claim,
              },
            }
          : currentDetail,
      )
      setMessage('A new activation link is ready. The previous link is invalid.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to regenerate activation link',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!restaurant) {
      return
    }

    if (!form.restaurantName.trim()) {
      setError('Restaurant name is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const updatedRestaurant = await updateAdminRestaurant(restaurant.id, form)

      setDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              restaurant: updatedRestaurant,
              ownerUser: updatedRestaurant.ownerUser,
              ownerAccountPhone: updatedRestaurant.ownerLoginPhone,
              restaurantContactPhone: updatedRestaurant.phoneNumber,
            }
          : currentDetail,
      )
      setMessage('Restaurant updated.')
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to update restaurant',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSaveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!restaurant || !locationPlaceId) {
      setError('Choose a Tel Aviv–Yafo address from the suggestions.')
      return
    }

    setIsSavingLocation(true)
    setError(null)
    setMessage(null)

    try {
      const updatedRestaurant = await updateAdminRestaurantLocation(
        restaurant.id,
        locationPlaceId,
      )

      setDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              restaurant: updatedRestaurant,
            }
          : currentDetail,
      )
      setForm((currentForm) => ({
        ...currentForm,
        city: updatedRestaurant.city,
        street: updatedRestaurant.street,
      }))
      setLocationInput(
        updatedRestaurant.formattedAddress || updatedRestaurant.street,
      )
      setLocationPlaceId('')
      setMessage('Restaurant location verified.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to update restaurant location',
      )
    } finally {
      setIsSavingLocation(false)
    }
  }

  async function handleDeleteRestaurant() {
    if (!restaurant) {
      return
    }

    const shouldDelete = window.confirm(
      'Delete this restaurant?\nThis may affect the restaurant’s jobs and candidates.',
    )

    if (!shouldDelete) {
      return
    }

    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      await deleteAdminRestaurant(restaurant.id)
      navigate('/admin/restaurants', { replace: true })
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to delete restaurant',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminShell>
        <p className="status-message">Loading restaurant...</p>
      </AdminShell>
    )
  }

  if (isForbidden) {
    return (
      <section className="admin-forbidden-page">
        <div className="admin-forbidden-card">
          <h1>Admin access required</h1>
          <p>This page is only available to admin users.</p>
        </div>
      </section>
    )
  }

  if (!detail || !restaurant) {
    return (
      <AdminShell>
        <div className="empty-state admin-empty-state">
          <h1>Restaurant not found</h1>
          <Link to="/admin/restaurants">Back to restaurants</Link>
        </div>
      </AdminShell>
    )
  }

  const location =
    [restaurant.city, restaurant.street].filter(Boolean).join(' · ') ||
    'No location yet'
  const owner =
    detail.ownerUser?.fullName ||
    detail.ownerUser?.phoneNumber ||
    detail.ownerUser?.email ||
    'No owner linked yet'
  const funnelMetrics = restaurant.funnelMetrics

  return (
    <AdminShell>
      <section className="admin-restaurants-page">
        <div className="admin-page-heading">
          <div>
            <Link className="admin-back-link" to="/admin/restaurants">
              ← Restaurants
            </Link>
            <h1>{restaurant.restaurantName}</h1>
            <p>{location}</p>
          </div>
          <span>{restaurant.slug || 'No slug'}</span>
        </div>

        {message && <p className="message message-success">{message}</p>}
        {error && (
          <p className="message message-error" role="alert">
            {error}
          </p>
        )}

        <section className="admin-restaurant-panel admin-funnel-panel">
          <div>
            <h2>QR funnel analytics</h2>
            <p>Lightweight pilot metrics from the public QR application flow.</p>
          </div>
          <div className="admin-funnel-grid">
            <article className="admin-funnel-card">
              <span>QR scans</span>
              <strong>{funnelMetrics.qrScans}</strong>
              <p>{funnelMetrics.uniqueQrVisitors} unique sessions</p>
            </article>
            <article className="admin-funnel-card">
              <span>Started form</span>
              <strong>{funnelMetrics.startedForms}</strong>
              <p>Name or phone step was started</p>
            </article>
            <article className="admin-funnel-card">
              <span>Completed form</span>
              <strong>{funnelMetrics.completedForms}</strong>
              <p>{funnelMetrics.newCandidates} new for admin</p>
            </article>
            <article className="admin-funnel-card">
              <span>Owner viewed</span>
              <strong>
                {funnelMetrics.ownerViewedCompletedForms}/
                {funnelMetrics.completedForms}
              </strong>
              <p>Applications opened by owner/team</p>
            </article>
          </div>
          <dl className="admin-funnel-timestamps">
            <div>
              <dt>Last scan</dt>
              <dd>{formatAdminMetricDate(funnelMetrics.lastScanAt)}</dd>
            </div>
            <div>
              <dt>Last completed form</dt>
              <dd>{formatAdminMetricDate(funnelMetrics.lastCompletedAt)}</dd>
            </div>
            <div>
              <dt>Last owner view</dt>
              <dd>{formatAdminMetricDate(funnelMetrics.lastOwnerViewAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="admin-restaurant-detail-grid">
          <article className="admin-restaurant-panel">
            <h2>Restaurant summary</h2>
            <dl className="admin-lead-details">
              <div>
                <dt>Name</dt>
                <dd>{restaurant.restaurantName}</dd>
              </div>
              <div>
                <dt>Slug</dt>
                <dd>{restaurant.slug || 'Not set'}</dd>
              </div>
              <div>
                <dt>QR link</dt>
                <dd>{publicQrLink || 'Slug required'}</dd>
              </div>
              <div>
                <dt>QR roles</dt>
                <dd>
                  {restaurant.qrEnabledRoles.length > 0
                    ? restaurant.qrEnabledRoles
                        .map((role) => getRestaurantRoleLabel(role))
                        .join(', ')
                    : 'Not hiring right now'}
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{owner}</dd>
              </div>
              <div>
                <dt>Owner login phone</dt>
                <dd>{detail.ownerAccountPhone || 'No owner phone'}</dd>
              </div>
              <div>
                <dt>Restaurant contact phone</dt>
                <dd>{detail.restaurantContactPhone || 'No contact phone'}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(restaurant.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </article>

          <article className="admin-restaurant-panel admin-qr-panel">
            <h2>QR code</h2>
            {qrCodeUrl ? (
              <img
                className="owner-qr-image"
                src={qrCodeUrl}
                alt={`QR code for ${restaurant.restaurantName}`}
              />
            ) : (
              <p>No QR code available until the restaurant has a slug.</p>
            )}
            {publicQrLink && (
              <p className="owner-qr-link admin-qr-link" dir="ltr">
                {publicQrLink}
              </p>
            )}
            <div className="admin-actions">
              <button
                className="ui-button ui-button--tertiary"
                type="button"
                disabled={!publicQrLink}
                onClick={() => void handleCopyQrLink()}
              >
                Copy public link
              </button>
              <button
                className="ui-button ui-button--primary"
                type="button"
                disabled={!publicQrLink}
                onClick={() => void handleDownloadQrPoster()}
              >
                Download QR poster
              </button>
            </div>
          </article>
        </section>

        <section className="admin-restaurant-panel admin-activation-panel">
          <div className="admin-activation-heading">
            <div>
              <h2>Restaurant activation</h2>
              <p>
                This private link can be sent to the restaurant owner or
                manager to activate access to the restaurant.
              </p>
            </div>
            <span
              className={`admin-activation-badge ${restaurant.claim.status}`}
            >
              {restaurant.claim.status === 'claimed'
                ? 'Activated'
                : restaurant.claim.status === 'available'
                  ? 'Ready to send'
                  : 'No active link'}
            </span>
          </div>

          {activationLink && (
            <p className="admin-activation-link" dir="ltr">
              {activationLink}
            </p>
          )}

          {restaurant.claim.status === 'claimed' ? (
            <p>
              This restaurant already has an active owner. First-owner link
              regeneration is disabled.
            </p>
          ) : (
            <div className="admin-actions">
              <button
                className="ui-button ui-button--tertiary"
                type="button"
                disabled={!activationLink || isSubmitting}
                onClick={() => void handleCopyActivationLink()}
              >
                Copy activation link
              </button>
              <button
                className="ui-button ui-button--secondary"
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleRegenerateActivationLink()}
              >
                {restaurant.claim.status === 'missing'
                  ? 'Create activation link'
                  : 'Regenerate activation link'}
              </button>
            </div>
          )}
        </section>

        <form
          className="admin-restaurant-panel admin-location-panel"
          onSubmit={handleSaveLocation}
        >
          <div className="admin-form-wide restaurant-location-heading">
            <div>
              <h2>Restaurant location</h2>
              <p>
                Select a real Tel Aviv–Yafo street and number. Only verified
                restaurants can appear on the worker map.
              </p>
            </div>
            <span
              className={`restaurant-location-status ${restaurant.locationStatus}`}
            >
              {restaurant.locationStatus === 'verified'
                ? 'Location verified'
                : 'Location needs verification'}
            </span>
          </div>
          <VerifiedAddressAutocomplete
            language="en"
            label="Street and number"
            mode="restaurantAddress"
            placeholder="Start typing and choose an address"
            value={locationInput}
            onInputChange={(value) => {
              setLocationInput(value)
              setLocationPlaceId('')
            }}
            onPlaceSelected={(place) => {
              setLocationInput(place.formattedAddress)
              setLocationPlaceId(place.placeId)
            }}
          />
          <button
            className="ui-button ui-button--secondary"
            type="submit"
            disabled={!locationPlaceId || isSavingLocation}
          >
            {isSavingLocation ? 'Saving...' : 'Save verified location'}
          </button>
        </form>

        <form
          className="admin-restaurant-form"
          id="edit"
          onSubmit={handleSaveRestaurant}
        >
          <div className="admin-form-wide">
            <h2>Edit restaurant</h2>
            <p className="admin-warning">
              Changing the slug changes the QR link.
            </p>
          </div>
          <label>
            Restaurant name *
            <input
              value={form.restaurantName}
              onChange={(event) =>
                updateForm('restaurantName', event.target.value)
              }
              required
            />
          </label>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(event) => updateForm('slug', event.target.value)}
            />
          </label>
          <label>
            City
            <input readOnly value={form.city} />
          </label>
          <label>
            Street
            <input readOnly value={form.street} />
          </label>
          <label>
            Contact person
            <input
              value={form.contactPerson}
              onChange={(event) =>
                updateForm('contactPerson', event.target.value)
              }
            />
          </label>
          <label>
            Owner login phone
            <input
              value={form.ownerLoginPhone}
              onChange={(event) =>
                updateForm('ownerLoginPhone', event.target.value)
              }
              placeholder="0501234567"
            />
            <small>
              The owner uses this phone to log in and access this restaurant.
            </small>
          </label>
          <label>
            Restaurant contact phone
            <input
              value={form.phoneNumber}
              onChange={(event) => updateForm('phoneNumber', event.target.value)}
            />
            <small>
              Public/contact number only. This does not grant owner access.
            </small>
          </label>
          <label className="admin-form-wide">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
            />
          </label>
          <button
            className="ui-button ui-button--primary"
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save restaurant'}
          </button>
        </form>

        <section className="admin-restaurant-panel admin-danger-zone">
          <div>
            <h2>Delete restaurant</h2>
            <p>
              Delete this restaurant? This may affect the restaurant’s jobs and
              candidates.
            </p>
          </div>
          <button
            className="admin-danger-button ui-button ui-button--destructive"
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleDeleteRestaurant()}
          >
            Delete restaurant
          </button>
        </section>

        <section className="admin-restaurant-panel">
          <h2>Jobs</h2>
          {detail.jobs.length === 0 ? (
            <p>No jobs yet.</p>
          ) : (
            <div className="admin-compact-list">
              {detail.jobs.map((job) => (
                <article key={job.id}>
                  <div>
                    <strong>{getRestaurantRoleLabel(job.role)}</strong>
                    <p>{job.shiftInfo || job.description || 'No details'}</p>
                  </div>
                  <span className={`application-status ${job.isActive ? 'relevant' : 'rejected'}`}>
                    {job.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span>{job.applicationsCount} applications</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-restaurant-panel">
          <h2>QR applications</h2>
          {detail.qrLeads.length === 0 ? (
            <p>No QR applications yet.</p>
          ) : (
            <div className="admin-compact-list">
              {detail.qrLeads.map((lead) => (
                <article key={lead.id}>
                  <div>
                    <strong>{lead.fullName}</strong>
                    <p>
                      {lead.phoneNumber} · Age {lead.age ?? 'not provided'}
                    </p>
                    <p>
                      {lead.wantedRoles
                        .map((role) => getRestaurantRoleLabel(role))
                        .join(', ')}
                    </p>
                    <p>{lead.availability || 'No availability provided'}</p>
                  </div>
                  <span className={`admin-status-badge ${lead.status}`}>
                    {lead.status}
                  </span>
                  <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-restaurant-panel">
          <h2>Swipe/job applications</h2>
          {detail.applications.length === 0 ? (
            <p>No swipe applications yet.</p>
          ) : (
            <div className="admin-compact-list">
              {detail.applications.map((application) => (
                <article key={application.id}>
                  <div>
                    <strong>{application.worker.fullName || 'Candidate'}</strong>
                    <p>
                      {application.worker.phoneNumber || 'No phone'} ·{' '}
                      {getRestaurantRoleLabel(application.job.role)}
                    </p>
                  </div>
                  <span className={`application-status ${application.status}`}>
                    {application.status}
                  </span>
                  <span>
                    {new Date(application.createdAt).toLocaleDateString()}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  )
}

export default AdminRestaurantDetailPage
