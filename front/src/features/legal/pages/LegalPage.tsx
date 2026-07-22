import { useRestaurantLanguage } from '../../restaurant/utils/restaurantLanguage'
import {
  englishLegalContent,
  legalContent,
  type LegalPageKind,
} from '../legalContent'

type LegalPageProps = {
  kind: LegalPageKind
}

function LegalPage({ kind }: LegalPageProps) {
  const { direction, language } = useRestaurantLanguage()
  const content =
    (language === 'he' ? legalContent : englishLegalContent)[kind]

  return (
    <section className="legal-page" dir={direction}>
      <div className="legal-card">
        <span className="peepss-logo legal-logo" aria-label="Peepss" dir="ltr">
          <span className="peepss-logo-circle" />
          <span className="peepss-logo-thin">p</span>
          <span className="peepss-logo-bold">ee</span>
          <span className="peepss-logo-thin">pss</span>
        </span>
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
