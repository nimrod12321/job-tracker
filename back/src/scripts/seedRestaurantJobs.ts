import {
  RestaurantJobKind,
  RestaurantRole,
} from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'

const DEMO_REAL_PLACE_SOURCE = 'source=demo_real_place'
const DEMO_REAL_PLACE_NOTE = 'Demo listing — not verified by restaurant.'

function createDemoRealPlaceJob({
  restaurantName,
  role,
  area,
  description,
  requirements,
  shiftInfo,
}: {
  restaurantName: string
  role: RestaurantRole
  area: string
  description: string
  requirements: string
  shiftInfo: string
}) {
  return {
    restaurantName,
    role,
    location: 'Tel Aviv',
    area,
    description: `${DEMO_REAL_PLACE_SOURCE}. ${description}`,
    requirements: `${DEMO_REAL_PLACE_NOTE} ${requirements}`,
    shiftInfo,
    contactPhone: '',
    contactWhatsapp: '',
  }
}

const demoRealPlaceRestaurantJobs = [
  createDemoRealPlaceJob({
    restaurantName: 'Ouzeria',
    role: RestaurantRole.waiter,
    area: 'Matalon 44',
    description:
      'Busy evening service in a lively Mediterranean restaurant. Help the team keep service fast, clean and friendly.',
    requirements:
      'Positive attitude, reliability and a strong service mindset. Experience is a plus.',
    shiftInfo: 'Evening shifts, weekends available',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Ouzeria',
    role: RestaurantRole.cook,
    area: 'Matalon 44',
    description:
      'Lively dinner service with Mediterranean food and a fast-moving kitchen team.',
    requirements:
      'Kitchen basics, cleanliness and ability to stay calm during busy service.',
    shiftInfo: 'Evening prep and dinner shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Ouzeria',
    role: RestaurantRole.host,
    area: 'Matalon 44',
    description:
      'Welcome guests, support reservations and help keep the entrance flow smooth.',
    requirements:
      'Warm communication, organization and comfort speaking with guests.',
    shiftInfo: 'Dinner shifts, weekend availability helpful',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Ouzeria Next Door',
    role: RestaurantRole.bartender,
    area: 'Zvulun 25',
    description:
      'Mediterranean bar/restaurant vibe with busy evening drinks and food service.',
    requirements:
      'Bar experience is helpful. Reliability and clean work habits are important.',
    shiftInfo: 'Evening shifts, late weekends',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Ouzeria Next Door',
    role: RestaurantRole.waiter,
    area: 'Zvulun 25',
    description:
      'Casual bar/restaurant service with a lively Tel Aviv crowd and team rhythm.',
    requirements:
      'Service mindset, positive energy and willingness to learn the menu.',
    shiftInfo: 'Evening shifts, weekends available',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Casbah',
    role: RestaurantRole.waiter,
    area: 'Florentin St 3',
    description:
      'Cafe/restaurant service with a Florentin neighborhood vibe and steady table flow.',
    requirements:
      'Friendly attitude, reliability and basic service communication.',
    shiftInfo: 'Morning and evening shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Casbah',
    role: RestaurantRole.host,
    area: 'Florentin St 3',
    description:
      'Greet guests, manage waiting lists and support the floor during busy periods.',
    requirements:
      'Organized, welcoming and comfortable handling quick changes.',
    shiftInfo: 'Evening and weekend shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Casbah',
    role: RestaurantRole.cook,
    area: 'Florentin St 3',
    description:
      'Support a compact cafe kitchen with prep, line work and clean handoffs.',
    requirements:
      'Kitchen experience is a plus. Clean, reliable work is required.',
    shiftInfo: 'Day and evening shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Florentina',
    role: RestaurantRole.waiter,
    area: 'Abarbanel 56',
    description:
      'Italian dairy restaurant/bar service with a casual Florentin dinner atmosphere.',
    requirements:
      'Good guest communication, teamwork and reliable availability.',
    shiftInfo: 'Evening shifts, weekends available',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Florentina',
    role: RestaurantRole.cook,
    area: 'Abarbanel 56',
    description:
      'Prepare Italian dairy dishes and support dinner service in a busy kitchen.',
    requirements:
      'Basic kitchen experience, cleanliness and ability to follow prep lists.',
    shiftInfo: 'Afternoon prep and evening service',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Florentina',
    role: RestaurantRole.floorManager,
    area: 'Abarbanel 56',
    description:
      'Help lead floor service, coordinate tables and keep the team moving smoothly.',
    requirements:
      'Restaurant service experience and calm communication during pressure.',
    shiftInfo: 'Four to five evening shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Florentina',
    role: RestaurantRole.bartender,
    area: 'Abarbanel 56',
    description:
      'Italian restaurant/bar shift with wine, simple drinks and dinner service support.',
    requirements:
      'Bar basics, clean work habits and friendly guest interaction.',
    shiftInfo: 'Evening bar shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Levinsky 41',
    role: RestaurantRole.waiter,
    area: 'Levinski 41',
    description:
      'Small cafe/gazoz/coffee stand with quick service and a friendly street-side feel.',
    requirements:
      'Fast hands, positive attitude and comfort with short customer interactions.',
    shiftInfo: 'Morning and afternoon shifts',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Levinsky 41',
    role: RestaurantRole.host,
    area: 'Levinski 41',
    description:
      'Support guest flow, orders and friendly service in a compact cafe setting.',
    requirements:
      'Warm communication, reliability and attention to small details.',
    shiftInfo: 'Daytime shifts, Fridays helpful',
  }),
  createDemoRealPlaceJob({
    restaurantName: 'Cafe Levinsky 41',
    role: RestaurantRole.cook,
    area: 'Levinski 41',
    description:
      'Help with light prep, clean station work and quick cafe service support.',
    requirements:
      'Food prep basics are helpful. Clean and reliable work is required.',
    shiftInfo: 'Morning prep and daytime shifts',
  }),
]

