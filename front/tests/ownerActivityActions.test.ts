import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyHiringLinkAndRecord,
  createCandidateActivityGuard,
  recordCandidateCardOpened,
  recordCandidateContactInitiated,
  recordInstagramAssistOpened,
  recordQrAssetDownloadStarted,
  recordRecruitmentKitOpenTransition,
  type OwnerActivityEvent,
} from '../src/analytics/ownerActivityActions.ts'

function eventRecorder(events: OwnerActivityEvent[]) {
  return (event: OwnerActivityEvent) => {
    events.push(event)
    return true
  }
}

test('Recruitment Kit records only an explicit closed-to-open transition', () => {
  const events: OwnerActivityEvent[] = []
  const record = eventRecorder(events)

  recordRecruitmentKitOpenTransition(false, true, record)
  recordRecruitmentKitOpenTransition(true, true, record)
  recordRecruitmentKitOpenTransition(true, false, record)
  recordRecruitmentKitOpenTransition(false, false, record)

  assert.deepEqual(events, [{ eventName: 'recruitment_kit_opened' }])
})

test('successful generic link copy records one copy event', async () => {
  const events: OwnerActivityEvent[] = []

  const copied = await copyHiringLinkAndRecord(
    async () => true,
    eventRecorder(events),
  )

  assert.equal(copied, true)
  assert.deepEqual(events, [
    {
      eventName: 'hiring_link_copied',
      properties: { method: 'button' },
    },
  ])
})

test('failed generic link copy records no successful copy event', async () => {
  const events: OwnerActivityEvent[] = []

  const copied = await copyHiringLinkAndRecord(
    async () => false,
    eventRecorder(events),
  )

  assert.equal(copied, false)
  assert.deepEqual(events, [])
})

test('poster and standalone QR actions record their distinct start events', () => {
  const events: OwnerActivityEvent[] = []
  const record = eventRecorder(events)

  recordQrAssetDownloadStarted('poster', record)
  recordQrAssetDownloadStarted('qr', record)

  assert.deepEqual(events, [
    {
      eventName: 'poster_download_started',
      properties: { format: 'png' },
    },
    {
      eventName: 'qr_download_started',
      properties: { format: 'png' },
    },
  ])
})

test('Instagram assist records only Instagram assist, not generic link copy', () => {
  const events: OwnerActivityEvent[] = []

  recordInstagramAssistOpened(eventRecorder(events))

  assert.deepEqual(events, [
    {
      eventName: 'instagram_assist_opened',
      properties: { context: 'story_assist' },
    },
  ])
  assert.equal(
    events.some((event) => event.eventName === 'hiring_link_copied'),
    false,
  )
})

test('analytics recorder failure never changes the successful product action', async () => {
  const copied = await copyHiringLinkAndRecord(async () => true, () => {
    throw new Error('analytics unavailable')
  })

  assert.equal(copied, true)
  assert.doesNotThrow(() => {
    recordQrAssetDownloadStarted('poster', () => {
      throw new Error('analytics unavailable')
    })
  })
})

test('candidate card records only an intentional open and ignores a rapid duplicate', () => {
  const events: OwnerActivityEvent[] = []
  const guard = createCandidateActivityGuard()
  const candidateReference = {
    kind: 'externalLead' as const,
    id: '71d16b12-b298-4907-a70e-f652f67ff498',
  }

  assert.deepEqual(events, [], 'rendering alone records nothing')
  recordCandidateCardOpened(
    candidateReference,
    guard,
    eventRecorder(events),
    1_000,
  )
  recordCandidateCardOpened(
    candidateReference,
    guard,
    eventRecorder(events),
    1_100,
  )

  assert.deepEqual(events, [
    {
      eventName: 'candidate_card_opened',
      candidateReference,
    },
  ])

  recordCandidateCardOpened(
    candidateReference,
    guard,
    eventRecorder(events),
    2_000,
  )
  assert.equal(events.length, 2, 'a later intentional re-open is allowed')
})

test('candidate contact records phone and WhatsApp without candidate PII', () => {
  const events: OwnerActivityEvent[] = []
  const guard = createCandidateActivityGuard()
  const candidateReference = {
    kind: 'jobApplication' as const,
    id: 'a0b6e837-41cd-4ed6-994f-51e682a16a74',
  }
  const record = eventRecorder(events)

  recordCandidateContactInitiated(
    candidateReference,
    'phone',
    guard,
    record,
    1_000,
  )
  recordCandidateContactInitiated(
    candidateReference,
    'whatsapp',
    guard,
    record,
    1_100,
  )

  assert.deepEqual(events, [
    {
      eventName: 'candidate_contact_initiated',
      candidateReference,
      properties: { channel: 'phone' },
    },
    {
      eventName: 'candidate_contact_initiated',
      candidateReference,
      properties: { channel: 'whatsapp' },
    },
  ])
  assert.equal(JSON.stringify(events).includes('phoneNumber'), false)
  assert.equal(JSON.stringify(events).includes('candidateName'), false)
})

test('candidate analytics failure does not block open, phone, or WhatsApp actions', () => {
  const guard = createCandidateActivityGuard()
  const candidateReference = {
    kind: 'externalLead' as const,
    id: '1ab79474-5707-4eea-81ee-8fed091d7036',
  }
  const failingRecorder = () => {
    throw new Error('analytics unavailable')
  }

  assert.doesNotThrow(() => {
    recordCandidateCardOpened(
      candidateReference,
      guard,
      failingRecorder,
      1_000,
    )
    recordCandidateContactInitiated(
      candidateReference,
      'phone',
      guard,
      failingRecorder,
      1_000,
    )
    recordCandidateContactInitiated(
      candidateReference,
      'whatsapp',
      guard,
      failingRecorder,
      1_000,
    )
  })
})
