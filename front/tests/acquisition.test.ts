import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACQUISITION_ID_STORAGE_KEY,
  ACQUISITION_RETENTION_MS,
  FIRST_TOUCH_STORAGE_KEY,
  captureFirstTouch,
  deriveFirstTouchAttribution,
  type FirstTouchAttribution,
} from '../src/analytics/acquisition.ts'

const FIXED_NOW = '2026-09-26T08:00:00.000Z'
const FIXED_NOW_MS = Date.parse(FIXED_NOW)
const FIRST_ID = '123e4567-e89b-42d3-a456-426614174000'
const SECOND_ID = '7e6b4b8d-14cc-4be4-aef3-62e49aab1abc'

function locationFor(path: string) {
  const url = new URL(path, 'https://peepss.com')
  return {
    href: url.href,
    origin: url.origin,
    pathname: url.pathname,
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }
}

function directFirstTouch(firstTouchedAt: string): FirstTouchAttribution {
  return {
    source: 'direct',
    medium: 'none',
    campaign: null,
    referrer: null,
    direct: true,
    landingPath: '/',
    firstTouchedAt,
  }
}

function storedContext(
  firstTouchedAt: string,
  id = FIRST_ID,
  firstTouch = directFirstTouch(firstTouchedAt),
) {
  return memoryStorage({
    [ACQUISITION_ID_STORAGE_KEY]: id,
    [FIRST_TOUCH_STORAGE_KEY]: JSON.stringify(firstTouch),
  })
}

function capture(
  storage: ReturnType<typeof memoryStorage>,
  options: {
    path?: string
    referrer?: string
    now?: string
    id?: string
  } = {},
) {
  return captureFirstTouch({
    storage,
    location: locationFor(options.path ?? '/'),
    referrer: options.referrer ?? '',
    now: () => new Date(options.now ?? FIXED_NOW),
    createId: () => options.id ?? SECOND_ID,
  })
}

test('decodes and safely keeps awkward valid UTM values without storing the query', () => {
  const result = deriveFirstTouchAttribution(
    locationFor(
      '/auth?utm_source=Instagram%20Ads&utm_medium=paid%20social&utm_campaign=test%2Fone&phone=private',
    ),
    '',
    FIXED_NOW,
  )

  assert.deepEqual(result, {
    source: 'Instagram Ads',
    medium: 'paid social',
    campaign: 'test/one',
    referrer: null,
    direct: false,
    landingPath: '/auth',
    firstTouchedAt: FIXED_NOW,
  })
})

test('classifies a visit with no UTM or external referrer as direct', () => {
  const result = deriveFirstTouchAttribution(
    locationFor('/register?phone=private#step'),
    '',
    FIXED_NOW,
  )

  assert.equal(result.source, 'direct')
  assert.equal(result.medium, 'none')
  assert.equal(result.direct, true)
  assert.equal(result.landingPath, '/register')
})

test('keeps only the hostname for an external referral', () => {
  const result = deriveFirstTouchAttribution(
    locationFor('/claim/example'),
    'https://www.facebook.com/groups/restaurants?member=private',
    FIXED_NOW,
  )

  assert.equal(result.source, 'www.facebook.com')
  assert.equal(result.medium, 'referral')
  assert.equal(result.referrer, 'www.facebook.com')
  assert.equal(result.direct, false)
})

test('ignores same-site referrers', () => {
  const result = deriveFirstTouchAttribution(
    locationFor('/auth'),
    'https://peepss.com/legal/privacy?from=private',
    FIXED_NOW,
  )

  assert.equal(result.direct, true)
  assert.equal(result.referrer, null)
})

test('reuses a complete context younger than 365 days', () => {
  const firstTouchedAt = new Date(
    FIXED_NOW_MS - 100 * 24 * 60 * 60 * 1000,
  ).toISOString()
  const firstTouch = {
    ...directFirstTouch(firstTouchedAt),
    source: 'instagram',
    medium: 'social',
    campaign: 'owner_beta',
    direct: false,
  }
  const storage = storedContext(firstTouchedAt, FIRST_ID, firstTouch)

  const result = capture(storage, {
    path: '/?utm_source=google&utm_medium=cpc',
  })

  assert.equal(result?.anonymousAcquisitionId, FIRST_ID)
  assert.deepEqual(result?.firstTouch, firstTouch)
})

