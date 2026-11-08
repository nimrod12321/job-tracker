import {
  createTwilioMessagesClient,
  getSafeTwilioErrorIdentifier,
  type TwilioMessagesClient,
  type TwilioSmsConfig,
  validateTwilioSmsConfig,
} from './twilioOtpProvider.js'

export const OWNER_APPLICATIONS_ROUTE = '/owner/applications'

export type CandidateNotificationKind = 'newCandidate' | 'reminder24h'

export type CandidateNotificationRestaurantContext = {
  restaurantId: string
  restaurantName: string
}

export type CandidateNotificationSmsContext = {
  candidateLeadId?: string
  restaurants: CandidateNotificationRestaurantContext[]
}

type OwnerApplicationsUrlContext = {
  candidateLeadId?: string
  restaurantId?: string
  scope?: 'all'
}

export function buildOwnerApplicationsUrl(
  frontendUrl: string,
  context: OwnerApplicationsUrlContext = {},
) {
  const applicationsUrl = new URL(
    OWNER_APPLICATIONS_ROUTE,
    `${frontendUrl.replace(/\/+$/, '')}/`,
  )

  if (context.scope === 'all') {
    applicationsUrl.searchParams.set('scope', 'all')
  } else if (context.restaurantId) {
    applicationsUrl.searchParams.set(
      'restaurantId',
      context.restaurantId,
    )
  }

  if (context.candidateLeadId) {
    applicationsUrl.searchParams.set('candidateKind', 'externalLead')
    applicationsUrl.searchParams.set(
      'candidateId',
      context.candidateLeadId,
    )
  }

  return applicationsUrl.toString()
}

function normalizeRestaurantName(restaurantName: string | undefined) {
  return restaurantName?.replace(/\s+/g, ' ').trim() || null
}

export function getNewCandidateSmsBody(
  applicationsUrl: string,
  restaurantName?: string,
) {
  const normalizedName = normalizeRestaurantName(restaurantName)

  if (!normalizedName) {
    return `התקבלה אצלך מועמדות חדשה דרך Peepss 👋\n\nלצפייה במועמדות:\n${applicationsUrl}`
  }

  return `התקבלה מועמדות חדשה ל"${normalizedName}" דרך Peepss 👋\n\nלצפייה במועמדות:\n${applicationsUrl}`
}

export function getCandidateContactReminderSmsBody(
  applicationsUrl: string,
  candidateCount: number,
  restaurantNames: string[] = [],
) {
  const normalizedNames = Array.from(
    new Set(
      restaurantNames
        .map((restaurantName) => normalizeRestaurantName(restaurantName))
        .filter((restaurantName): restaurantName is string => Boolean(restaurantName)),
    ),
  )

  if (normalizedNames.length === 1) {
    const restaurantName = normalizedNames[0]

    if (candidateCount === 1) {
      return `תזכורת קטנה מ-Peepss 👋\nיש מועמדות שמחכה לטיפול ב"${restaurantName}".\nלצפייה במועמדות:\n${applicationsUrl}`
    }

    return `תזכורת קטנה מ-Peepss 👋\nיש ${candidateCount} מועמדויות שמחכות לטיפול ב"${restaurantName}".\nלצפייה במועמדויות:\n${applicationsUrl}`
  }

  if (normalizedNames.length > 1) {
    return `תזכורת קטנה מ-Peepss 👋\nיש ${candidateCount} מועמדויות שמחכות לטיפול בכמה מסעדות.\nלצפייה בכל המועמדויות:\n${applicationsUrl}`
  }

  if (candidateCount === 1) {
    return `תזכורת קטנה מ-Peepss 👋\nיש לך מועמדות שמחכה לטיפול.\nאפשר לראות אותה כאן: ${applicationsUrl}`
  }

  return `תזכורת קטנה מ-Peepss 👋\nיש לך ${candidateCount} מועמדויות שמחכות לטיפול.\nאפשר לראות אותן כאן: ${applicationsUrl}`
}

export type CandidateNotificationSmsProvider = {
  sendCandidateNotification: (
    recipientPhone: string,
    kind: CandidateNotificationKind,
    candidateCount?: number,
    context?: CandidateNotificationSmsContext,
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

  return {
    async sendCandidateNotification(
      recipientPhone,
      kind,
      candidateCount = 1,
      context,
    ) {
      try {
        const restaurants = Array.from(
          new Map(
            (context?.restaurants ?? []).map((restaurant) => [
              restaurant.restaurantId,
              restaurant,
            ]),
          ).values(),
        )
        const isMultiRestaurantReminder =
          kind === 'reminder24h' && restaurants.length > 1
        const restaurant =
          restaurants.length === 1 ? restaurants[0] : undefined
        const applicationsUrl = buildOwnerApplicationsUrl(
          config.frontendUrl,
          {
            ...(isMultiRestaurantReminder
              ? { scope: 'all' as const }
              : restaurant
                ? { restaurantId: restaurant.restaurantId }
                : {}),
            ...(kind === 'newCandidate' && context?.candidateLeadId
              ? { candidateLeadId: context.candidateLeadId }
              : {}),
          },
        )
        const result = await twilioClient.messages.create({
          messagingServiceSid: config.messagingServiceSid,
          to: recipientPhone,
          body:
            kind === 'reminder24h'
              ? getCandidateContactReminderSmsBody(
                  applicationsUrl,
                  candidateCount,
                  restaurants.map(({ restaurantName }) => restaurantName),
                )
              : getNewCandidateSmsBody(
                  applicationsUrl,
                  restaurant?.restaurantName,
                ),
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
