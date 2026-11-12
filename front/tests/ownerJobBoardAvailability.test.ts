import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRenderOwnerJobForm } from '../src/features/owner/utils/ownerJobBoardAvailability.ts'

test('production owners can edit an existing Job Board listing', () => {
  assert.equal(
    shouldRenderOwnerJobForm(
      '11111111-1111-4111-8111-111111111111',
      false,
    ),
    true,
  )
})

test('manual Job Board creation remains development-only', () => {
  assert.equal(shouldRenderOwnerJobForm(null, false), false)
  assert.equal(shouldRenderOwnerJobForm(null, true), true)
})
