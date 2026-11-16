import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultRestaurantJobBoardJob } from '../services/restaurantJobTemplates.js'
import { resolveRestaurantMatchContact } from '../services/restaurantMatchContact.service.js'
import { selectNewCandidateNotificationRecipients } from '../services/restaurantCandidateNotification.service.js'
import { ownerAdditionalRestaurantSchema } from '../validations/owner.validation.js'
import { restaurantRoles } from '../validations/restaurant.validation.js'

const now = new Date('2026-11-16T12:00:00.000Z')
const legacyContact = {
  contactPhone: '+972509999999',
  contactWhatsapp: '+972508888888',
}

function member(input: {
  id: string
  phoneNumber: string
  role: 'owner' | 'hiringManager'
  status?: 'active' | 'pending' | 'removed'
  verified?: boolean
}) {
  return {
    id: input.id,
    phoneNumber: input.phoneNumber,
    role: input.role,
    status: input.status ?? 'active',
    userId: input.verified === false ? null : `user-${input.id}`,
    user:
      input.verified === false
        ? null
        : {
            phoneVerifiedAt: now,
            registrationCompletedAt: now,
          },
  }
}

test('new restaurant input requires venue type but not description or contact person', () => {
  const result = ownerAdditionalRestaurantSchema.safeParse({
    restaurantName: 'Cafe Test',
    contactPerson: '',
    phoneNumber: '',
    whatsappNumber: '',
    city: '',
    street: '',
    description: '',
    locationPlaceId: 'google-place-id',
    venueTypes: ['cafe', 'patisserie'],
    hiringManagerPhone: '',
    ownerMatchContactConfirmed: true,
  })

  assert.equal(result.success, true)
  assert.equal(
    ownerAdditionalRestaurantSchema.safeParse({
      ...result.data,
      venueTypes: [],
    }).success,
    false,
  )
})

test('new roles are distinct and all have neutral Hebrew templates', () => {
  const roles = ['restaurantManager', 'baker', 'pastryChef'] as const

  for (const role of roles) {
    assert.ok(restaurantRoles.includes(role))
    const template = getDefaultRestaurantJobBoardJob(role)
    const text = [
      template.description,
      template.requirements,
      template.shiftInfo,
    ].join(' ')

    assert.ok(template.description.trim())
    assert.ok(template.requirements.trim())
    assert.doesNotMatch(
      text,
      /(?:₪|שכר|סופי שבוע|משמרות בשבוע|ניסיון חובה|הטבות)/u,
    )
  }
})

test('legacy restaurant keeps customized job contact until explicit confirmation', () => {
  assert.deepEqual(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: null,
        primaryHiringManagerMemberId: null,
        members: [
          member({
            id: 'owner',
            role: 'owner',
            phoneNumber: '+972501111111',
          }),
        ],
      },
      legacyContact,
    ),
    legacyContact,
  )
})

test('designated active manager is the Match contact', () => {
  assert.deepEqual(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: now,
        primaryHiringManagerMemberId: 'manager-two',
        members: [
          member({
            id: 'owner',
            role: 'owner',
            phoneNumber: '+972501111111',
          }),
          member({
            id: 'manager-one',
            role: 'hiringManager',
            phoneNumber: '+972502222222',
          }),
          member({
            id: 'manager-two',
            role: 'hiringManager',
            phoneNumber: '+972503333333',
          }),
        ],
      },
      legacyContact,
    ),
    {
      contactPhone: '+972503333333',
      contactWhatsapp: '+972503333333',
    },
  )
})

test('one active manager is automatic, while removed or ambiguous managers fall back to owner', () => {
  const owner = member({
    id: 'owner',
    role: 'owner',
    phoneNumber: '+972501111111',
  })
  const activeManager = member({
    id: 'manager-one',
    role: 'hiringManager',
    phoneNumber: '+972502222222',
  })

  assert.equal(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: now,
        primaryHiringManagerMemberId: null,
        members: [owner, activeManager],
      },
      legacyContact,
    ).contactPhone,
    '+972502222222',
  )

  assert.equal(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: now,
        primaryHiringManagerMemberId: 'manager-one',
        members: [
          owner,
          { ...activeManager, status: 'removed' as const },
        ],
      },
      legacyContact,
    ).contactPhone,
    '+972501111111',
  )

  assert.equal(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: now,
        primaryHiringManagerMemberId: null,
        members: [
          owner,
          activeManager,
          member({
            id: 'manager-two',
            role: 'hiringManager',
            phoneNumber: '+972503333333',
          }),
        ],
      },
      legacyContact,
    ).contactPhone,
    '+972501111111',
  )
})

test('confirmed team rule never exposes a stale job contact when ownership is ambiguous', () => {
  assert.deepEqual(
    resolveRestaurantMatchContact(
      {
        ownerMatchContactConfirmedAt: now,
        primaryHiringManagerMemberId: null,
        members: [],
      },
      legacyContact,
    ),
    {
      contactPhone: '',
      contactWhatsapp: '',
    },
  )
})

test('candidate service notifications include owner and active manager without marketing consent', () => {
  const recipients = selectNewCandidateNotificationRecipients(
    'restaurant-one',
    [
      {
        ...member({
          id: 'owner',
          role: 'owner',
          phoneNumber: '+972501111111',
        }),
        restaurantId: 'restaurant-one',
        newCandidateSmsEnabled: true,
      },
      {
        ...member({
          id: 'manager',
          role: 'hiringManager',
          phoneNumber: '+972502222222',
        }),
        restaurantId: 'restaurant-one',
        newCandidateSmsEnabled: true,
      },
    ],
  )

  assert.deepEqual(
    recipients.map((recipient) => recipient.recipientPhone),
    ['+972501111111', '+972502222222'],
  )
})
