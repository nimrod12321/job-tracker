import { useEffect, useState } from 'react'
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '../../features/auth/services/notificationSettingsApi'
import { useRestaurantLanguage } from '../../features/restaurant/utils/restaurantLanguage'

type SmsNotificationSettingsProps = {
  className: string
  showOwnerControls?: boolean
}

function SmsNotificationSettings({
  className,
  showOwnerControls = false,
}: SmsNotificationSettingsProps) {
  const { language } = useRestaurantLanguage()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const isHebrew = language === 'he'

  useEffect(() => {
    let active = true

    void getNotificationSettings()
      .then((result) => {
        if (active) setSettings(result)
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load notification settings',
          )
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSave() {
    if (!settings) return

    setIsSaving(true)
    setSaved(false)
    setError(null)

    try {
      const updated = await updateNotificationSettings({
        marketingSmsEnabled: settings.marketingSmsEnabled,
        ...(showOwnerControls
          ? {
              newCandidateSmsEnabled:
                settings.newCandidateSmsEnabled,
              candidateReminderSmsEnabled:
                settings.candidateReminderSmsEnabled,
            }
          : {}),
      })
      setSettings(updated)
      setSaved(true)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save notification settings',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={`${className} sms-notification-settings`}>
      <div className="guided-form-heading">
        <h2>{isHebrew ? 'הודעות SMS' : 'SMS notifications'}</h2>
      </div>
      <p className="form-helper-text">
        {isHebrew
          ? 'אפשר לשנות את ההעדפות בכל עת. קודי אימות חיוניים ימשיכו להישלח.'
          : 'Change these preferences at any time. Essential verification codes will still be sent.'}
      </p>
      {isLoading ? (
        <p className="status-message">
          {isHebrew ? 'טוען העדפות...' : 'Loading preferences...'}
        </p>
      ) : settings ? (
        <div className="sms-notification-options">
          <label className="consent-checkbox consent-checkbox--optional">
            <input
              type="checkbox"
              checked={settings.marketingSmsEnabled}
              onChange={(event) => {
                setSaved(false)
                setSettings({
                  ...settings,
                  marketingSmsEnabled: event.target.checked,
                })
              }}
            />
            <span>
              {isHebrew
                ? 'המלצות למשרות ועדכונים שיווקיים ב-SMS'
                : 'Job recommendations and promotional SMS updates'}
            </span>
          </label>
          {showOwnerControls && (
            <>
              <label className="consent-checkbox consent-checkbox--optional">
                <input
                  type="checkbox"
                  checked={settings.newCandidateSmsEnabled}
                  onChange={(event) => {
                    setSaved(false)
                    setSettings({
                      ...settings,
                      newCandidateSmsEnabled: event.target.checked,
                    })
                  }}
                />
                <span>
                  {isHebrew
                    ? 'הודעה כשמתקבלת מועמדות QR חדשה'
                    : 'Alert when a new QR candidate applies'}
                </span>
              </label>
              <label className="consent-checkbox consent-checkbox--optional">
                <input
                  type="checkbox"
                  checked={settings.candidateReminderSmsEnabled}
                  onChange={(event) => {
                    setSaved(false)
                    setSettings({
                      ...settings,
                      candidateReminderSmsEnabled: event.target.checked,
                    })
                  }}
                />
                <span>
                  {isHebrew
                    ? 'תזכורת לאחר 24 שעות למועמדות שעדיין לא טופלה'
                    : '24-hour reminder for an uncontacted candidate'}
                </span>
              </label>
            </>
          )}
          <button
            type="button"
            className="ui-button ui-button--secondary sms-notification-save"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? isHebrew
                ? 'שומר...'
                : 'Saving...'
              : isHebrew
                ? 'שמירת העדפות'
                : 'Save preferences'}
          </button>
        </div>
      ) : null}
      {saved && (
        <p className="message message-success" aria-live="polite">
          {isHebrew ? 'ההעדפות נשמרו.' : 'Preferences saved.'}
        </p>
      )}
      {error && (
        <p className="message message-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}

export default SmsNotificationSettings
