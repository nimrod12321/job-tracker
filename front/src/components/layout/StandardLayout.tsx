import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import LegalFooter from '../legal/LegalFooter'

type StandardLayoutProps = {
  children?: ReactNode
  className?: string
  mainClassName?: string
  footerClassName?: string
}

function StandardLayout({
  children,
  className = '',
  mainClassName = '',
  footerClassName = '',
}: StandardLayoutProps) {
  const layoutClassName = ['standard-layout', className]
    .filter(Boolean)
    .join(' ')
  const contentClassName = ['standard-layout-main', mainClassName]
    .filter(Boolean)
    .join(' ')
  const legalFooterClassName = ['standard-layout-footer', footerClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={layoutClassName}>
      <main className={contentClassName}>{children ?? <Outlet />}</main>
      <LegalFooter className={legalFooterClassName} />
    </section>
  )
}

export default StandardLayout
