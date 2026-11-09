import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSafeOwnerApplicationsReturnTo,
  parseOwnerApplicationsDeepLink,
} from '../src/features/owner/utils/ownerApplicationsDeepLink.ts'

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111'
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222'

test('parses an authorized-selection candidate deep link without personal data', () => {
  assert.deepEqual(
    parseOwnerApplicationsDeepLink(
      `?restaurantId=${RESTAURANT_ID}&candidateKind=externalLead&candidateId=${CANDIDATE_ID}`,
    ),
    {
      restaurantId: RESTAURANT_ID,
      scope: 'selected',
      candidateKind: 'externalLead',
      candidateId: CANDIDATE_ID,
    },
  )
})

test('parses the all-restaurants reminder destination', () => {
  assert.deepEqual(parseOwnerApplicationsDeepLink('?scope=all'), {
    restaurantId: null,
    scope: 'all',
    candidateKind: null,
    candidateId: null,
  })
})

test('drops malformed identifiers instead of selecting or opening them', () => {
  assert.deepEqual(
    parseOwnerApplicationsDeepLink(
      '?restaurantId=not-an-id&candidateKind=externalLead&candidateId=also-invalid',
    ),
    {
      restaurantId: null,
      scope: 'selected',
      candidateKind: 'externalLead',
      candidateId: null,
    },
  )
})

test('only allows a sanitized owner Applications return destination', () => {
  assert.equal(
    getSafeOwnerApplicationsReturnTo(
      `/owner/applications?restaurantId=${RESTAURANT_ID}&candidateKind=externalLead&candidateId=${CANDIDATE_ID}&privatePhone=0501234567`,
    ),
    `/owner/applications?restaurantId=${RESTAURANT_ID}&candidateKind=externalLead&candidateId=${CANDIDATE_ID}`,
  )
  assert.equal(getSafeOwnerApplicationsReturnTo('https://evil.example'), null)
  assert.equal(getSafeOwnerApplicationsReturnTo('//evil.example/path'), null)
  assert.equal(getSafeOwnerApplicationsReturnTo('/owner/jobs'), null)
})

test('legacy Applications links remain valid', () => {
  assert.equal(
    getSafeOwnerApplicationsReturnTo('/owner/applications'),
    '/owner/applications',
  )
})
