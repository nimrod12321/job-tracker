import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import PeepssLogo from '../../../components/brand/PeepssLogo'
import LegalFooter from '../../../components/legal/LegalFooter'
import {
  clearAuthToken,
  notifyAuthSessionExpired,
} from '../../auth/utils/authStorage'

function AdminShell({ children }: { children: ReactNode }) {
  function handleLogout() {
    clearAuthToken()
    notifyAuthSessionExpired()
  }

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div>
            <PeepssLogo className="admin-logo" />
            <p>Admin</p>
          </div>
          <button
            className="admin-logout-button"
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          <NavLink to="/admin/restaurants">Restaurants</NavLink>
          <NavLink to="/admin/leads">Leads</NavLink>
        </nav>
      </aside>
      <main className="admin-main">
        {children}
        <LegalFooter className="admin-legal-footer" />
      </main>
    </section>
  )
}

export default AdminShell
