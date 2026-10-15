import {
  createTwilioMessagesClient,
  getSafeTwilioErrorIdentifier,
  type TwilioMessagesClient,
  type TwilioSmsConfig,
  validateTwilioSmsConfig,
} from './twilioOtpProvider.js'

export const NEW_CANDIDATE_SMS_BODY =
  'A new candidate applied to your restaurant on Peepss. Open Applications to review and contact them.'

export type CandidateNotificationSmsProvider = {
  sendNewCandidateNotification: (
    recipientPhone: string,
  ) => Promise<{ providerMessageSid: string }>
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
  config: TwilioSmsConfig,
  client?: TwilioMessagesClient,
): CandidateNotificationSmsProvider {
  validateTwilioSmsConfig(config)
  const twilioClient = client ?? createTwilioMessagesClient(config)

  return {
    async sendNewCandidateNotification(recipientPhone) {
      try {
        const result = await twilioClient.messages.create({
          messagingServiceSid: config.messagingServiceSid,
          to: recipientPhone,
          body: NEW_CANDIDATE_SMS_BODY,
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
