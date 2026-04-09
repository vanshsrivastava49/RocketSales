import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchHealth } from '../api'
import ProfilePage from '../pages/ProfilePage'
import Dashboard from './Dashboard'
import SinglePredictor from './SinglePredictor'
import BulkPredictor from './BulkPredictor'
import styles from './AppShell.module.css'

// Header.jsx is not mounted anywhere — AppShell owns the header directly.
// The /health poll is handled here so it's tied to the shell's lifetime.

function ComingSoon({ label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 400, gap: 12, color: 'var(--muted2)',
    }}>
      <div style={{ fontSize: 40 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Coming soon</div>
    </div>
  )
}

// Icons added to every nav item — previously all were undefined, causing every
// <span className={styles.navIcon}> to render as an empty element.
const NAV_MAIN = [
  { id: 'overview',  label: 'Overview',   icon: '◈' },
  { id: 'analytics', label: 'Analytics',  icon: '↗' },
]
const NAV_TOOLS = [
  { id: 'single', label: 'Single Predictor', icon: '◎' },
  { id: 'bulk',   label: 'Bulk Analysis',    icon: '▤' },
  { id: 'market', label: 'Market Stats',     icon: '⊞' },
]
const NAV_ACCOUNT = [
  { id: 'profile',  label: 'My Profile', icon: '○' },
  { id: 'settings', label: 'Settings',   icon: '⊙' },
  { id: 'billing',  label: 'Billing',    icon: '◇' },
]

export default function AppShell() {
  const { user, logout } = useAuth()
  const [activeNav, setActiveNav] = useState('overview')
  const [health, setHealth]       = useState(null)

  // Poll /health once on mount to show model status in the header.
  // Polling here (not in a standalone Header component) so it shares
  // the shell's lifecycle and isn't duplicated across re-mounts.
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const initials = (
    (user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')
  ).toUpperCase() || 'S'

  const renderPage = () => {
    switch (activeNav) {
      case 'overview':  return <Dashboard />
      case 'analytics': return <Dashboard />      // swap for <Analytics /> when ready
      case 'single':    return <SinglePredictor />
      case 'bulk':      return <BulkPredictor />
      case 'market':    return <Dashboard />       // swap for <MarketStats /> when ready
      case 'profile':   return <ProfilePage />
      case 'settings':  return <ComingSoon label="Settings coming soon" />
      case 'billing':   return <ComingSoon label="Billing coming soon" />
      default:          return <Dashboard />
    }
  }

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>Rocket<span>Sales</span></div>
          <span className={styles.badge}>AI v2</span>

          {/* Model health indicator — sourced from GET /health */}
          {health !== null && (
            <div className={styles.healthStatus}>
              <span className={`${styles.healthDot} ${health.model_trained ? styles.dotGreen : styles.dotYellow}`} />
              <span className={styles.healthText}>
                {health.model_trained
                  ? `ML · ${health.training_samples?.toLocaleString()} samples`
                  : 'Rule-based mode'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{user?.first_name} {user?.last_name}</div>
            <div className={styles.userPlan}>
              {user?.store_name || 'My Store'} · {user?.plan || 'free'}
            </div>
          </div>
          <div className={styles.avatar}>{initials}</div>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </header>

      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <nav className={styles.sidebar}>
          <NavSection label="Main">
            {NAV_MAIN.map(n => (
              <NavItem key={n.id} {...n} active={activeNav === n.id} onClick={() => setActiveNav(n.id)} />
            ))}
          </NavSection>
          <NavSection label="Tools">
            {NAV_TOOLS.map(n => (
              <NavItem key={n.id} {...n} active={activeNav === n.id} onClick={() => setActiveNav(n.id)} />
            ))}
          </NavSection>
          <NavSection label="Account">
            {NAV_ACCOUNT.map(n => (
              <NavItem key={n.id} {...n} active={activeNav === n.id} onClick={() => setActiveNav(n.id)} />
            ))}
          </NavSection>
        </nav>

        {/* ── Main content ── */}
        <main className={styles.content}>
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

function NavSection({ label, children }) {
  return (
    <div className={styles.navSection}>
      <div className={styles.navLabel}>{label}</div>
      {children}
    </div>
  )
}

function NavItem({ icon, label, badge, active, onClick }) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
      onClick={onClick}
    >
      {/* icon is now always defined — all nav entries include one */}
      <span className={styles.navIcon}>{icon}</span>
      {label}
      {badge && <span className={styles.navBadge}>{badge}</span>}
    </button>
  )
}