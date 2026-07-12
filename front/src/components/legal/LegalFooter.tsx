import { Link } from 'react-router-dom'

type LegalFooterProps = {
  className?: string
}

function LegalFooter({ className = '' }: LegalFooterProps) {
  const footerClassName = ['site-legal-footer', className]
    .filter(Boolean)
    .join(' ')

  return (
    <footer className={footerClassName}>
      <nav aria-label="קישורים משפטיים">
        <Link to="/terms">תנאי שימוש</Link>
        <span aria-hidden="true">|</span>
        <Link to="/privacy">מדיניות פרטיות</Link>
        <span aria-hidden="true">|</span>
        <Link to="/accessibility">הצהרת נגישות</Link>
        <span aria-hidden="true">|</span>
        <Link to="/contact">יצירת קשר</Link>
      </nav>
      <p>© 2026 Peepss. כל הזכויות שמורות.</p>
    </footer>
  )
}

export default LegalFooter
