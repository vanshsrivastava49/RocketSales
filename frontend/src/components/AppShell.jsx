import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchHealth } from '../api'
import ProfilePage from '../pages/ProfilePage'
import Dashboard from './Dashboard'
import SinglePredictor from './SinglePredictor'
import BulkPredictor from './BulkPredictor'
import styles from './AppShell.module.css'
import { useAlerts } from '../contexts/AlertsContext'

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
  const { user, logout }    = useAuth()
  const { alerts, refresh } = useAlerts()
  const [showAlerts, setShowAlerts] = useState(false)
  const [activeNav, setActiveNav]   = useState('overview')
  const [health, setHealth]         = useState(null)
  const alertDropdownRef            = useRef(null)

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  // ✅ FIX: close alert dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!showAlerts) return
    const handleClickOutside = (e) => {
      if (alertDropdownRef.current && !alertDropdownRef.current.contains(e.target)) {
        setShowAlerts(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAlerts])

  const initials = (
    (user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')
  ).toUpperCase() || 'S'

  const renderPage = () => {
    switch (activeNav) {
      case 'overview':  return <Dashboard />
      case 'analytics': return <Dashboard />
      case 'single':    return <SinglePredictor />
      case 'bulk':      return <BulkPredictor />
      case 'market':    return <Dashboard />
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
          {/* ── Alert bell + dropdown ── */}
          {/* ✅ FIX: ref attached to the wrapper div so outside-click detection works */}
          <div ref={alertDropdownRef} style={{ position: 'relative', marginRight: 16 }}>
            <button
              onClick={() => setShowAlerts(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, position: 'relative', padding: '4px 8px',
                color: showAlerts ? 'var(--accent)' : 'var(--muted2)',
              }}
              title="Price alerts"
              aria-label={`Alerts (${alerts.length} unread)`}
            >
              🔔
              {alerts.length > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  background: 'var(--accent3)', color: '#fff',
                  borderRadius: '50%', fontSize: 10,
                  minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--mono)', lineHeight: 1,
                }}>
                  {alerts.length > 99 ? '99+' : alerts.length}
                </span>
              )}
            </button>

            {showAlerts && (
              <div style={{
                position: 'absolute', right: 0, top: 36,
                width: 340, background: 'var(--bg2)',
                border: '1px solid var(--border2)',
                borderRadius: 12, padding: 0,
                zIndex: 200,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                {/* Dropdown header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Price Alerts</span>
                  <button
                    onClick={refresh}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)',
                    }}
                    title="Refresh alerts"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {/* Alert list */}
                <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {alerts.length === 0 ? (
                    <div style={{
                      padding: 24, textAlign: 'center',
                      color: 'var(--muted)', fontSize: 13,
                    }}>
                      No alerts yet
                    </div>
                  ) : (
                    alerts.map(a => (
                      <div key={a.id} style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1.4 }}>
                          {a.alert_type === 'drop' ? '⬇️' : a.alert_type === 'rise' ? '⬆️' : '📊'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.product_name || '—'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted2)', marginTop: 2 }}>
                            ₹{a.current_price} → ₹{a.recommended_price}
                          </div>
                          <div style={{
                            fontSize: 11, marginTop: 2,
                            color: a.change_pct >= 0 ? 'var(--accent2)' : 'var(--accent3)',
                            fontFamily: 'var(--mono)',
                          }}>
                            {a.change_pct >= 0 ? '+' : ''}{a.change_pct?.toFixed(1)}% · {a.alert_type}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer link */}
                {alerts.length > 0 && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      onClick={() => { setActiveNav('profile'); setShowAlerts(false) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent)', fontSize: 12, fontFamily: 'var(--mono)',
                      }}
                    >
                      View all in Profile →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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
      <span className={styles.navIcon}>{icon}</span>
      {label}
      {badge && <span className={styles.navBadge}>{badge}</span>}
    </button>
  )
}