import { normalizeIsraeliPhoneNumber } from '../utils/phone.js'

export const MATCH_CONTACT_DISCLOSURE_VERSION =
  'owner-match-contact-v1'

type MatchContactMember = {
  id: string
  phoneNumber: string
  role: 'owner' | 'hiringManager'
  status: 'active' | 'pending' | 'removed'
  userId: string | null
  user: {
    phoneVerifiedAt: Date | null
    registrationCompletedAt: Date | null
  } | null
}

type MatchContactRestaurant = {
  ownerMatchContactConfirmedAt: Date | null
  matchContactDisclosureVersion: string | null
  primaryHiringManagerMemberId: string | null
  members: MatchContactMember[]
}

type LegacyJobContact = {
  contactPhone: string
  contactWhatsapp: string
}

function getVerifiedMemberPhone(member: MatchContactMember) {
  if (
    member.status !== 'active' ||
    !member.userId ||
    !member.user?.phoneVerifiedAt ||
    !member.user.registrationCompletedAt
  ) {
    return null
  }

  try {
    return normalizeIsraeliPhoneNumber(member.phoneNumber)
  } catch {
    return null
  }
}

export function resolveRestaurantMatchContact(
  restaurant: MatchContactRestaurant | null,
  legacyContact: LegacyJobContact,
) {
  // Existing restaurants keep their manually configured job-level contact
  // until an owner explicitly accepts the team-contact disclosure rule.
  if (
    !restaurant?.ownerMatchContactConfirmedAt &&
    !restaurant?.matchContactDisclosureVersion
  ) {
    return legacyContact
  }

  const activeManagers = restaurant.members
    .filter((member) => member.role === 'hiringManager')
    .map((member) => ({
      member,
      phoneNumber: getVerifiedMemberPhone(member),
    }))
    .filter(
      (
        item,
      ): item is { member: MatchContactMember; phoneNumber: string } =>
        item.phoneNumber !== null,
    )
  const designatedManager = restaurant.primaryHiringManagerMemberId
    ? activeManagers.find(
        ({ member }) =>
          member.id === restaurant.primaryHiringManagerMemberId,
      )
    : activeManagers.length === 1
      ? activeManagers[0]
      : null

  if (designatedManager) {
    return {
      contactPhone: designatedManager.phoneNumber,
      contactWhatsapp: designatedManager.phoneNumber,
    }
  }

  const activeOwnerPhones = [
    ...new Set(
      restaurant.members
        .filter((member) => member.role === 'owner')
        .map(getVerifiedMemberPhone)
        .filter((phoneNumber): phoneNumber is string => phoneNumber !== null),
    ),
  ]

  // Once the team-based rule is confirmed, an ambiguous owner state must not
  // fall back to a potentially stale job snapshot (for example, a removed
  // manager's old number). Withhold contact details until the team is fixed.
  if (activeOwnerPhones.length !== 1) {
    return {
      contactPhone: '',
      contactWhatsapp: '',
    }
  }

  return {
    contactPhone: activeOwnerPhones[0]!,
    contactWhatsapp: activeOwnerPhones[0]!,
  }
}
