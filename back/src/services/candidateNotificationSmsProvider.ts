import {
  createTwilioMessagesClient,
  getSafeTwilioErrorIdentifier,
  type TwilioMessagesClient,
  type TwilioSmsConfig,
  validateTwilioSmsConfig,
} from './twilioOtpProvider.js'

export const OWNER_APPLICATIONS_ROUTE = '/owner/applications'

export type CandidateNotificationKind = 'newCandidate' | 'reminder24h'

export function buildOwnerApplicationsUrl(frontendUrl: string) {
  return new URL(
    OWNER_APPLICATIONS_ROUTE,
    `${frontendUrl.replace(/\/+$/, '')}/`,
  ).toString()
}

export function getNewCandidateSmsBody(applicationsUrl: string) {
  return `התקבלה אצלך מועמדות חדשה דרך Peepss 👋\nאפשר לראות את הפרטים כאן: ${applicationsUrl}`
}

export function getCandidateContactReminderSmsBody(
  applicationsUrl: string,
) {
  return `תזכורת קטנה מ-Peepss 👋\nיש לך מועמדות שעדיין לא יצרת איתה קשר.\nאפשר לראות את הפרטים כאן: ${applicationsUrl}`
}

export type CandidateNotificationSmsProvider = {
  sendCandidateNotification: (
    recipientPhone: string,
    kind: CandidateNotificationKind,
  ) => Promise<{ providerMessageSid: string }>
}

type CandidateNotificationSmsConfig = TwilioSmsConfig & {
  frontendUrl: string
}

export class CandidateNotificationSmsError extends Error {
  readonly safeErrorCode: string

  constructor(safeErrorCode: string) {
    super('Candidate notification SMS could not be sent')
    this.name = 'CandidateNotificationSmsError'
    this.safeErrorCode = safeErrorCode
  }
}

export function getCandidateNotificationSafeErrorCode(error: unknown) {
  if (error instanceof CandidateNotificationSmsError) {
    return error.safeErrorCode
  }

  return 'candidate_notification_send_failed'
}

export function createTwilioCandidateNotificationSmsProvider(
  config: CandidateNotificationSmsConfig,
  client?: TwilioMessagesClient,
): CandidateNotificationSmsProvider {
  validateTwilioSmsConfig(config)
  const twilioClient = client ?? createTwilioMessagesClient(config)
  const applicationsUrl = buildOwnerApplicationsUrl(config.frontendUrl)

  return {
    async sendCandidateNotification(recipientPhone, kind) {
      try {
        const result = await twilioClient.messages.create({
          messagingServiceSid: config.messagingServiceSid,
          to: recipientPhone,
          body:
            kind === 'reminder24h'
              ? getCandidateContactReminderSmsBody(applicationsUrl)
              : getNewCandidateSmsBody(applicationsUrl),
        })
        const providerMessageSid =
          typeof result === 'object' &&
          result !== null &&
          'sid' in result &&
          typeof result.sid === 'string'
            ? result.sid
            : ''

        if (!providerMessageSid) {
          throw new CandidateNotificationSmsError(
            'twilio_missing_message_sid',
          )
        }

        return { providerMessageSid }
      } catch (error) {
        const safeErrorCode =
          error instanceof CandidateNotificationSmsError
            ? error.safeErrorCode
            : getSafeTwilioErrorIdentifier(error)

        console.error('Failed to send candidate notification SMS', {
          safeErrorCode,
        })

        throw new CandidateNotificationSmsError(safeErrorCode)
      }
    },
  }
}
