import { useEffect, useState } from 'react'
import { getRestaurantMatches } from '../services/restaurantApi'
import {
  RESTAURANT_ROLES,
  type RestaurantMatch,
} from '../types/restaurant'

function getRoleLabel(role: RestaurantMatch['job']['role']) {
  return (
    RESTAURANT_ROLES.find((option) => option.value === role)?.label ?? role
  )
}

function RestaurantMatchesPage() {
  const [matches, setMatches] = useState<RestaurantMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadMatches() {
      try {
        const restaurantMatches = await getRestaurantMatches()

        if (isActive) {
          setMatches(restaurantMatches)
        }
      } catch (error) {
        if (isActive) {
          setError(
            error instanceof Error
              ? error.message
              : 'Failed to load restaurant matches',
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadMatches()

    return () => {
      isActive = false
    }
  }, [])

  if (isLoading) {
    return (
      <section className="restaurant-matches-page">
        <div className="page-header">
          <div>
            <h1>Matches</h1>
            <p>Restaurants that selected your application.</p>
          </div>
        </div>
        <p className="status-message">Loading matches...</p>
      </section>
    )
  }

  return (
    <section className="restaurant-matches-page">
      <div className="page-header">
        <div>
          <h1>Matches</h1>
          <p>Restaurants that selected your application.</p>
        </div>
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {matches.length === 0 ? (
        <div className="empty-state restaurant-matches-empty">
          <h2>No matches yet.</h2>
          <p>When a restaurant selects you, it will appear here.</p>
        </div>
      ) : (
        <div className="restaurant-match-list">
          {matches.map((match) => {
            const whatsappNumber = match.job.contactWhatsapp.replace(
              /\D/g,
              '',
            )

            return (
              <article className="restaurant-match-card" key={match.id}>
                <p className="restaurant-match-name">
                  {match.job.restaurantName}
                </p>
                <h2>{getRoleLabel(match.job.role)}</h2>
                <p className="restaurant-match-address">
                  {[match.job.city, match.job.street]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                {match.job.shiftInfo && (
                  <div>
                    <strong>Shift</strong>
                    <p>{match.job.shiftInfo}</p>
                  </div>
                )}

                {match.job.requirements && (
                  <div>
                    <strong>Requirements</strong>
                    <p>{match.job.requirements}</p>
                  </div>
                )}

                {(match.job.contactPhone || whatsappNumber) && (
                  <div className="restaurant-match-contact">
                    {match.job.contactPhone && (
                      <a href={`tel:${match.job.contactPhone}`}>Call</a>
                    )}
                    {whatsappNumber && (
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default RestaurantMatchesPage
