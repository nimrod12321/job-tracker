export const OWNER_APPLICATIONS_PATH = '/owner/applications'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type OwnerApplicationsDeepLink = {
  candidateId: string | null
  candidateKind: 'externalLead' | null
  restaurantId: string | null
  scope: 'all' | 'selected'
}

export function parseOwnerApplicationsDeepLink(
  search: string,
): OwnerApplicationsDeepLink {
  const parameters = new URLSearchParams(search)
  const requestedRestaurantId = parameters.get('restaurantId')
  const requestedCandidateId = parameters.get('candidateId')
  const candidateKind = parameters.get('candidateKind')

  return {
    restaurantId:
      requestedRestaurantId && UUID_PATTERN.test(requestedRestaurantId)
        ? requestedRestaurantId
        : null,
    scope: parameters.get('scope') === 'all' ? 'all' : 'selected',
    candidateKind:
      candidateKind === 'externalLead' ? 'externalLead' : null,
    candidateId:
      candidateKind === 'externalLead' &&
      requestedCandidateId &&
      UUID_PATTERN.test(requestedCandidateId)
        ? requestedCandidateId
        : null,
  }
}

export function getSafeOwnerApplicationsReturnTo(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return null
  }

  const url = new URL(value, 'https://peepss.local')

  if (url.pathname !== OWNER_APPLICATIONS_PATH) {
    return null
  }

  const intent = parseOwnerApplicationsDeepLink(url.search)
  const parameters = new URLSearchParams()

  if (intent.scope === 'all') {
    parameters.set('scope', 'all')
  } else if (intent.restaurantId) {
    parameters.set('restaurantId', intent.restaurantId)
  }

  if (intent.candidateKind && intent.candidateId) {
    parameters.set('candidateKind', intent.candidateKind)
    parameters.set('candidateId', intent.candidateId)
  }

  const search = parameters.toString()

  return `${OWNER_APPLICATIONS_PATH}${search ? `?${search}` : ''}`
}
