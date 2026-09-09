import { useEffect, useState } from 'react'
import Avatar from './Avatar'
import './Sidebar.css'

const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: '🏠', path: '/' },
  { key: 'journal', label: 'Journal', icon: '📖', path: '/journal' },
  { key: 'ai', label: 'AI Coach', icon: '🤖', path: '/ai' },
  { key: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
]

function getProfileAvatar() {
  try {
    return JSON.parse(localStorage.getItem('memoir_profile'))?.avatar || null
  } catch {
    return null
  }
}

function Sidebar({ currentSection, username, onNavigate, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const [avatar, setAvatar] = useState(getProfileAvatar)

  useEffect(() => {
    const syncAvatar = () => setAvatar(getProfileAvatar())
    window.addEventListener('memoir-profile-change', syncAvatar)
    return () => window.removeEventListener('memoir-profile-change', syncAvatar)
  }, [])

  return (
    <aside className={`app-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="app-sidebar-top">
        {!collapsed && <div className="app-sidebar-brand">📖 Memoir</div>}
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      <nav className="app-sidebar-nav" aria-label="Breadcrumb navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-sidebar-link${currentSection === item.key ? ' active' : ''}`}
            onClick={() => onNavigate(item.path)}
            aria-current={currentSection === item.key ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <span className="app-sidebar-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        {!collapsed && username && (
          <div className="app-sidebar-user">
            <span className="app-sidebar-avatar">
              <Avatar avatar={avatar} />
            </span>
            <span>{username}</span>
          </div>
        )}
        <button
          type="button"
          className="app-sidebar-logout"
          onClick={onLogout}
          title={collapsed ? 'Log out' : undefined}
        >
          {collapsed ? '↩' : '↩ Log out'}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
