import { LogOut, Search } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { adminModules } from '../../entities/mockData'
import { Brand } from './Brand'

export function AdminShell() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand admin />
        <nav aria-label="Admin naviqasiyası">
          <NavLink end to="/admin">
            Dashboard
          </NavLink>
          {adminModules.map(({ icon: Icon, route, title }) => (
            <NavLink key={route} to={route}>
              <Icon size={18} />
              {title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <label className="admin-search">
            <Search size={18} />
            <input placeholder="Admin daxilində axtar..." />
          </label>
          <div>
            <span>Online-only MVP</span>
            <strong>Contract-gated onboarding</strong>
          </div>
          <button className="icon-action" type="button" title="Çıxış">
            <LogOut size={18} />
          </button>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
