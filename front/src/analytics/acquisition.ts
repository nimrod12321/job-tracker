export const ACQUISITION_ID_STORAGE_KEY = 'peepss_acquisition_id_v1'
export const FIRST_TOUCH_STORAGE_KEY = 'peepss_first_touch_v1'

const MAX_ATTRIBUTION_LENGTH = 100
const MAX_CAMPAIGN_LENGTH = 160
const MAX_PATH_LENGTH = 500
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000

export const ACQUISITION_RETENTION_MS =
  365 * 24 * 60 * 60 * 1000

export type FirstTouchAttribution = {
  source: string
  medium: string
  campaign: string | null
  referrer: string | null
  direct: boolean
  landingPath: string
  firstTouchedAt: string
}

export type AcquisitionContext = {
  anonymousAcquisitionId: string
  firstTouch: FirstTouchAttribution
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type LocationLike = Pick<Location, 'href' | 'origin' | 'pathname'>

type CaptureDependencies = {
  storage: StorageLike
  location: LocationLike
  referrer: string
  now: () => Date
  createId: () => string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

function normalizeUtmValue(
  value: string,
  fallback: string,
  maxLength: number,
) {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N} ._+/-]+/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)

  return normalized || fallback
}

function normalizeCampaign(value: string | null) {
  if (!value) return null

  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N} ._+/-]+/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_CAMPAIGN_LENGTH)

  return normalized || null
}

function safeLandingPath(pathname: string) {
  if (!pathname.startsWith('/')) return '/'
  return pathname.slice(0, MAX_PATH_LENGTH)
}

function externalReferrerHostname(
  referrer: string,
  currentOrigin: string,
) {
  if (!referrer) return null

  try {
    const referrerUrl = new URL(referrer)
    if (referrerUrl.origin === currentOrigin) return null
    return referrerUrl.hostname.toLowerCase().slice(0, 253) || null
  } catch {
    return null
  }
}

export function deriveFirstTouchAttribution(
  location: LocationLike,
  referrer: string,
  firstTouchedAt: string,
): FirstTouchAttribution {
  const currentUrl = new URL(location.href)
  const utmSource = currentUrl.searchParams.get('utm_source')
  const externalReferrer = externalReferrerHostname(
    referrer,
    location.origin,
  )

  if (utmSource?.trim()) {
    return {
      source: normalizeUtmValue(
        utmSource,
        'unknown',
        MAX_ATTRIBUTION_LENGTH,
      ),
      medium: normalizeUtmValue(
        currentUrl.searchParams.get('utm_medium') ?? '',
        'unknown',
        MAX_ATTRIBUTION_LENGTH,
      ),
      campaign: normalizeCampaign(currentUrl.searchParams.get('utm_campaign')),
      referrer: externalReferrer,
      direct: false,
      landingPath: safeLandingPath(location.pathname),
      firstTouchedAt,
    }
  }

  if (externalReferrer) {
    return {
      source: externalReferrer,
      medium: 'referral',
      campaign: null,
      referrer: externalReferrer,
      direct: false,
      landingPath: safeLandingPath(location.pathname),
      firstTouchedAt,
    }
  }

  return {
    source: 'direct',
    medium: 'none',
    campaign: null,
    referrer: null,
    direct: true,
    landingPath: safeLandingPath(location.pathname),
    firstTouchedAt,
  }
}

function isFirstTouchAttribution(
  value: unknown,
  nowMs: number,
): value is FirstTouchAttribution {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  if (
    typeof candidate.source !== 'string' ||
    !candidate.source ||
    candidate.source.length > MAX_ATTRIBUTION_LENGTH ||
    typeof candidate.medium !== 'string' ||
    !candidate.medium ||
    candidate.medium.length > MAX_ATTRIBUTION_LENGTH ||
    (candidate.campaign !== null &&
      typeof candidate.campaign !== 'string') ||
    (typeof candidate.campaign === 'string' &&
      candidate.campaign.length > MAX_CAMPAIGN_LENGTH) ||
    (candidate.referrer !== null &&
      typeof candidate.referrer !== 'string') ||
    (typeof candidate.referrer === 'string' &&
      !HOSTNAME_PATTERN.test(candidate.referrer)) ||
    typeof candidate.direct !== 'boolean' ||
    typeof candidate.landingPath !== 'string' ||
    !candidate.landingPath.startsWith('/') ||
    candidate.landingPath.includes('?') ||
    candidate.landingPath.includes('#') ||
    candidate.landingPath.length > MAX_PATH_LENGTH ||
    typeof candidate.firstTouchedAt !== 'string'
  ) {
    return false
  }

  const firstTouchedAtMs = Date.parse(candidate.firstTouchedAt)
  if (!Number.isFinite(firstTouchedAtMs)) return false

  // Five minutes accommodates ordinary device clock drift. Anything farther
  // ahead is treated as corrupted rather than extending attribution forever.
  if (firstTouchedAtMs > nowMs + MAX_FUTURE_CLOCK_SKEW_MS) return false
  if (nowMs - firstTouchedAtMs >= ACQUISITION_RETENTION_MS) return false

  return (
    (!candidate.direct ||
      (candidate.source === 'direct' &&
        candidate.medium === 'none' &&
        candidate.campaign === null &&
        candidate.referrer === null)) &&
    (candidate.direct || candidate.source !== 'direct')
  )
}

