import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { authAPI, fetchMyStats, fetchMyTrends, fetchAlerts } from '../api'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import styles from './ProfilePage.module.css'

const CATEGORIES = [
  'Electronics', 'Home&Kitchen', 'Computers&Accessories',
  'Health&PersonalCare', 'Toys&Games', 'Car&Motorbike',
  'HomeImprovement', 'OfficeProducts', 'MusicalInstruments', 'Other',
]

const ACCENT  = '#7c5cfc'
const ACCENT2 = '#00e5b4'
const ACCENT3 = '#ff6b6b'
const GOLD    = '#f5c842'

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [stats, setStats]               = useState(null)
  const [trends, setTrends]             = useState(null)
  const [alerts, setAlerts]             = useState([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [saving, setSaving]             = useState(false)
  const [activeTab, setActiveTab]       = useState('analytics')
  const [resending, setResending]       = useState(false)

  // ✅ FIX: Added state variables for inline OTP verification
  const [showOtpInput, setShowOtpInput] = useState(false)
  const [verifyOtp, setVerifyOtp]       = useState('')
  const [verifying, setVerifying]       = useState(false)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    store_name: '', category: '', phone: '',
    website: '', gstin: '', bio: '', notifications: true,
  })

  useEffect(() => {
    if (!user) return
    setForm({
      first_name:    user.first_name    || '',
      last_name:     user.last_name     || '',
      email:         user.email         || '',
      store_name:    user.store_name    || '',
      category:      user.category      || '',
      phone:         user.phone         || '',
      website:       user.website       || '',
      gstin:         user.gstin         || '',
      bio:           user.bio           || '',
      notifications: user.notifications ?? true,
    })
  }, [user])

  useEffect(() => {
    setStatsLoading(true)
    Promise.all([
      fetchMyStats(),
      fetchMyTrends(30),
      fetchAlerts(5),
    ])
      .then(([s, t, a]) => {
        setStats(s)
        setTrends(t)
        setAlerts(a.alerts || [])
      })
      .catch(() => toast.error('Could not load analytics'))
      .finally(() => setStatsLoading(false))
  }, [])

  const set = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        first_name: form.first_name, last_name: form.last_name,
        store_name: form.store_name, category: form.category,
        phone: form.phone, website: form.website,
        gstin: form.gstin, bio: form.bio, notifications: form.notifications,
      })
      toast.success('Profile updated!')
    } catch {
      toast.error('Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const handleResendVerification = async () => {
    setResending(true)
    try {
      const data = await authAPI.resendVerification()
      toast.success(data.message || 'Verification email sent!')
      setShowOtpInput(true)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to resend verification email'
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  // ✅ FIX: Added submission handler for OTP 
  const handleVerifySubmit = async () => {
    setVerifying(true)
    try {
      await authAPI.verifyEmail(user.email, verifyOtp)
      toast.success("Email verified successfully!")
      setTimeout(() => window.location.reload(), 1000) // Force reload to update context
    } catch (err) {
      toast.error(err.response?.data?.detail || "Invalid verification code")
    } finally {
      setVerifying(false)
    }
  }

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')).toUpperCase() || 'S'

  const completion = user?.profile_completion ?? 0
  const avgChange  = stats?.avg_change_pct ?? 0
  const avgLabel   = avgChange === 0 ? '0%' : `${avgChange > 0 ? '+' : ''}${avgChange}%`
  const isEmpty    = !statsLoading && (stats?.empty_state ?? false)

  const pieData = stats ? [
    { name: 'Underpriced', value: stats.underpriced_count || 0, color: ACCENT2 },
    { name: 'Overpriced',  value: stats.overpriced_count  || 0, color: ACCENT3 },
    { name: 'Optimal',     value: stats.optimal_count     || 0, color: ACCENT  },
  ].filter(d => d.value > 0) : []

  const trendData = trends?.trend ?? []

  return (
    <div className={styles.root}>
      {/* ── Page header + tab toggle ── */}
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageTitle}>Seller Dashboard</div>
          <div className={styles.pageSub}>
            {user?.first_name ? `Welcome, ${user.first_name}` : 'Your account'} · {user?.store_name || 'My Store'}
          </div>
        </div>
        <div className={styles.tabToggle}>
          <button
            className={activeTab === 'analytics' ? styles.tabActive : styles.tabBtn}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
          <button
            className={activeTab === 'profile' ? styles.tabActive : styles.tabBtn}
            onClick={() => setActiveTab('profile')}
          >
            ✏️ Edit Profile
          </button>
        </div>
      </div>

      {/* ── Email verification banner ── */}
      {/* ✅ FIX: Replaced simple "Resend" button with interactive OTP flow */}
      {user && !user.email_verified && (
        <div className={styles.verifyBanner} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Your email is not verified — some features may be restricted.</span>
          {!showOtpInput ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className={styles.verifyBtn} onClick={() => setShowOtpInput(true)}>Enter Code</button>
              <button className={styles.verifyBtn} onClick={handleResendVerification} disabled={resending} style={{ background: 'transparent', color: 'var(--muted)' }}>
                {resending ? 'Sending…' : 'Resend Code'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input 
                placeholder="6-digit code" 
                value={verifyOtp} 
                onChange={e => setVerifyOtp(e.target.value)}
                maxLength={6}
                style={{ 
                  padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', 
                  background: 'var(--bg3)', color: 'white', width: 120, fontFamily: 'var(--mono)',
                  outline: 'none'
                }}
              />
              <button className={styles.verifyBtn} onClick={handleVerifySubmit} disabled={verifying || verifyOtp.length < 6}>
                {verifying ? '...' : 'Verify'}
              </button>
              <button className={styles.verifyBtn} style={{ background: 'transparent', color: 'var(--muted)' }} onClick={() => setShowOtpInput(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {isEmpty && (
        <div className={styles.emptyBanner}>
          📊 No products analysed yet — head to the <strong>Single Predictor</strong> or <strong>Bulk Analysis</strong> to get your first recommendation.
        </div>
      )}

      {/* ══════════════ ANALYTICS TAB ══════════════ */}
      {activeTab === 'analytics' && (
        <div className={styles.analyticsWrap}>
          {/* KPI row */}
          <div className={styles.kpiGrid}>
            <KpiCard
              icon="📦" label="Products Analysed"
              value={statsLoading ? '…' : (stats?.total_analyzed ?? 0)}
              color={ACCENT}
            />
            <KpiCard
              icon="📈" label="Avg Price Change"
              value={statsLoading ? '…' : avgLabel}
              color={avgChange >= 0 ? ACCENT2 : ACCENT3}
            />
            <KpiCard
              icon="⬆️" label="Underpriced SKUs"
              value={statsLoading ? '…' : (stats?.underpriced_count ?? 0)}
              color={ACCENT2}
              sub="Raise price recommended"
            />
            <KpiCard
              icon="⬇️" label="Overpriced SKUs"
              value={statsLoading ? '…' : (stats?.overpriced_count ?? 0)}
              color={ACCENT3}
              sub="Cut price recommended"
            />
            <KpiCard
              icon="✅" label="Optimal Priced"
              value={statsLoading ? '…' : (stats?.optimal_count ?? 0)}
              color={GOLD}
              sub="No change needed"
            />
            <KpiCard
              icon="🔑" label="API Calls Left"
              value={statsLoading ? '…' : (stats?.api_calls_remaining ?? user?.api_calls_remaining ?? 100)}
              color={ACCENT}
              sub={`Plan: ${user?.plan || 'free'}`}
            />
          </div>

          {/* Profile Completion bar */}
          <div className={styles.completionCard}>
            <div className={styles.completionHeader}>
              <span className={styles.completionLabel}>Profile Completion</span>
              <span className={styles.completionPct} style={{ color: completion >= 80 ? ACCENT2 : completion >= 50 ? GOLD : ACCENT3 }}>
                {completion}%
              </span>
            </div>
            <div className={styles.completionTrack}>
              <div
                className={styles.completionFill}
                style={{
                  width: `${completion}%`,
                  background: completion >= 80 ? ACCENT2 : completion >= 50 ? GOLD : ACCENT3,
                }}
              />
            </div>
            <div className={styles.completionHint}>
              {completion < 100
                ? `Complete your profile to unlock all features. Missing: ${getMissingFields(user).join(', ')}`
                : '🎉 Profile fully complete!'}
            </div>
          </div>

          {/* Charts row */}
          <div className={styles.chartsRow}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                <span className={styles.dot} style={{ background: ACCENT }} />
                Products Analysed (Last 30 Days)
              </div>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={v => `Date: ${v}`}
                    />
                    <Area type="monotone" dataKey="count" stroke={ACCENT} fill="url(#areaGrad)" strokeWidth={2} dot={false} name="Products" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No trend data yet" />
              )}
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                <span className={styles.dot} style={{ background: ACCENT2 }} />
                Avg Price Change % (Last 30 Days)
              </div>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={v => [`${v?.toFixed(1)}%`, 'Avg Change']}
                      contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="avg_change_pct" radius={[3, 3, 0, 0]}>
                      {trendData.map((d, i) => (
                        <Cell key={i} fill={(d.avg_change_pct ?? 0) >= 0 ? ACCENT2 : ACCENT3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No change data yet" />
              )}
            </div>
          </div>

          {/* Pie + Recent alerts row */}
          <div className={styles.chartsRow}>
            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                <span className={styles.dot} style={{ background: GOLD }} />
                Pricing Outcomes Breakdown
              </div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="value">
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [v, n]}
                      contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="Analyse products to see outcomes" />
              )}
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                <span className={styles.dot} style={{ background: ACCENT3 }} />
                Recent Price Alerts
              </div>
              {alerts.length > 0 ? (
                <div className={styles.alertList}>
                  {alerts.map((a, i) => (
                    <div key={i} className={styles.alertRow}>
                      <span className={styles.alertIcon}>
                        {a.alert_type === 'drop' ? '⬇️' : '⬆️'}
                      </span>
                      <div className={styles.alertText}>
                        <div className={styles.alertName}>{a.product_name || '—'}</div>
                        <div className={styles.alertMeta}>
                          ₹{a.current_price} → ₹{a.recommended_price}
                          <span className={a.change_pct >= 0 ? styles.pos : styles.neg}>
                            &nbsp;{a.change_pct >= 0 ? '+' : ''}{a.change_pct?.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <span className={a.alert_type === 'drop' ? styles.badgeDrop : styles.badgeRise}>
                        {a.alert_type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyChart label="No alerts yet — alerts trigger when prices change significantly" />
              )}
            </div>
          </div>

          {/* Account summary strip */}
          <div className={styles.accountStrip}>
            <StripItem label="Member since"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'} />
            <StripItem label="Plan" value={<span className={styles.tagPurple}>{user?.plan || 'free'}</span>} />
            <StripItem label="Store" value={user?.store_name || '—'} />
            <StripItem label="Category" value={user?.category || '—'} />
            <StripItem label="Email verified"
              value={user?.email_verified
                ? <span className={styles.tagGreen}>Verified</span>
                : <span className={styles.tagRed}>Pending</span>}
            />
          </div>
        </div>
      )}

      {/* ══════════════ PROFILE EDIT TAB ══════════════ */}
      {activeTab === 'profile' && (
        <div className={styles.profileGrid}>
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{initials}</div>
              <div className={styles.name}>{user?.first_name || '—'} {user?.last_name || ''}</div>
              <div className={styles.email}>{user?.email || '—'}</div>
              {user && !user.email_verified && (
                <div className={styles.unverifiedNote}>⚠️ Email not verified</div>
              )}
              <div className={styles.planBadge}>✨ {user?.plan === 'pro' ? 'Pro Seller' : 'Free Plan'}</div>
            </div>

            <div style={{ padding: '0 4px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Profile completion</span>
                <span style={{ fontFamily: 'var(--mono)', color: completion >= 80 ? ACCENT2 : GOLD }}>{completion}%</span>
              </div>
              <div className={styles.completionTrack}>
                <div className={styles.completionFill}
                  style={{ width: `${completion}%`, background: completion >= 80 ? ACCENT2 : completion >= 50 ? GOLD : ACCENT3 }} />
              </div>
            </div>

            <div className={styles.statsGrid}>
              {[
                { val: statsLoading ? '…' : (stats?.total_analyzed ?? user?.products_analyzed ?? 0), label: 'Products analyzed' },
                { val: statsLoading ? '…' : avgLabel, label: 'Avg price change' },
                { val: statsLoading ? '…' : (stats?.underpriced_count ?? 0), label: 'Underpriced SKUs' },
                { val: stats?.api_calls_remaining ?? user?.api_calls_remaining ?? 100, label: 'API calls left' },
              ].map(s => (
                <div className={styles.statItem} key={s.label}>
                  <div className={styles.statVal}>{s.val}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.editCard}>
            <Section title="Personal Information">
              <div className={styles.row}>
                <EditField label="First Name"><input value={form.first_name} onChange={set('first_name')} /></EditField>
                <EditField label="Last Name"><input value={form.last_name} onChange={set('last_name')} /></EditField>
              </div>
              <div className={styles.row}>
                <EditField label="Email (read-only)">
                  <input value={form.email} readOnly style={{ opacity: 0.6 }} />
                </EditField>
                <EditField label="Phone">
                  <input value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
                </EditField>
              </div>
            </Section>

            <Section title="Store Details">
              <div className={styles.row}>
                <EditField label="Store Name">
                  <input value={form.store_name} onChange={set('store_name')} />
                </EditField>
                <EditField label="Primary Category">
                  <select value={form.category} onChange={set('category')}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </EditField>
              </div>
              <div className={styles.row}>
                <EditField label="Website">
                  <input value={form.website} onChange={set('website')} placeholder="www.mystore.in" />
                </EditField>
                <EditField label="GSTIN">
                  <input value={form.gstin} onChange={set('gstin')} placeholder="27AAPFU..." />
                </EditField>
              </div>
              <EditField label="About / Bio">
                <textarea value={form.bio} onChange={set('bio')} rows={3} placeholder="Tell buyers about your store…" />
              </EditField>
            </Section>

            <label className={styles.checkRow}>
              <input type="checkbox" checked={form.notifications} onChange={set('notifications')}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
              <span>Email me price alerts and weekly performance reports</span>
            </label>

            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <><span className={styles.spinner} /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────

function getMissingFields(user) {
  if (!user) return []
  const fields = { 'Phone': 'phone', 'Website': 'website', 'GSTIN': 'gstin', 'Bio': 'bio', 'Category': 'category' }
  return Object.entries(fields).filter(([, k]) => !user[k] || !String(user[k]).trim()).map(([label]) => label)
}

function KpiCard({ icon, label, value, color, sub }) {
  return (
    <div className={styles.kpiCard} style={{ '--kpi-color': color }}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiVal}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  )
}

function EmptyChart({ label }) {
  return (
    <div className={styles.emptyChart}>
      <div className={styles.emptyChartIcon}>📊</div>
      <div className={styles.emptyChartText}>{label}</div>
    </div>
  )
}

function StripItem({ label, value }) {
  return (
    <div className={styles.stripItem}>
      <div className={styles.stripLabel}>{label}</div>
      <div className={styles.stripVal}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted2)', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function EditField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}