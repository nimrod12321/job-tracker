import { useState } from 'react'
import PeepssModal from '../common/PeepssModal'
import {
  englishLegalContent,
  legalContent,
  type LegalPageKind,
} from '../../features/legal/legalContent'
import { useRestaurantLanguage } from '../../features/restaurant/utils/restaurantLanguage'

type LegalFooterProps = {
  className?: string
}

function LegalFooter({ className = '' }: LegalFooterProps) {
  const { direction, language } = useRestaurantLanguage()
  const [openKind, setOpenKind] = useState<LegalPageKind | null>(null)
  const footerClassName = ['site-legal-footer', className]
    .filter(Boolean)
    .join(' ')
  const localizedContent =
    language === 'he' ? legalContent : englishLegalContent
  const openContent = openKind ? localizedContent[openKind] : null
  const footerItems: Array<{ kind: LegalPageKind; label: string }> =
    language === 'he'
      ? [
          { kind: 'terms', label: 'תנאי שימוש' },
          { kind: 'privacy', label: 'מדיניות פרטיות' },
          { kind: 'accessibility', label: 'הצהרת נגישות' },
          { kind: 'contact', label: 'יצירת קשר' },
        ]
      : [
          { kind: 'terms', label: 'Terms of use' },
          { kind: 'privacy', label: 'Privacy policy' },
          { kind: 'accessibility', label: 'Accessibility' },
          { kind: 'contact', label: 'Contact us' },
        ]

  return (
    <footer className={footerClassName} dir={direction}>
      <nav aria-label={language === 'he' ? 'קישורים משפטיים' : 'Legal links'}>
        {footerItems.map((item, index) => (
          <span className="site-legal-footer-item" key={item.kind}>
            {index > 0 && <span aria-hidden="true">|</span>}
            <button
              className="site-legal-footer-text-button ui-button ui-button--tertiary"
              type="button"
              onClick={() => setOpenKind(item.kind)}
            >
              {item.label}
            </button>
          </span>
        ))}
      </nav>
      <p>
        {language === 'he'
          ? '© 2026 Peepss. כל הזכויות שמורות.'
          : '© 2026 Peepss. All rights reserved.'}
      </p>
      {openContent && (
        <PeepssModal
          isOpen={Boolean(openKind)}
          onClose={() => setOpenKind(null)}
          size={openKind === 'contact' ? 'small' : 'large'}
          title={openContent.title}
        >
          <div className="legal-modal-content" dir={direction}>
            <p className="legal-intro">{openContent.intro}</p>
            <div className="legal-sections">
              {openContent.sections.map((section) => (
                <section key={section.heading}>
                  <h3>{section.heading}</h3>
                  <p>{section.body}</p>
                </section>
              ))}
            </div>
          </div>
        </PeepssModal>
      )}
    </footer>
  )
}

export default LegalFooter
