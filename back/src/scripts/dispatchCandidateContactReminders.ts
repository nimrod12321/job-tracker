import { prisma } from '../lib/prisma.js'
import { dispatchCandidateContactRemindersFromEnvironment } from '../services/candidateContactReminder.service.js'

try {
  const result = await dispatchCandidateContactRemindersFromEnvironment()

  console.log('Candidate contact reminder dispatch completed', result)
} catch {
  console.error('Candidate contact reminder dispatch failed', {
    safeErrorCode: 'candidate_contact_reminder_dispatch_failed',
  })
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
