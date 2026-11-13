import assert from 'node:assert/strict'
import test from 'node:test'
import { ownerJobSchema } from '../validations/owner.validation.js'

const validJob = {
  role: 'waiter',
  description: 'A friendly role in a busy neighborhood restaurant',
  requirements: 'Reliable and friendly with a strong service mindset',
  shiftInfo: 'Morning and evening shifts',
  contactPhone: '',
  contactWhatsapp: '',
}

test('owner job description and requirements accept compact-card word limits', () => {
  const result = ownerJobSchema.safeParse({
    ...validJob,
    shiftInfo: Array.from({ length: 14 }, () => 'shift').join(' '),
    description: Array.from({ length: 18 }, () => 'description').join(' '),
    requirements: Array.from({ length: 16 }, () => 'requirement').join(' '),
  })

  assert.equal(result.success, true)
})

test('owner job description rejects more than 18 words', () => {
  const result = ownerJobSchema.safeParse({
    ...validJob,
    description: Array.from({ length: 19 }, () => 'description').join(' '),
  })

  assert.equal(result.success, false)
  assert.match(result.error?.issues[0]?.message ?? '', /18 words or fewer/)
})

test('owner job requirements reject more than 16 words', () => {
  const result = ownerJobSchema.safeParse({
    ...validJob,
    requirements: Array.from({ length: 17 }, () => 'requirement').join(' '),
  })

  assert.equal(result.success, false)
  assert.match(result.error?.issues[0]?.message ?? '', /16 words or fewer/)
})

test('legacy shift info is preserved without the retired word limit', () => {
  const result = ownerJobSchema.safeParse({
    ...validJob,
    shiftInfo: Array.from({ length: 20 }, () => 'legacy').join(' '),
  })

  assert.equal(result.success, true)
})

test('legacy shift info still respects its storage length limit', () => {
  const result = ownerJobSchema.safeParse({
    ...validJob,
    shiftInfo: 'x'.repeat(501),
  })

  assert.equal(result.success, false)
  assert.match(result.error?.issues[0]?.message ?? '', /too long/)
})
