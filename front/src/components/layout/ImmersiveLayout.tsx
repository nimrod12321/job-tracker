import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'

type ImmersiveLayoutProps = {
  children?: ReactNode
  className?: string
  mainClassName?: string
}

function ImmersiveLayout({
  children,
  className = '',
  mainClassName = '',
}: ImmersiveLayoutProps) {
  const layoutClassName = ['immersive-layout', className]
    .filter(Boolean)
    .join(' ')
  const contentClassName = ['immersive-layout-main', mainClassName]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={layoutClassName}>
      <main className={contentClassName}>{children ?? <Outlet />}</main>
    </section>
  )
}

export default ImmersiveLayout
