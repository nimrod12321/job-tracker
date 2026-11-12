import assert from 'node:assert/strict'
import test from 'node:test'
import { restaurantRoles } from '../validations/restaurant.validation.js'
import {
  DEFAULT_RESTAURANT_JOB_BOARD_JOBS,
  getDefaultRestaurantJobBoardJob,
  isLegacyDefaultRestaurantJobBoardJob,
} from '../services/restaurantJobTemplates.js'

const HEBREW_TEXT = /[\u0590-\u05ff]/u
const FABRICATED_CONDITION =
  /(?:\d|₪|salary|benefit|weekend|morning|afternoon|evening|night|experience (?:is )?required|שכר|הטב|סוף שבוע|סופי שבוע|בוקר|ערב|לילה|ניסיון חובה)/iu

function countWords(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length
}

test('every supported Job Board role has a safe Hebrew default', () => {
  assert.equal(DEFAULT_RESTAURANT_JOB_BOARD_JOBS.length, restaurantRoles.length)
  assert.deepEqual(
    new Set(DEFAULT_RESTAURANT_JOB_BOARD_JOBS.map((job) => job.role)),
    new Set(restaurantRoles),
  )

  for (const role of restaurantRoles) {
    const template = getDefaultRestaurantJobBoardJob(role)

    assert.equal(template.role, role)
    assert.match(template.description, HEBREW_TEXT)
    assert.match(template.requirements, HEBREW_TEXT)
    assert.match(template.shiftInfo, HEBREW_TEXT)
    assert.equal(FABRICATED_CONDITION.test(template.description), false)
    assert.equal(FABRICATED_CONDITION.test(template.requirements), false)
    assert.equal(FABRICATED_CONDITION.test(template.shiftInfo), false)
    assert.ok(countWords(template.description) <= 18)
    assert.ok(countWords(template.requirements) <= 16)
    assert.ok(countWords(template.shiftInfo) <= 14)
  }

  assert.equal(
    new Set(
      DEFAULT_RESTAURANT_JOB_BOARD_JOBS.map((job) => job.description),
    ).size,
    restaurantRoles.length,
  )
})

test('legacy default detection never treats edited content as generated', () => {
  const legacyWaiter = {
    role: 'waiter' as const,
    shiftInfo:
      '3–4 shifts per week, including at least one weekend shift.',
    requirements:
      'Service mindset, responsibility, good communication. Previous restaurant experience is a plus.',
    description:
      'Join the floor team for regular restaurant service. Serve guests, work with the team, and keep service smooth and friendly.',
  }

  assert.equal(isLegacyDefaultRestaurantJobBoardJob(legacyWaiter), true)
  assert.equal(
    isLegacyDefaultRestaurantJobBoardJob({
      ...legacyWaiter,
      description: 'תוכן שהמסעדה ערכה בעצמה.',
    }),
    false,
  )
})
