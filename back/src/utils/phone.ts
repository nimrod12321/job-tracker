export function normalizePhoneNumber(phoneNumber: string) {
  const trimmedPhone = phoneNumber.trim()
  const hasLeadingPlus = trimmedPhone.startsWith('+')
  const digits = trimmedPhone.replace(/[^\d]/g, '')

  return hasLeadingPlus ? `+${digits}` : digits
}
