import PeepssLogo from '../../../components/brand/PeepssLogo'

type LegalPageKind = 'terms' | 'privacy' | 'accessibility' | 'contact'

type LegalPageProps = {
  kind: LegalPageKind
}

const legalContent: Record<
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

function LegalPage({ kind }: LegalPageProps) {
  const content = legalContent[kind]

  return (
    <section className="legal-page" dir="rtl">
      <div className="legal-card">
        <PeepssLogo className="legal-logo" />
        <h1>{content.title}</h1>
        <p className="legal-intro">{content.intro}</p>

        <div className="legal-sections">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LegalPage
