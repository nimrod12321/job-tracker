import { useEffect, useState } from 'react'
import RestaurantLanguageToggle from '../components/RestaurantLanguageToggle'
import { getRestaurantMatches } from '../services/restaurantApi'
import {
  getRestaurantRoleLabel,
  type RestaurantMatch,
} from '../types/restaurant'
import { useRestaurantLanguage } from '../utils/restaurantLanguage'

function RestaurantMatchesPage() {
  const { direction, language } = useRestaurantLanguage()
  const [matches, setMatches] = useState<RestaurantMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const text = {
    title: language === 'he' ? 'התאמות' : 'Matches',
    subtitle:
      language === 'he'
        ? 'מסעדות שבחרו את הבקשה שלך.'
        : 'Restaurants that selected your application.',
    loading: language === 'he' ? 'טוען התאמות...' : 'Loading matches...',
    emptyTitle: language === 'he' ? 'אין התאמות עדיין.' : 'No matches yet.',
    emptyHint:
      language === 'he'
        ? 'כשהמסעדה תבחר אותך, זה יופיע כאן.'
        : 'When a restaurant selects you, it will appear here.',
    shift: language === 'he' ? 'משמרות' : 'Shift',
    requirements: language === 'he' ? 'דרישות' : 'Requirements',
    call: language === 'he' ? 'טלפון' : 'Call',
    whatsapp: language === 'he' ? 'וואטסאפ' : 'WhatsApp',
  }

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
      <section className="restaurant-matches-page" dir={direction}>
        <div className="page-header">
          <div>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
          </div>
          <RestaurantLanguageToggle />
        </div>
        <p className="status-message">{text.loading}</p>
      </section>
    )
  }

  return (
    <section className="restaurant-matches-page" dir={direction}>
      <div className="page-header">
        <div>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
        <RestaurantLanguageToggle />
      </div>

      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}

      {matches.length === 0 ? (
        <div className="empty-state restaurant-matches-empty">
          <h2>{text.emptyTitle}</h2>
          <p>{text.emptyHint}</p>
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
                <h2>{getRestaurantRoleLabel(match.job.role, language)}</h2>
                <p className="restaurant-match-address">
                  {[match.job.city, match.job.street]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                {match.job.shiftInfo && (
                  <div>
                    <strong>{text.shift}</strong>
                    <p>{match.job.shiftInfo}</p>
                  </div>
                )}

                {match.job.requirements && (
                  <div>
                    <strong>{text.requirements}</strong>
                    <p>{match.job.requirements}</p>
                  </div>
                )}

                {(match.job.contactPhone || whatsappNumber) && (
                  <div className="restaurant-match-contact">
                    {match.job.contactPhone && (
                      <a href={`tel:${match.job.contactPhone}`}>
                        {text.call}
                      </a>
                    )}
                    {whatsappNumber && (
                      <a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {text.whatsapp}
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
