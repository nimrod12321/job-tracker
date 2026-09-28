import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyHiringLinkAndRecord,
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
