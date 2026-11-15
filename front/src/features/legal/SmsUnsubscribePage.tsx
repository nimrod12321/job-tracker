import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PeepssLogo from '../../components/brand/PeepssLogo'
import { unsubscribeMarketingSms } from '../auth/services/notificationSettingsApi'
import { useRestaurantLanguage } from '../restaurant/utils/restaurantLanguage'

function SmsUnsubscribePage() {
  const [searchParams] = useSearchParams()
  const { direction, language } = useRestaurantLanguage()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState(false)
  const token = searchParams.get('token')?.trim() ?? ''
  const isHebrew = language === 'he'

  async function handleUnsubscribe() {
    setIsSubmitting(true)
    setError(false)

    try {
      await unsubscribeMarketingSms(token)
      setComplete(true)
    } catch {
      setError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="legal-page sms-unsubscribe-page" dir={direction}>
      <PeepssLogo className="legal-page-logo" />
      <div className="legal-page-card">
        <h1>{isHebrew ? 'הסרה מהודעות שיווקיות' : 'Unsubscribe from promotional SMS'}</h1>
        {complete ? (
          <p className="message message-success" aria-live="polite">
            {isHebrew
              ? 'הבקשה התקבלה. לא יישלחו עוד הודעות SMS שיווקיות לחשבון המקושר, אם הקישור היה תקף.'
              : 'Your request was received. No further promotional SMS will be sent to the linked account if the link was valid.'}
          </p>
        ) : (
          <>
            <p>
              {isHebrew
                ? 'הפעולה מפסיקה רק הודעות שיווקיות. קודי אימות והודעות שירות חיוניות אינם מושפעים.'
                : 'This stops promotional messages only. Verification codes and essential service messages are unaffected.'}
            </p>
            <button
              type="button"
              className="ui-button ui-button--primary"
              disabled={!token || isSubmitting}
              aria-busy={isSubmitting}
              onClick={() => void handleUnsubscribe()}
            >
              {isSubmitting
                ? isHebrew
                  ? 'מעדכן...'
                  : 'Updating...'
                : isHebrew
                  ? 'הסרה מהודעות שיווקיות'
                  : 'Unsubscribe'}
            </button>
          </>
        )}
        {error && (
          <p className="message message-error" role="alert">
            {isHebrew
              ? 'לא הצלחנו לעדכן כרגע. נסו שוב.'
              : 'We could not update the preference. Try again.'}
          </p>
        )}
      </div>
    </section>
  )
}

export default SmsUnsubscribePage
