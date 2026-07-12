export function formatIsraeliPhoneForDisplay(phone: string) {
  const trimmedPhone = phone.trim()
  const match = trimmedPhone.match(/^\+972(5\d{8})$/)

  if (!match) {
    return trimmedPhone
  }

  const localPhone = `0${match[1]}`

  return `${localPhone.slice(0, 3)}-${localPhone.slice(3)}`
}
