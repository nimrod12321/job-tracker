import { prisma } from '../lib/prisma.js'
import { cleanupExpiredAnalytics } from '../services/analytics.service.js'

try {
  const result = await cleanupExpiredAnalytics()
  console.log(
    `Analytics cleanup complete: ${result.deletedEvents} events and ${result.deletedAcquisitions} acquisitions deleted.`,
  )
} catch (error) {
  console.error('Analytics cleanup failed:', error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
