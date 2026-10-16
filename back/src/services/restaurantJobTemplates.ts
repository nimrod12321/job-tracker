import type { RestaurantJob, RestaurantRole } from '../generated/prisma/client.js'

export const DEFAULT_RESTAURANT_JOB_BOARD_JOBS: Array<
  Pick<RestaurantJob, 'role' | 'shiftInfo' | 'requirements' | 'description'>
> = [
  {
    role: 'waiter',
    shiftInfo:
      '3–4 shifts per week, including at least one weekend shift.',
    requirements:
      'Service mindset, responsibility, good communication. Previous restaurant experience is a plus.',
    description:
      'Join the floor team for regular restaurant service. Serve guests, work with the team, and keep service smooth and friendly.',
  },
  {
    role: 'bartender',
    shiftInfo:
      'Mostly evening shifts, 3–4 shifts per week, including at least one weekend shift.',
    requirements:
      'Bar experience is a plus, ability to work fast, responsibility, and good service attitude.',
    description:
      'Bar shift in a restaurant/bar environment. Prepare drinks, serve guests, and work closely with the floor team.',
  },
  {
    role: 'host',
    shiftInfo: 'Evening and weekend shifts, 3–4 shifts per week.',
    requirements:
      'Good communication, organized work, welcoming attitude, and responsibility.',
    description:
      'Welcome guests, manage seating flow, answer basic questions, and help the restaurant service run smoothly.',
  },
  {
    role: 'cook',
    shiftInfo:
      '3–4 shifts per week, morning/evening depending on restaurant needs, including at least one weekend shift.',
    requirements:
      'Kitchen experience is a plus, clean work, reliability, and ability to work under pressure.',
    description:
      'Kitchen shift including prep, service support, and clean organized work with the kitchen team.',
  },
  {
    role: 'floorManager',
    shiftInfo:
      '3–4 shifts per week, including evening and weekend availability.',
    requirements:
      'Restaurant experience, responsibility, team management ability, and strong communication.',
    description:
      'Manage the shift, support the floor team, solve service issues, and help keep the restaurant running smoothly.',
  },
  {
    role: 'barista',
    shiftInfo:
      'Morning and afternoon shifts, 3–4 shifts per week, including weekend availability.',
    requirements:
      'Coffee experience is a plus, clean work, friendly service, and reliability.',
    description:
      'Prepare coffee and drinks, support counter service, keep the station clean, and help guests quickly and warmly.',
  },
  {
    role: 'socialManager',
    shiftInfo:
      'Flexible shifts, a few content sessions per week around busy service hours.',
    requirements:
      'Good eye for content, responsibility, basic social media skills, and comfort working around a restaurant team.',
    description:
      'Create simple social content for the restaurant, capture food/service moments, and help the place show its vibe online.',
  },
  {
    role: 'counterWorker',
    shiftInfo:
      'Morning, afternoon, or evening shifts, 3–4 shifts per week, depending on service needs.',
    requirements:
      'Friendly service, clean work, responsibility, and ability to work quickly at the counter.',
    description:
      'Work at the counter, take orders, support guests, keep the station organized, and help service move smoothly.',
  },
]

export function getDefaultRestaurantJobBoardJob(role: RestaurantRole) {
  const job = DEFAULT_RESTAURANT_JOB_BOARD_JOBS.find(
    (job) => job.role === role,
  )

  if (!job) {
    throw new Error(`No default Job Board template exists for role: ${role}`)
  }

  return job
}