function readFirstTouch(storage: StorageLike, nowMs: number) {
  const rawValue = storage.getItem(FIRST_TOUCH_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsed: unknown = JSON.parse(rawValue)
    return isFirstTouchAttribution(parsed, nowMs) ? parsed : null
  } catch {
    return null
  }
}

function clearStoredContext(storage: StorageLike) {
  storage.removeItem(ACQUISITION_ID_STORAGE_KEY)
  storage.removeItem(FIRST_TOUCH_STORAGE_KEY)
}

function writeStoredContext(
  storage: StorageLike,
  context: AcquisitionContext,
) {
  try {
    storage.setItem(
      ACQUISITION_ID_STORAGE_KEY,
      context.anonymousAcquisitionId,
    )
    storage.setItem(
      FIRST_TOUCH_STORAGE_KEY,
      JSON.stringify(context.firstTouch),
    )
    return true
  } catch {
    // Avoid deliberately leaving a half-written ID/first-touch pair. If
    // storage itself is unavailable, even rollback may fail and is ignored.
    try {
      clearStoredContext(storage)
    } catch {
      // Analytics storage is non-critical.
    }
    return false
  }
}

function createNewId(createId: () => string, previousId: string | null) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextId = createId()
    if (UUID_PATTERN.test(nextId) && nextId !== previousId) return nextId
  }

  return null
}

function createBrowserUuid() {
  if (typeof crypto === 'undefined') return ''
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  if (typeof crypto.getRandomValues !== 'function') return ''
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

export function captureFirstTouch(
  dependencies: CaptureDependencies,
): AcquisitionContext | null {
  try {
    const now = dependencies.now()
    const nowMs = now.getTime()
    const storedId = dependencies.storage.getItem(
      ACQUISITION_ID_STORAGE_KEY,
    )
    const existingFirstTouch = readFirstTouch(
      dependencies.storage,
      nowMs,
    )
    if (
      storedId &&
      UUID_PATTERN.test(storedId) &&
      existingFirstTouch
    ) {
      return {
        anonymousAcquisitionId: storedId,
        firstTouch: existingFirstTouch,
      }
    }

    // Missing, partial, corrupted, or expired state is one invalid context.
    // Clear both sides before replacing both sides from the current visit.
    clearStoredContext(dependencies.storage)
    const anonymousAcquisitionId = createNewId(
      dependencies.createId,
      storedId,
    )
    if (!anonymousAcquisitionId) return null

    const firstTouch = deriveFirstTouchAttribution(
      dependencies.location,
      dependencies.referrer,
      now.toISOString(),
    )
    const context = { anonymousAcquisitionId, firstTouch }

    return writeStoredContext(dependencies.storage, context)
      ? context
      : null
  } catch {
    // Storage can be unavailable in privacy modes. Analytics must never block
    // app startup or any product action.
    return null
  }
}

export function initializeAcquisitionCapture() {
  if (typeof window === 'undefined') return null

  return captureFirstTouch({
    storage: window.localStorage,
    location: window.location,
    referrer: document.referrer,
    now: () => new Date(),
    createId: createBrowserUuid,
  })
}

export function getStoredAcquisitionContext(): AcquisitionContext | null {
  if (typeof window === 'undefined') return null

  try {
    const anonymousAcquisitionId = window.localStorage.getItem(
      ACQUISITION_ID_STORAGE_KEY,
    )
    const firstTouch = readFirstTouch(window.localStorage, Date.now())

    if (
      !anonymousAcquisitionId ||
      !UUID_PATTERN.test(anonymousAcquisitionId) ||
      !firstTouch
    ) {
      return null
    }

    return { anonymousAcquisitionId, firstTouch }
  } catch {
    return null
  }
}
