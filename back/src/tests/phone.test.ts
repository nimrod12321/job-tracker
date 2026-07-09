import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

test('normalizes valid Israeli mobile phone numbers', () => {
  assert.equal(
    normalizeIsraeliPhoneNumber('0501234567'),
    '+972501234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('0521234567'),
    '+972521234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('054-123-4567'),
    '+972541234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('050 123 4567'),
    '+972501234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('+972501234567'),
    '+972501234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('972501234567'),
    '+972501234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('+972 50 123 4567'),
    '+972501234567',
  )
  assert.equal(
    normalizeIsraeliPhoneNumber('\u200f050\u200e1234567'),
    '+972501234567',
  )
})

test('rejects invalid or non-mobile phone numbers', () => {
  for (const phoneNumber of [
    '123',
    '0301234567',
    '+14155552671',
    '050123',
  ]) {
    assert.throws(
      () => normalizeIsraeliPhoneNumber(phoneNumber),
      /phone number is invalid/,
    )
  }
})
