import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
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
            <span className="peepss-logo admin-logo" dir="ltr">
              <span className="peepss-logo-circle" />
              <span className="peepss-logo-thin">p</span>
              <span className="peepss-logo-bold">ee</span>
              <span className="peepss-logo-thin">pss</span>
            </span>
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
      <main className="admin-main">{children}</main>
    </section>
  )
}

export default AdminShell
