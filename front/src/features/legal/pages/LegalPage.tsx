import PeepssLogo from '../../../components/brand/PeepssLogo'
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