test('a context exactly 365 days old rotates both values using the current visit', () => {
  const expiredAt = new Date(
    FIXED_NOW_MS - ACQUISITION_RETENTION_MS,
  ).toISOString()
  const storage = storedContext(expiredAt)

  const result = capture(storage, {
    path: '/auth?utm_source=google&utm_medium=cpc&utm_campaign=return',
  })

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.notEqual(result?.anonymousAcquisitionId, FIRST_ID)
  assert.equal(result?.firstTouch.source, 'google')
  assert.equal(result?.firstTouch.medium, 'cpc')
  assert.equal(result?.firstTouch.campaign, 'return')
  assert.equal(
    storage.getItem(ACQUISITION_ID_STORAGE_KEY),
    SECOND_ID,
  )
})

test('a context older than 365 days rotates', () => {
  const expiredAt = new Date(
    FIXED_NOW_MS - ACQUISITION_RETENTION_MS - 1,
  ).toISOString()
  const storage = storedContext(expiredAt)

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.source, 'direct')
  assert.equal(result?.firstTouch.firstTouchedAt, FIXED_NOW)
})

test('an ID without first touch recreates both values', () => {
  const storage = memoryStorage({
    [ACQUISITION_ID_STORAGE_KEY]: FIRST_ID,
  })

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.firstTouchedAt, FIXED_NOW)
  assert.ok(storage.getItem(FIRST_TOUCH_STORAGE_KEY))
})

test('first touch without an ID recreates both values', () => {
  const storage = memoryStorage({
    [FIRST_TOUCH_STORAGE_KEY]: JSON.stringify(directFirstTouch(FIXED_NOW)),
  })

  const result = capture(storage, {
    path: '/?utm_source=referral&utm_medium=partner',
  })

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.source, 'referral')
  assert.equal(storage.getItem(ACQUISITION_ID_STORAGE_KEY), SECOND_ID)
})

test('malformed first-touch JSON recreates the entire context', () => {
  const storage = memoryStorage({
    [ACQUISITION_ID_STORAGE_KEY]: FIRST_ID,
    [FIRST_TOUCH_STORAGE_KEY]: '{bad-json',
  })

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.source, 'direct')
})

test('invalid firstTouchedAt recreates the entire context', () => {
  const storage = storedContext(
    'not-a-date',
    FIRST_ID,
    directFirstTouch('not-a-date'),
  )

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.firstTouchedAt, FIXED_NOW)
})

test('an implausibly future firstTouchedAt recreates the context', () => {
  const future = new Date(FIXED_NOW_MS + 24 * 60 * 60 * 1000).toISOString()
  const storage = storedContext(future)

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.firstTouchedAt, FIXED_NOW)
})

test('a malformed stored acquisition UUID recreates both values', () => {
  const storage = storedContext(FIXED_NOW, 'not-a-uuid')

  const result = capture(storage)

  assert.equal(result?.anonymousAcquisitionId, SECOND_ID)
  assert.equal(result?.firstTouch.firstTouchedAt, FIXED_NOW)
})

test('a storage read failure does not throw or block initialization', () => {
  const storage = {
    getItem() {
      throw new Error('storage unavailable')
    },
    setItem() {
      throw new Error('storage unavailable')
    },
    removeItem() {
      throw new Error('storage unavailable')
    },
  }

  assert.doesNotThrow(() =>
    captureFirstTouch({
      storage,
      location: locationFor('/'),
      referrer: '',
      now: () => new Date(FIXED_NOW),
      createId: () => SECOND_ID,
    }),
  )
  assert.equal(
    captureFirstTouch({
      storage,
      location: locationFor('/'),
      referrer: '',
      now: () => new Date(FIXED_NOW),
      createId: () => SECOND_ID,
    }),
    null,
  )
})

test('a storage write failure rolls back when possible and does not throw', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem(key: string) {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
      throw new Error('write failed')
    },
    removeItem(key: string) {
      values.delete(key)
    },
  }

  const result = captureFirstTouch({
    storage,
    location: locationFor('/'),
    referrer: '',
    now: () => new Date(FIXED_NOW),
    createId: () => SECOND_ID,
  })

  assert.equal(result, null)
  assert.equal(values.size, 0)
})
