export const CURRENT_LEGAL_POLICY_VERSION = '2026-11-14-beta'

export function requiresLegalAcceptanceForOtpPurpose(
  purpose: 'login' | 'register' | 'qrApply',
) {
  return purpose === 'register' || purpose === 'qrApply'
}

export function getLegalConsentData(acceptedAt = new Date()) {
  return {
    legalAcceptedAt: acceptedAt,
    legalPolicyVersion: CURRENT_LEGAL_POLICY_VERSION,
  }
}

export function getInitialMarketingConsentData(
  marketingSmsOptIn: boolean,
  consentedAt = new Date(),
) {
  return marketingSmsOptIn
    ? {
        marketingSmsEnabled: true,
        marketingSmsConsentedAt: consentedAt,
        marketingSmsOptedOutAt: null,
      }
    : {
        marketingSmsEnabled: false,
        marketingSmsConsentedAt: null,
        marketingSmsOptedOutAt: null,
      }
}
