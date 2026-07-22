export type LegalPageKind = 'terms' | 'privacy' | 'accessibility' | 'contact'

export const legalContent: Record<
  LegalPageKind,
  {
    title: string
    intro: string
    sections: Array<{ heading: string; body: string }>
  }
> = {
  terms: {
    title: 'תנאי שימוש',
    intro:
      'השימוש ב-Peepss כפוף לתנאים אלה. הטקסט כאן הוא תקציר ראשוני ופשוט לשלב הבטא.',
    sections: [
      {
        heading: 'שימוש הוגן בשירות',
        body: 'יש להשתמש במערכת לצורך פרסום משרות, הגשת מועמדות וניהול מועמדים באופן ענייני, חוקי ומכבד.',
      },
      {
        heading: 'אחריות המשתמשים',
        body: 'מסעדות אחראיות לוודא שהמידע שהן מפרסמות נכון, רלוונטי ואינו מפלה. מועמדים אחראים למסור פרטים נכונים ועדכניים.',
      },
      {
        heading: 'שינויים בשירות',
        body: 'Peepss עשויה לעדכן את השירות, את התוכן ואת תנאי השימוש מעת לעת.',
      },
    ],
  },
  privacy: {
    title: 'מדיניות פרטיות',
    intro:
      'אנחנו אוספים רק את המידע הדרוש להפעלת תהליך הגיוס וההתאמה במסעדות.',
    sections: [
      {
        heading: 'איזה מידע נאסף',
        body: 'ייתכן שנאסוף שם, מספר טלפון, גיל, זמינות, ניסיון, תפקידים מועדפים ופרטי מסעדה לצורך תפעול השירות.',
      },
      {
        heading: 'שימוש במידע',
        body: 'המידע משמש לאימות מספר טלפון, העברת מועמדות למסעדה, ניהול מועמדים ושיפור השירות.',
      },
      {
        heading: 'שיתוף מידע',
        body: 'כאשר מועמד/ת שולח/ת מועמדות, Peepss מעבירה את הפרטים הרלוונטיים למסעדה שאליה הוגשה המועמדות.',
      },
    ],
  },
  accessibility: {
    title: 'הצהרת נגישות',
    intro:
      'Peepss שואפת לספק חוויית שימוש נגישה, פשוטה וברורה לכל המשתמשים.',
    sections: [
      {
        heading: 'התאמות בממשק',
        body: 'אנחנו מקפידים על ניגודיות קריאה, פוקוס ברור בשדות וכפתורים, תמיכה במובייל ותמיכה בעברית מימין לשמאל.',
      },
      {
        heading: 'דיווח על בעיית נגישות',
        body: 'אם נתקלתם בבעיה, נשמח לקבל פירוט כדי שנוכל לבדוק ולשפר.',
      },
    ],
  },
  contact: {
    title: 'יצירת קשר',
    intro: 'אפשר ליצור קשר עם צוות Peepss בכל שאלה, בקשה או דיווח.',
    sections: [
      {
        heading: 'אימייל',
        body: 'לפניות כלליות: hello@peepss.com',
      },
      {
        heading: 'נושאי פרטיות ונגישות',
        body: 'לפניות בנושא פרטיות, מחיקת מידע או נגישות, כתבו לנו ונחזור אליכם בהקדם האפשרי.',
      },
    ],
  },
}

export const englishLegalContent: typeof legalContent = {
  terms: {
    title: 'Terms of use',
    intro:
      'Use of Peepss is subject to these terms. This is a simple initial summary for the beta stage.',
    sections: [
      {
        heading: 'Fair use of the service',
        body: 'Use the service to post jobs, apply for work, and manage candidates in a relevant, lawful, and respectful way.',
      },
      {
        heading: 'User responsibilities',
        body: 'Restaurants are responsible for ensuring that their information is accurate, relevant, and non-discriminatory. Candidates are responsible for providing accurate, current information.',
      },
      {
        heading: 'Changes to the service',
        body: 'Peepss may update the service, its content, and these terms from time to time.',
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro:
      'We collect only the information needed to operate restaurant recruitment and matching.',
    sections: [
      {
        heading: 'Information we collect',
        body: 'We may collect a name, phone number, age, availability, experience, preferred roles, and restaurant details to operate the service.',
      },
      {
        heading: 'How information is used',
        body: 'Information is used to verify phone numbers, send applications to restaurants, manage candidates, and improve the service.',
      },
      {
        heading: 'Sharing information',
        body: 'When a candidate submits an application, Peepss shares the relevant details with the restaurant receiving that application.',
      },
    ],
  },
  accessibility: {
    title: 'Accessibility statement',
    intro:
      'Peepss aims to provide an accessible, simple, and clear experience for every user.',
    sections: [
      {
        heading: 'Interface accommodations',
        body: 'We work to provide readable contrast, visible focus states, mobile support, and right-to-left Hebrew support.',
      },
      {
        heading: 'Report an accessibility issue',
        body: 'If you encounter a problem, please send us the details so we can review and improve it.',
      },
    ],
  },
  contact: {
    title: 'Contact us',
    intro: 'Contact the Peepss team with any question, request, or report.',
    sections: [
      {
        heading: 'Email',
        body: 'General inquiries: hello@peepss.com',
      },
      {
        heading: 'Privacy and accessibility',
        body: 'For privacy, data deletion, or accessibility inquiries, write to us and we will respond as soon as possible.',
      },
    ],
  },
}
