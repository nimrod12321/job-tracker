import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  createAdminRestaurant,
  getAdminRestaurants,
} from '../services/adminApi'
import type { AdminRestaurant, AdminRestaurantInput } from '../types/admin'
import VerifiedAddressAutocomplete from '../../../components/location/VerifiedAddressAutocomplete'

const emptyRestaurantForm: AdminRestaurantInput = {
  restaurantName: '',
  slug: '',
  contactPerson: '',
  ownerLoginPhone: '',
  phoneNumber: '',
  whatsappNumber: '',
  city: 'Tel Aviv–Yafo',
  street: '',
  description: '',
}

function AdminRestaurantsPage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [form, setForm] = useState<AdminRestaurantInput>(emptyRestaurantForm)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isForbidden = error?.toLowerCase().includes('admin access required')
  const stats = useMemo(
    () => ({
      activeOwners: restaurants.filter((restaurant) => restaurant.hasActiveOwner)
        .length,
      hiringConfigured: restaurants.filter(
        (restaurant) => restaurant.enabledHiringRolesCount > 0,
      ).length,
      withCandidates: restaurants.filter(
        (restaurant) => restaurant.totalCandidatesCount > 0,
      ).length,
      waiting: restaurants.filter(
        (restaurant) => restaurant.ownerUnviewedQrCandidates > 0,
      ).length,
    }),
    [restaurants],
  )

  useEffect(() => {
    let isActive = true

    async function loadRestaurants() {
      try {
        const nextRestaurants = await getAdminRestaurants()

        if (isActive) {
          setRestaurants(nextRestaurants)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error ? error.message : 'Failed to load restaurants',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurants()

    return () => {
      isActive = false
    }
  }, [])

  function updateForm(field: keyof AdminRestaurantInput, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleCreateRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.restaurantName.trim()) {
      setError('Restaurant name is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const restaurant = await createAdminRestaurant(form)

      setForm(emptyRestaurantForm)
      setIsCreateOpen(false)
      navigate(`/admin/restaurants/${restaurant.id}`)
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to create restaurant',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <AdminShell>
        <p className="status-message">Loading restaurants...</p>
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

  return (
    <AdminShell>
      <section className="admin-restaurants-page">
        <div className="admin-page-heading">
          <div>
            <p className="admin-eyebrow">Operations</p>
            <h1>Restaurants</h1>
            <p>Activation, hiring configuration, candidates, and recent activity.</p>
          </div>
          <span>{restaurants.length} restaurants</span>
        </div>

        <div className="admin-stat-grid admin-restaurant-stat-grid">
          <article className="admin-stat-card">
            <span>Active owners</span>
            <strong>{stats.activeOwners}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Hiring configured</span>
            <strong>{stats.hiringConfigured}</strong>
          </article>
          <article className="admin-stat-card">
            <span>With candidates</span>
            <strong>{stats.withCandidates}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Waiting for restaurant</span>
            <strong>{stats.waiting}</strong>
          </article>
        </div>

        {isCreateOpen ? (
          <form
            className="admin-restaurant-form admin-create-restaurant-form"
            onSubmit={handleCreateRestaurant}
          >
            <button
              className="admin-form-close-button peepss-close-button ui-icon-button"
              type="button"
              aria-label="Close create restaurant form"
              onClick={() => {
                setIsCreateOpen(false)
                setForm(emptyRestaurantForm)
                setError(null)
              }}
            >
              ×
            </button>
            <div>
              <h2>Create restaurant</h2>
              <p>
                Only the restaurant name is required. Slug is generated if empty.
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
                placeholder="auto-generated if empty"
              />
            </label>
            <label>
              City
              <input readOnly value="Tel Aviv–Yafo" />
            </label>
            <VerifiedAddressAutocomplete
              language="en"
              label="Street and number"
              mode="restaurantAddress"
              placeholder="Start typing and choose an address"
              value={form.street}
              onInputChange={(value) => {
                updateForm('street', value)
                updateForm('locationPlaceId', '')
              }}
              onPlaceSelected={(place) => {
                updateForm('city', 'Tel Aviv–Yafo')
                updateForm('street', place.formattedAddress)
                updateForm('locationPlaceId', place.placeId)
              }}
            />
            <p className="form-helper-text admin-form-wide">
              Selecting a suggestion verifies the map location. You can also
              create the restaurant now and verify it later.
            </p>
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
                onChange={(event) =>
                  updateForm('phoneNumber', event.target.value)
                }
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
                onChange={(event) =>
                  updateForm('description', event.target.value)
                }
              />
            </label>
            {error && (
              <p className="message message-error admin-form-wide" role="alert">
                {error}
              </p>
            )}
            <button
              className="ui-button ui-button--primary"
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create restaurant'}
            </button>
          </form>
        ) : (
          <button
            className="admin-create-restaurant-card ui-button ui-button--primary"
            type="button"
            onClick={() => {
              setIsCreateOpen(true)
              setError(null)
            }}
          >
            <span>＋</span>
            Create restaurant
          </button>
        )}

        {restaurants.length === 0 ? (
          <div className="empty-state admin-empty-state">
            <h2>No restaurants yet</h2>
            <p>Create the first restaurant shell to get its QR hiring link.</p>
          </div>
        ) : (
          <div className="admin-restaurants-list">
            {restaurants.map((restaurant) => (
              <Link
                aria-label={
                  restaurant.hasNewCandidate
                    ? `${restaurant.restaurantName}, ${restaurant.newCandidateCount} new candidate`
                    : restaurant.restaurantName
                }
                className="admin-restaurant-compact-card"
                key={restaurant.id}
                to={`/admin/restaurants/${restaurant.id}`}
              >
                {restaurant.hasNewCandidate && (
                  <span
                    className="admin-new-candidate-dot"
                    title={`${restaurant.newCandidateCount} new candidate`}
                  />
                )}
                <div className="admin-restaurant-card-title-row">
                  <div>
                    <h2>{restaurant.restaurantName}</h2>
                    <p>
                      {[restaurant.city, restaurant.street]
                        .filter(Boolean)
                        .join(' · ') || 'Location not provided'}
                    </p>
                  </div>
                  <div className="admin-restaurant-state-badges">
                    <span
                      className={`admin-activation-badge ${restaurant.hasActiveOwner ? 'claimed' : 'missing'}`}
                    >
                      {restaurant.hasActiveOwner ? 'Activated' : 'No active owner'}
                    </span>
                    <span
                      className={`admin-hiring-badge ${restaurant.enabledHiringRolesCount > 0 ? 'active' : 'inactive'}`}
                    >
                      {restaurant.enabledHiringRolesCount > 0
                        ? `${restaurant.enabledHiringRolesCount} hiring roles`
                        : 'No roles enabled'}
                    </span>
                  </div>
                </div>
                <div className="admin-restaurant-operational-metrics">
                  <span>
                    <strong>{restaurant.totalCandidatesCount}</strong>
                    candidates
                  </span>
                  <span className={restaurant.ownerUnviewedQrCandidates > 0 ? 'needs-attention' : ''}>
                    <strong>{restaurant.ownerUnviewedQrCandidates}</strong>
                    waiting for restaurant
                  </span>
                  <span>
                    <strong>{restaurant.funnelMetrics.qrScans}</strong>
                    hiring page views
                  </span>
                  <span>
                    <strong>{restaurant.funnelMetrics.completedForms}</strong>
                    external applications
                  </span>
                </div>
                <div className="admin-restaurant-card-footer">
                  <span
                    className={`restaurant-location-status ${restaurant.locationStatus}`}
                  >
                    {restaurant.locationStatus === 'verified'
                      ? 'Location verified'
                      : 'Location needs verification'}
                  </span>
                  <span>
                    Latest activity{' '}
                    {new Date(restaurant.latestActivityAt).toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  )
}

export default AdminRestaurantsPage
