import QRCode from 'qrcode'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRestaurantRoleLabel } from '../../restaurant/types/restaurant'
import AdminShell from '../components/AdminShell'
import {
  getAdminRestaurantDetail,
  markAdminRestaurantSeen,
  updateAdminRestaurant,
} from '../services/adminApi'
import type {
  AdminRestaurantDetail,
  AdminRestaurantInput,
} from '../types/admin'

const emptyRestaurantForm: AdminRestaurantInput = {
  restaurantName: '',
  slug: '',
  contactPerson: '',
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

function AdminRestaurantDetailPage() {
  const { restaurantId = '' } = useParams()
  const [detail, setDetail] = useState<AdminRestaurantDetail | null>(null)
  const [form, setForm] = useState<AdminRestaurantInput>(emptyRestaurantForm)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const restaurant = detail?.restaurant ?? null
  const publicQrLink = useMemo(
    () => getPublicQrLink(restaurant?.slug ?? null),
    [restaurant?.slug],
  )
  const isForbidden = error?.toLowerCase().includes('admin access required')

  useEffect(() => {
    let isActive = true

    async function loadRestaurant() {
      try {
        const nextDetail = await getAdminRestaurantDetail(restaurantId)

        if (isActive) {
          setDetail(nextDetail)
          setForm({
            restaurantName: nextDetail.restaurant.restaurantName,
            slug: nextDetail.restaurant.slug ?? '',
            contactPerson: nextDetail.restaurant.contactPerson,
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

  function handleDownloadQr() {
    if (!qrCodeUrl || !restaurant?.slug) {
      return
    }

    const link = document.createElement('a')

    link.href = qrCodeUrl
    link.download = `peepss-${restaurant.slug}-qr.png`
    link.click()
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
                <dt>Owner</dt>
                <dd>{owner}</dd>
              </div>
              <div>
                <dt>Owner account phone</dt>
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
                type="button"
                disabled={!publicQrLink}
                onClick={() => void handleCopyQrLink()}
              >
                Copy public link
              </button>
              <button
                type="button"
                disabled={!qrCodeUrl}
                onClick={handleDownloadQr}
              >
                Download QR PNG
              </button>
            </div>
          </article>
        </section>

        <form
          className="admin-restaurant-form"
          id="edit"
          onSubmit={handleSaveRestaurant}
        >
          <div className="admin-form-wide">
            <h2>Edit restaurant</h2>
            <p className="admin-warning">
              Changing the slug changes the QR link. שינוי הסלאג משנה את קישור
              ה־QR.
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
            <input
              value={form.city}
              onChange={(event) => updateForm('city', event.target.value)}
            />
          </label>
          <label>
            Street
            <input
              value={form.street}
              onChange={(event) => updateForm('street', event.target.value)}
            />
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
            Restaurant contact phone
            <input
              value={form.phoneNumber}
              onChange={(event) => updateForm('phoneNumber', event.target.value)}
            />
          </label>
          <label className="admin-form-wide">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save restaurant'}
          </button>
        </form>

        <section className="admin-restaurant-panel">
          <h2>Jobs</h2>
          {detail.jobs.length === 0 ? (
            <p>No posted jobs yet.</p>
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
