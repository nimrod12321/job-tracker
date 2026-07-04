import type { ZodError } from 'zod'

export function getValidationErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'invalid request'
}
