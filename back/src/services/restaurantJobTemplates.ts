import type {
  RestaurantJob,
  RestaurantRole,
} from '../generated/prisma/client.js'

type RestaurantJobTemplate = Pick<
  RestaurantJob,
  'role' | 'shiftInfo' | 'requirements' | 'description'
>

const NEUTRAL_SHIFT_INFO =
  'פרטי המשמרות והיקף העבודה יימסרו בתהליך הגיוס.'

export const DEFAULT_RESTAURANT_JOB_BOARD_JOBS: RestaurantJobTemplate[] = [
  {
    role: 'waiter',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'שירותיות, אחריות, תקשורת טובה ויכולת עבודה בצוות.',
    description:
      'עבודה בצוות השירות, קבלת הזמנות, הגשה לאורחים ושמירה על חוויית אירוח נעימה ומקצועית.',
  },
  {
    role: 'bartender',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'שירותיות, אחריות, סדר ויכולת עבודה טובה בצוות.',
    description:
      'עבודה בצוות הבר הכוללת הכנת משקאות, שירות לאורחים ושמירה על עמדה מסודרת ונעימה.',
  },
  {
    role: 'host',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'תקשורת טובה, סדר, שירותיות ויחס נעים לאורחים.',
    description:
      'קבלת אורחים, ניהול סידורי הישיבה וסיוע ביצירת כניסה נעימה ומסודרת למסעדה.',
  },
  {
    role: 'cook',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'אחריות, סדר, עבודת צוות ויכולת עבודה בסביבה דינמית.',
    description:
      'עבודה בצוות המטבח, הכנות, תמיכה במהלך השירות ושמירה על סביבת עבודה נקייה ומסודרת.',
  },
  {
    role: 'floorManager',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'אחריות, תקשורת טובה, הובלת צוות וקבלת החלטות.',
    description:
      'ניהול מהלך המשמרת, תמיכה בצוות ומתן מענה שוטף כדי לשמור על שירות מסודר ונעים.',
  },
  {
    role: 'barista',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'שירותיות, דיוק, סדר ויכולת עבודה טובה בצוות.',
    description:
      'הכנת קפה ומשקאות, שירות לאורחים ושמירה על עמדה נקייה, מסודרת ומזמינה.',
  },
  {
    role: 'socialManager',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'יצירתיות, אחריות, עין טובה לתוכן והיכרות עם רשתות חברתיות.',
    description:
      'יצירת תוכן לרשתות החברתיות שמציג את האוכל, האווירה והסיפור של המסעדה בצורה אותנטית.',
  },
  {
    role: 'counterWorker',
    shiftInfo: NEUTRAL_SHIFT_INFO,
    requirements:
      'שירותיות, אחריות, סדר ויכולת עבודה בקצב משתנה.',
    description:
      'קבלת הזמנות, שירות ללקוחות, עבודה בעמדת הקופה ושמירה על עמדה מסודרת ונעימה.',
  },
]

// These were generated automatically before the Hebrew template refresh.
// Exact matching lets Admin safely refresh untouched system content without
// guessing whether an owner customized a listing.
const LEGACY_DEFAULT_RESTAURANT_JOB_BOARD_JOBS: RestaurantJobTemplate[] = [
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

export function isLegacyDefaultRestaurantJobBoardJob(
  job: RestaurantJobTemplate,
) {
  const legacyJob = LEGACY_DEFAULT_RESTAURANT_JOB_BOARD_JOBS.find(
    (template) => template.role === job.role,
  )

  return Boolean(
    legacyJob &&
      job.shiftInfo === legacyJob.shiftInfo &&
      job.requirements === legacyJob.requirements &&
      job.description === legacyJob.description,
  )
}
