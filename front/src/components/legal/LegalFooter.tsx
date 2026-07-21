import { useState } from 'react'
import PeepssModal from '../common/PeepssModal'
import {
  legalContent,
  type LegalPageKind,
} from '../../features/legal/legalContent'

type LegalFooterProps = {
  className?: string
}

function LegalFooter({ className = '' }: LegalFooterProps) {
  const [openKind, setOpenKind] = useState<LegalPageKind | null>(null)
  const footerClassName = ['site-legal-footer', className]
    .filter(Boolean)
    .join(' ')
  const openContent = openKind ? legalContent[openKind] : null
  const footerItems: Array<{ kind: LegalPageKind; label: string }> = [
    { kind: 'terms', label: 'תנאי שימוש' },
    { kind: 'privacy', label: 'מדיניות פרטיות' },
    { kind: 'accessibility', label: 'הצהרת נגישות' },
    { kind: 'contact', label: 'יצירת קשר' },
  ]

  return (
    <footer className={footerClassName}>
      <nav aria-label="קישורים משפטיים">
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
      <p>© 2026 Peepss. כל הזכויות שמורות.</p>
      {openContent && (
        <PeepssModal
          isOpen={Boolean(openKind)}
          onClose={() => setOpenKind(null)}
          size={openKind === 'contact' ? 'small' : 'large'}
          title={openContent.title}
        >
          <div className="legal-modal-content" dir="rtl">
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
