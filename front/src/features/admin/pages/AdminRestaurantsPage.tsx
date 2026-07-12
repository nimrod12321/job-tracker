import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminShell from '../components/AdminShell'
import {
  createAdminRestaurant,
  getAdminRestaurants,
} from '../services/adminApi'
import type { AdminRestaurant, AdminRestaurantInput } from '../types/admin'

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

function AdminRestaurantsPage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([])
  const [form, setForm] = useState<AdminRestaurantInput>(emptyRestaurantForm)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isForbidden = error?.toLowerCase().includes('admin access required')

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
            <h1>Restaurants</h1>
            <p>Create and manage restaurants using Peepss QR hiring.</p>
          </div>
          <span>{restaurants.length} restaurants</span>
        </div>

        {isCreateOpen ? (
          <form
            className="admin-restaurant-form admin-create-restaurant-form"
            onSubmit={handleCreateRestaurant}
          >
            <button
              className="admin-form-close-button peepss-close-button"
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
                onChange={(event) =>
                  updateForm('phoneNumber', event.target.value)
                }
              />
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
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create restaurant'}
            </button>
          </form>
        ) : (
          <button
            className="admin-create-restaurant-card"
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
                <h2>{restaurant.restaurantName}</h2>
                <div
                  className="admin-restaurant-funnel-mini"
                  aria-label={`QR funnel: ${restaurant.funnelMetrics.qrScans} scans, ${restaurant.funnelMetrics.startedForms} started, ${restaurant.funnelMetrics.completedForms} completed`}
                >
                  <span>{restaurant.funnelMetrics.qrScans} scans</span>
                  <span>{restaurant.funnelMetrics.startedForms} started</span>
                  <span>{restaurant.funnelMetrics.completedForms} done</span>
                  <span>
                    {restaurant.funnelMetrics.ownerViewedCompletedForms}/
                    {restaurant.funnelMetrics.completedForms} viewed
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
