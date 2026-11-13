import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultRestaurantJobBoardJob } from '../services/restaurantJobTemplates.js'
import {
  ownerJobSchema,
  ownerProfileSchema,
} from '../validations/owner.validation.js'
import { restaurantRoles } from '../validations/restaurant.validation.js'

const baseJob = {
  role: 'waiter' as const,
  description: 'שירות נעים ומקצועי לאורחי המסעדה',
  requirements: 'יחסי אנוש טובים ואחריות',
  shiftInfo: 'מידע משמרות מותאם אישית שנשמר ללא שינוי גם לאחר המעבר להיקף משרה',
  contactPhone: '',
  contactWhatsapp: '',
}

test('owner job validation supports nullable scope and optional hourly wage', () => {
  const withSalary = ownerJobSchema.safeParse({
    ...baseJob,
    employmentScope: 'partTime',
    hourlyWage: 52,
  })
  assert.equal(withSalary.success, true)

  const withoutSalary = ownerJobSchema.safeParse({
    ...baseJob,
    employmentScope: null,
    hourlyWage: null,
  })
  assert.equal(withoutSalary.success, true)

  for (const hourlyWage of [0, 10.5, 10_001]) {
    assert.equal(
      ownerJobSchema.safeParse({ ...baseJob, hourlyWage }).success,
      false,
    )
  }
})

test('owner profile validation accepts multiple known venue types only', () => {
  const baseProfile = {
    restaurantName: 'Cafe Test',
    contactPerson: 'Owner',
    phoneNumber: '0501234567',
    whatsappNumber: '',
    city: 'Tel Aviv–Yafo',
    street: 'Dizengoff 1',
    description: 'Neighbourhood cafe',
  }

  assert.equal(
    ownerProfileSchema.safeParse({
      ...baseProfile,
      venueTypes: ['cafe', 'patisserie'],
    }).success,
    true,
  )
  assert.equal(
    ownerProfileSchema.safeParse({
      ...baseProfile,
      venueTypes: ['cafe', 'cafe'],
    }).success,
    false,
  )
  assert.equal(
    ownerProfileSchema.safeParse({
      ...baseProfile,
      venueTypes: ['hotel'],
    }).success,
    false,
  )
})

test('Admin role templates do not invent scope or salary', () => {
  for (const role of restaurantRoles) {
    const template = getDefaultRestaurantJobBoardJob(role)

    assert.equal('employmentScope' in template, false)
    assert.equal('hourlyWage' in template, false)
    assert.doesNotMatch(JSON.stringify(template), /₪|שכר|salary|wage/i)
  }
})