const restaurantJobs = [
  ...demoRealPlaceRestaurantJobs,
  {
    restaurantName: 'Cafe Levinsky',
    role: RestaurantRole.waiter,
    location: 'Tel Aviv',
    area: 'Levinsky',
    description: 'Friendly neighborhood cafe looking for an energetic waiter.',
    requirements: 'Good communication and a service-oriented attitude.',
    shiftInfo: 'Morning and afternoon shifts',
    contactPhone: '03-555-0101',
    contactWhatsapp: '972505550101',
  },
  {
    restaurantName: 'Rothschild Bar',
    role: RestaurantRole.bartender,
    location: 'Tel Aviv',
    area: 'Rothschild',
    description: 'Busy cocktail bar hiring a bartender for evening service.',
    requirements: 'Previous bar experience is preferred.',
    shiftInfo: 'Evening and weekend shifts',
    contactWhatsapp: '972505550102',
  },
  {
    restaurantName: 'Jaffa Bistro',
    role: RestaurantRole.host,
    location: 'Jaffa',
    area: 'Old Jaffa',
    description: 'Welcome guests and manage reservations at a lively bistro.',
    requirements: 'Organized, warm, and comfortable speaking with guests.',
    shiftInfo: 'Evening shifts',
    contactPhone: '03-555-0103',
  },
  {
    restaurantName: 'Dizengoff Grill',
    role: RestaurantRole.cook,
    location: 'Tel Aviv',
    area: 'Dizengoff',
    description: 'Join a fast-moving grill kitchen in central Tel Aviv.',
    requirements: 'Basic kitchen experience and ability to work under pressure.',
    shiftInfo: 'Flexible day and evening shifts',
    contactWhatsapp: '972505550104',
  },
  {
    restaurantName: 'Florentin Kitchen',
    role: RestaurantRole.floorManager,
    location: 'Tel Aviv',
    area: 'Florentin',
    description: 'Lead the floor team in a casual neighborhood restaurant.',
    requirements: 'Restaurant leadership experience and strong people skills.',
    shiftInfo: 'Five shifts per week',
    contactPhone: '03-555-0105',
  },
  {
    restaurantName: 'Morning People',
    role: RestaurantRole.waiter,
    location: 'Tel Aviv',
    area: 'Dizengoff',
    description: 'Popular brunch spot seeking a cheerful waiter.',
    requirements: 'Availability on Fridays and Saturdays.',
    shiftInfo: 'Morning shifts',
    contactWhatsapp: '972505550106',
  },
  {
    restaurantName: 'The Green Shaker',
    role: RestaurantRole.bartender,
    location: 'Tel Aviv',
    area: 'Florentin',
    description: 'Small local bar with a relaxed team and busy nights.',
    requirements: 'Cocktail knowledge is an advantage.',
    shiftInfo: 'Three to five evening shifts',
    contactPhone: '03-555-0107',
  },
  {
    restaurantName: 'Herzl Table',
    role: RestaurantRole.host,
    location: 'Tel Aviv',
    area: 'Florentin',
    description: 'Host guests and support smooth table turnover.',
    requirements: 'Strong communication and basic English.',
    shiftInfo: 'Evening shifts',
    contactWhatsapp: '972505550108',
  },
  {
    restaurantName: 'Port Oven',
    role: RestaurantRole.cook,
    location: 'Tel Aviv',
    area: 'Tel Aviv Port',
    description: 'Prepare fresh Mediterranean dishes in an open kitchen.',
    requirements: 'One year of kitchen experience is preferred.',
    shiftInfo: 'Full-time or part-time',
    contactPhone: '03-555-0109',
  },
  {
    restaurantName: 'Ramat Gan Social',
    role: RestaurantRole.floorManager,
    location: 'Ramat Gan',
    area: 'Bursa',
    description: 'Manage daily floor operations and support the service team.',
    requirements: 'At least one year in a shift-management role.',
    shiftInfo: 'Evenings and weekends',
    contactWhatsapp: '972505550110',
  },
  {
    restaurantName: 'Givatayim Corner',
    role: RestaurantRole.waiter,
    location: 'Givatayim',
    area: 'Katznelson',
    description: 'Community cafe looking for a reliable waiter.',
    requirements: 'No experience required; training is provided.',
    shiftInfo: 'Flexible weekly schedule',
    contactPhone: '03-555-0111',
  },
  {
    restaurantName: 'Marina Drinks',
    role: RestaurantRole.bartender,
    location: 'Herzliya',
    area: 'Herzliya Marina',
    description: 'Waterfront restaurant hiring for its bar team.',
    requirements: 'Service experience and weekend availability.',
    shiftInfo: 'Evenings and weekends',
    contactWhatsapp: '972505550112',
  },
  {
    restaurantName: 'Jaffa Courtyard',
    role: RestaurantRole.host,
    location: 'Jaffa',
    area: 'Flea Market',
    description: 'Create a welcoming first impression at a busy courtyard venue.',
    requirements: 'Friendly, composed, and organized.',
    shiftInfo: 'Four evening shifts',
    contactPhone: '03-555-0113',
  },
  {
    restaurantName: 'Levinsky Bakery',
    role: RestaurantRole.cook,
    location: 'Tel Aviv',
    area: 'Levinsky',
    description: 'Prepare sandwiches, salads, and light cafe dishes.',
    requirements: 'Early-morning availability.',
    shiftInfo: 'Morning shifts from 06:00',
    contactWhatsapp: '972505550114',
  },
  {
    restaurantName: 'Bialik House Cafe',
    role: RestaurantRole.floorManager,
    location: 'Tel Aviv',
    area: 'City Center',
    description: 'Coordinate service and shifts in a calm daytime cafe.',
    requirements: 'Previous floor or shift-management experience.',
    shiftInfo: 'Daytime shifts',
    contactPhone: '03-555-0115',
  },
  {
    restaurantName: 'Rothschild Brasserie',
    role: RestaurantRole.waiter,
    location: 'Tel Aviv',
    area: 'Rothschild',
    description: 'Professional service role in a high-volume brasserie.',
    requirements: 'At least six months of restaurant experience.',
    shiftInfo: 'Lunch and dinner shifts',
    contactWhatsapp: '972505550116',
  },
  {
    restaurantName: 'Jaffa Sunset',
    role: RestaurantRole.bartender,
    location: 'Jaffa',
    area: 'Jaffa Port',
    description: 'Mix drinks at a casual bar overlooking the sea.',
    requirements: 'Bartending course or practical experience.',
    shiftInfo: 'Late afternoon and evening',
    contactPhone: '03-555-0117',
  },
  {
    restaurantName: 'Garden Room',
    role: RestaurantRole.host,
    location: 'Givatayim',
    area: 'Borochov',
    description: 'Manage reservations and greet guests in a neighborhood venue.',
    requirements: 'Clear communication and attention to detail.',
    shiftInfo: 'Part-time evenings',
    contactWhatsapp: '972505550118',
  },
  {
    restaurantName: 'Herzliya Pasta Lab',
    role: RestaurantRole.cook,
    location: 'Herzliya',
    area: 'Industrial Area',
    description: 'Support fresh pasta preparation and dinner service.',
    requirements: 'Kitchen experience is helpful but not required.',
    shiftInfo: 'Afternoon and evening shifts',
    contactPhone: '09-555-0119',
  },
  {
    restaurantName: 'Urban Plate',
    role: RestaurantRole.floorManager,
    location: 'Ramat Gan',
    area: 'City Center',
    description: 'Run shifts and maintain a warm guest experience.',
    requirements: 'Leadership skills and restaurant service experience.',
    shiftInfo: 'Full-time rotating shifts',
    contactWhatsapp: '972505550120',
  },
  {
    restaurantName: 'Cafe Nordau',
    role: RestaurantRole.waiter,
    location: 'Tel Aviv',
    area: 'Old North',
    description: 'Join a friendly local cafe serving breakfast and lunch.',
    requirements: 'Positive attitude and weekend availability.',
    shiftInfo: 'Morning and lunch shifts',
    contactPhone: '03-555-0121',
  },
  {
    restaurantName: 'Allenby Night',
    role: RestaurantRole.bartender,
    location: 'Tel Aviv',
    area: 'Allenby',
    description: 'Fast-paced bar looking for an experienced night bartender.',
    requirements: 'At least one year behind a busy bar.',
    shiftInfo: 'Night shifts',
    contactWhatsapp: '972505550122',
  },
  {
    restaurantName: 'Ramat Gan Terrace',
    role: RestaurantRole.host,
    location: 'Ramat Gan',
    area: 'Marom Nave',
    description: 'Welcome families and manage the evening reservation list.',
    requirements: 'Patient and service-minded.',
    shiftInfo: 'Evenings and weekends',
    contactPhone: '03-555-0123',
  },
  {
    restaurantName: 'Shuk Kitchen',
    role: RestaurantRole.cook,
    location: 'Tel Aviv',
    area: 'Carmel Market',
    description: 'Cook fresh market dishes in a compact open kitchen.',
    requirements: 'Comfortable with prep and line work.',
    shiftInfo: 'Day and evening shifts',
    contactWhatsapp: '972505550124',
  },
  {
    restaurantName: 'Dizengoff Dining',
    role: RestaurantRole.floorManager,
    location: 'Tel Aviv',
    area: 'Dizengoff',
    description: 'Supervise service at a polished but relaxed restaurant.',
    requirements: 'Two years of restaurant experience.',
    shiftInfo: 'Full-time',
    contactPhone: '03-555-0125',
  },
  {
    restaurantName: 'Jaffa Breakfast Club',
    role: RestaurantRole.waiter,
    location: 'Jaffa',
    area: 'Noga',
    description: 'Serve breakfast and coffee in a creative neighborhood cafe.',
    requirements: 'Early availability and conversational English.',
    shiftInfo: 'Morning shifts',
    contactWhatsapp: '972505550126',
  },
  {
    restaurantName: 'Givatayim Taproom',
    role: RestaurantRole.bartender,
    location: 'Givatayim',
    area: 'Katznelson',
    description: 'Pour local beer and simple cocktails in a neighborhood taproom.',
    requirements: 'Bar experience is preferred.',
    shiftInfo: 'Evening shifts',
    contactPhone: '03-555-0127',
  },
  {
    restaurantName: 'Marina Welcome',
    role: RestaurantRole.host,
    location: 'Herzliya',
    area: 'Herzliya Marina',
    description: 'Coordinate reservations at a busy waterfront restaurant.',
    requirements: 'Professional communication and weekend availability.',
    shiftInfo: 'Lunch and dinner shifts',
    contactWhatsapp: '972505550128',
  },
  {
    restaurantName: 'Florentin Fire',
    role: RestaurantRole.cook,
    location: 'Tel Aviv',
    area: 'Florentin',
    description: 'Work the grill and prep station in a casual late-night kitchen.',
    requirements: 'Previous line-cook experience.',
    shiftInfo: 'Evening and night shifts',
    contactPhone: '03-555-0129',
  },
  {
    restaurantName: 'Herzliya Beach House',
    role: RestaurantRole.floorManager,
    location: 'Herzliya',
    area: 'Beachfront',
    description: 'Lead a young service team at a busy beach restaurant.',
    requirements: 'Shift-management experience and strong availability.',
    shiftInfo: 'Full-time including weekends',
    contactWhatsapp: '972505550130',
  },
]

async function seedRestaurantJobs() {
  let createdCount = 0

  for (const job of restaurantJobs) {
    const existingJob = await prisma.restaurantJob.findFirst({
      where: {
        restaurantName: job.restaurantName,
        role: job.role,
        location: job.location,
        area: job.area,
      },
      select: {
        id: true,
      },
    })

    if (!existingJob) {
      await prisma.restaurantJob.create({
        data: {
          ...job,
          kind: RestaurantJobKind.posted,
        },
      })
      createdCount += 1
    }
  }

  console.log(
    `Restaurant job seed complete: ${createdCount} created, ${
      restaurantJobs.length - createdCount
    } already existed.`,
  )
}

try {
  await seedRestaurantJobs()
} catch (error) {
  console.error('Failed to seed restaurant jobs:', error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
