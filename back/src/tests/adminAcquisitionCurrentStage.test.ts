import assert from 'node:assert/strict'
import test from 'node:test'
import { ACQUISITION_FUNNEL_STAGE_KEYS } from '../config/analytics.js'
import {
  getCurrentAcquisitionStage,
  type AcquisitionStageEvidence,
} from '../services/adminAnalyticsStages.js'

function evidenceThrough(
  finalStage: (typeof ACQUISITION_FUNNEL_STAGE_KEYS)[number],
) {
  const finalIndex = ACQUISITION_FUNNEL_STAGE_KEYS.indexOf(finalStage)

  return Object.fromEntries(
    ACQUISITION_FUNNEL_STAGE_KEYS.map((stage, index) => [
      stage,
      index <= finalIndex,
    ]),
  ) as AcquisitionStageEvidence
}

test('current acquisition stage advances through every known milestone', () => {
  for (const expectedStage of ACQUISITION_FUNNEL_STAGE_KEYS) {
    assert.equal(
      getCurrentAcquisitionStage(evidenceThrough(expectedStage)),
      expectedStage,
    )
  }
})

test('furthest real milestone wins even when earlier evidence is missing', () => {
  const evidence = Object.fromEntries(
    ACQUISITION_FUNNEL_STAGE_KEYS.map((stage) => [stage, false]),
  ) as AcquisitionStageEvidence
  evidence.ownerSignupStarted = true
  evidence.restaurantEstablished = true
  evidence.contactInitiated = true

  assert.equal(getCurrentAcquisitionStage(evidence), 'contactInitiated')
})

test('one evaluation produces exactly one current stage', () => {
  const currentStage = getCurrentAcquisitionStage(
    evidenceThrough('candidateCardOpened'),
  )
  const counts = Object.fromEntries(
    ACQUISITION_FUNNEL_STAGE_KEYS.map((stage) => [stage, 0]),
  ) as Record<(typeof ACQUISITION_FUNNEL_STAGE_KEYS)[number], number>
  counts[currentStage] += 1

  assert.equal(
    Object.values(counts).reduce((total, count) => total + count, 0),
    1,
  )
  assert.equal(counts.candidateCardOpened, 1)
})

test('final-stage acquisition remains at contact initiated', () => {
  assert.equal(
    getCurrentAcquisitionStage(evidenceThrough('contactInitiated')),
    'contactInitiated',
  )
})
