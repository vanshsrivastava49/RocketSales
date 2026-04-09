import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchMyStats } from '../api'
import toast from 'react-hot-toast'
import styles from './ProfilePage.module.css'

const CATEGORIES = [
  'Electronics', 'Home&Kitchen', 'Computers&Accessories',
  'Health&PersonalCare', 'Toys&Games', 'Car&Motorbike',
  'HomeImprovement', 'OfficeProducts', 'MusicalInstruments', 'Other',
]

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [stats, setStats]               = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [saving, setSaving]             = useState(false)

  const [form, setForm] = useState({
    first_name:    '',
    last_name:     '',
    // `email` is kept in local form state for display purposes only.
    // It is deliberately excluded from the updateProfile() payload because
    // the backend's UpdateProfileRequest schema does not include an `email`
    // field — sending it would be silently ignored at best, and could cause
    // unexpected validation errors if the schema is tightened later.
    email:         '',
    store_name:    '',
    category:      '',
    phone:         '',
    website:       '',
    gstin:         '',
    bio:           '',
    notifications: true,
  })

  // Re-sync form whenever the user object loads or changes.
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
    fetchMyStats()
      .then(setStats)
      .catch((err) => {
        console.error('Failed to load stats:', err)
        toast.error('Could not load your stats — check your connection')
      })
      .finally(() => setStatsLoading(false))
  }, [])

  const set = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      // `email` intentionally omitted — the backend schema (UpdateProfileRequest)
      // does not accept it and the field is read-only in the UI anyway.
      await updateProfile({
        first_name:    form.first_name,
        last_name:     form.last_name,
        store_name:    form.store_name,
        category:      form.category,
        phone:         form.phone,
        website:       form.website,
        gstin:         form.gstin,
        bio:           form.bio,
        notifications: form.notifications,
      })
      toast.success('Profile updated!')
    } catch {
      toast.error('Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const initials = (
    (user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')
  ).toUpperCase() || 'S'

  // Format avg_change_pct correctly.
  // Previous code had `stats?.avg_change_pct ?? 0 > 0` which evaluated as
  // `stats?.avg_change_pct ?? (0 > 0)` = `stats?.avg_change_pct ?? false`
  // due to operator precedence — avgChangeLabel was always falsy-defaulted.
  // Also, showing "+0%" when the change is exactly zero looks odd; we show
  // "0%" in that case instead.
  const avgChange = stats?.avg_change_pct ?? 0
  const avgChangeLabel = avgChange === 0
    ? '0%'
    : `${avgChange > 0 ? '+' : ''}${avgChange}%`

  // `empty_state` is returned by the backend's /my/stats endpoint (US5).
  // When true the user has no analysed products yet, so we show a friendly
  // prompt instead of zeroed-out numbers that look like a loading error.
  const isEmpty = !statsLoading && (stats?.empty_state ?? false)

  const statItems = [
    {
      val:   statsLoading ? '…' : isEmpty ? '—' : (stats?.total_analyzed ?? user?.products_analyzed ?? 0),
      label: 'Products analyzed',
    },
    {
      val:   statsLoading ? '…' : isEmpty ? '—' : avgChangeLabel,
      label: 'Avg price change',
    },
    {
      val:   statsLoading ? '…' : isEmpty ? '—' : (stats?.underpriced_count ?? 0),
      label: 'Underpriced SKUs',
    },
    {
      val:   statsLoading ? '…' : (stats?.api_calls_remaining ?? user?.api_calls_remaining ?? 100),
      label: 'API calls left',
    },
  ]

  return (
    <>
      <div className={styles.pageTitle}>Seller Profile</div>
      <div className={styles.pageSub}>Manage your account info and store details</div>

      {/* Empty-state banner — shown when the user hasn't analysed any products yet */}
      {isEmpty && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          fontSize: 13, color: 'var(--muted)',
        }}>
          📊 No products analysed yet — head to the <strong>Price Analyser</strong> to get your first recommendation.
        </div>
      )}

      <div className={styles.grid}>
        {/* ── Left card ── */}
        <div className={styles.profileCard}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.name}>
              {user?.first_name || '—'} {user?.last_name || ''}
            </div>
            <div className={styles.email}>{user?.email || '—'}</div>
            {/* Show email-verification nudge if the user hasn't verified yet */}
            {user && !user.email_verified && (
              <div style={{
                fontSize: 11, color: '#f5c842',
                marginTop: 4, textAlign: 'center',
              }}>
                ⚠️ Email not verified — check your inbox
              </div>
            )}
            <div className={styles.planBadge}>
              ✨ {user?.plan === 'pro' ? 'Pro Seller' : 'Free Plan'}
            </div>
          </div>

          <div className={styles.statsGrid}>
            {statItems.map(s => (
              <div className={styles.statItem} key={s.label}>
                <div className={styles.statVal}>{s.val}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.metaList}>
            <MetaRow
              label="Member since"
              value={
                user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('en-IN', {
                      month: 'short', year: 'numeric',
                    })
                  : '—'
              }
            />
            <MetaRow
              label="Plan"
              value={<span className={styles.tagPurple}>{user?.plan || 'free'}</span>}
            />
            <MetaRow label="Store" value={user?.store_name || '—'} />
          </div>
        </div>

        {/* ── Right edit form ── */}
        <div className={styles.editCard}>
          <Section title="Personal Information">
            <div className={styles.row}>
              <EditField label="First Name">
                <input value={form.first_name} onChange={set('first_name')} />
              </EditField>
              <EditField label="Last Name">
                <input value={form.last_name} onChange={set('last_name')} />
              </EditField>
            </div>
            <div className={styles.row}>
              {/* Email is read-only: the backend provides no email-change endpoint */}
              <EditField label="Email (read-only)">
                <input value={form.email} readOnly style={{ opacity: 0.6 }} />
              </EditField>
              <EditField label="Phone">
                <input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+91 98765 43210"
                />
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
                <input
                  value={form.website}
                  onChange={set('website')}
                  placeholder="www.mystore.in"
                />
              </EditField>
              <EditField label="GSTIN">
                <input
                  value={form.gstin}
                  onChange={set('gstin')}
                  placeholder="27AAPFU..."
                />
              </EditField>
            </div>
            <EditField label="About / Bio">
              <textarea
                value={form.bio}
                onChange={set('bio')}
                rows={3}
                placeholder="Tell buyers about your store…"
              />
            </EditField>
          </Section>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.notifications}
              onChange={set('notifications')}
              style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
            />
            <span>Email me price alerts and weekly performance reports</span>
          </label>

          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><span className={styles.spinner} /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Sub-components ── */

function MetaRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{value}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--muted2)',
        marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function EditField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}