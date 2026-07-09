export function normalizePhoneNumber(phoneNumber: string) {
  const trimmedPhone = phoneNumber.trim()
  const hasLeadingPlus = trimmedPhone.startsWith('+')
  const digits = trimmedPhone.replace(/[^\d]/g, '')

  return hasLeadingPlus ? `+${digits}` : digits
}

export function normalizeIsraeliPhoneNumber(phoneNumber: string) {
  const trimmedPhone = phoneNumber.trim()
  const compactPhone = trimmedPhone
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\s\u00a0\u2000-\u200d\u202f\u205f\u3000]/g, '')
    .replace(/[-‐‑‒–—―()]/g, '')

  if (!/^\+?\d+$/.test(compactPhone)) {
    throw new Error('phone number is invalid')
  }

  let normalizedPhone = compactPhone

  if (/^05\d{8}$/.test(normalizedPhone)) {
    normalizedPhone = `+972${normalizedPhone.slice(1)}`
  } else if (/^9725\d{8}$/.test(normalizedPhone)) {
    normalizedPhone = `+${normalizedPhone}`
  }

  if (!/^\+9725\d{8}$/.test(normalizedPhone)) {
    throw new Error('phone number is invalid')
  }

  return normalizedPhone
}
